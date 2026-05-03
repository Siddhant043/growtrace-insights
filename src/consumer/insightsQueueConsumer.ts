import type { ConsumeMessage } from "amqplib";

import { env } from "../config/env.js";
import { runInsightsWorkflow } from "../graph/workflow.js";
import { assertInsightsTopology } from "../infrastructure/rabbitmq.js";
import { upsertGeneratedInsightBatch } from "../repositories/insightsRepository.js";
import {
  analyticsSnapshotSchema,
  type AnalyticsSnapshot,
} from "../types/analyticsSnapshot.js";
import { createScopedLogger } from "../utils/logger.js";

const consumerLogger = createScopedLogger("consumer.insightsQueue");

const inMemoryRetryCounter = new Map<string, number>();

const resolveRetryKey = (consumeMessage: ConsumeMessage): string =>
  consumeMessage.properties.messageId ??
  `delivery-${consumeMessage.fields.deliveryTag}`;

type ParsedMessageOutcome =
  | { kind: "valid"; snapshot: AnalyticsSnapshot }
  | { kind: "invalid"; reason: string };

const parseAndValidateMessage = (
  consumeMessage: ConsumeMessage,
): ParsedMessageOutcome => {
  let parsedJsonPayload: unknown;
  try {
    parsedJsonPayload = JSON.parse(consumeMessage.content.toString("utf-8"));
  } catch (parseError) {
    return {
      kind: "invalid",
      reason: `Malformed JSON: ${
        parseError instanceof Error ? parseError.message : String(parseError)
      }`,
    };
  }

  const validationResult = analyticsSnapshotSchema.safeParse(parsedJsonPayload);
  if (!validationResult.success) {
    return {
      kind: "invalid",
      reason: `Schema validation failed: ${JSON.stringify(
        validationResult.error.format(),
      )}`,
    };
  }

  return { kind: "valid", snapshot: validationResult.data };
};

const processSingleMessage = async (
  consumeMessage: ConsumeMessage,
): Promise<{ ack: boolean; permanent: boolean; reason?: string }> => {
  const parsed = parseAndValidateMessage(consumeMessage);
  if (parsed.kind === "invalid") {
    consumerLogger.warn("Rejecting unparseable message to DLQ", {
      reason: parsed.reason,
    });
    return { ack: false, permanent: true, reason: parsed.reason };
  }

  const generatedInsights = await runInsightsWorkflow(parsed.snapshot);
  const upsertSummary = await upsertGeneratedInsightBatch(generatedInsights);

  consumerLogger.info("Snapshot processed", {
    userId: parsed.snapshot.userId,
    asOfDate: parsed.snapshot.asOfDate,
    insightsAttempted: upsertSummary.attemptedCount,
    insightsInserted: upsertSummary.insertedCount,
    duplicates: upsertSummary.duplicateCount,
  });

  return { ack: true, permanent: false };
};

export const startInsightsQueueConsumer = async (): Promise<void> => {
  const channel = await assertInsightsTopology();

  consumerLogger.info("Consumer starting", {
    queue: env.INSIGHTS_QUEUE,
    prefetch: env.INSIGHTS_PREFETCH,
    maxRetries: env.INSIGHTS_MAX_RETRIES,
  });

  await channel.consume(
    env.INSIGHTS_QUEUE,
    async (consumeMessage) => {
      if (!consumeMessage) {
        consumerLogger.warn("Received null message; channel may be closing");
        return;
      }

      const retryKey = resolveRetryKey(consumeMessage);
      const previousAttempts = inMemoryRetryCounter.get(retryKey) ?? 0;

      try {
        const outcome = await processSingleMessage(consumeMessage);
        if (outcome.ack) {
          channel.ack(consumeMessage);
          inMemoryRetryCounter.delete(retryKey);
          return;
        }
        if (outcome.permanent) {
          channel.nack(consumeMessage, false, false);
          inMemoryRetryCounter.delete(retryKey);
          return;
        }
      } catch (processingError) {
        const errorMessage =
          processingError instanceof Error
            ? processingError.message
            : String(processingError);

        if (previousAttempts >= env.INSIGHTS_MAX_RETRIES) {
          consumerLogger.error("Max retries exhausted; routing to DLQ", {
            retryKey,
            attempts: previousAttempts + 1,
            error: errorMessage,
          });
          channel.nack(consumeMessage, false, false);
          inMemoryRetryCounter.delete(retryKey);
          return;
        }

        inMemoryRetryCounter.set(retryKey, previousAttempts + 1);
        const backoffDelayMs =
          env.INSIGHTS_RETRY_BACKOFF_MS * (previousAttempts + 1);

        consumerLogger.warn("Processing failed; scheduling requeue", {
          retryKey,
          attempt: previousAttempts + 1,
          backoffDelayMs,
          error: errorMessage,
        });

        setTimeout(() => {
          channel.nack(consumeMessage, false, true);
        }, backoffDelayMs);
      }
    },
    { noAck: false },
  );

  consumerLogger.info("Consumer attached to queue");
};
