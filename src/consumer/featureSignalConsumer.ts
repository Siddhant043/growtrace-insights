import type { ConsumeMessage } from "amqplib";
import { z } from "zod";

import { env } from "../config/env.js";
import { getChatModel } from "../llm/chatModelFactory.js";
import {
  FEATURE_SIGNAL_SYSTEM_PROMPT,
  buildFeatureSignalUserPrompt,
} from "../llm/prompts/featureSignalPrompt.js";
import {
  assertFeatureSignalTopology,
  publishFeatureSignalResponse,
} from "../infrastructure/rabbitmq.js";
import { generateEmbedding } from "../embedding/embedding.service.js";
import { createScopedLogger } from "../utils/logger.js";

const consumerLogger = createScopedLogger("consumer.featureSignal");

const featureSignalRequestSchema = z.object({
  jobId:      z.string().min(1),
  eventId:    z.string().min(1),
  projectId:  z.string().min(1),
  eventType:  z.string().min(1),
  provider:   z.string().min(1),
  rawPayload: z.record(z.unknown()),
});

const featureSignalLlmOutputSchema = z.object({
  summary:              z.string(),
  affectedFeatures:     z.array(z.string()),
  userFacingConfidence: z.number().min(0).max(1),
});

const inMemoryRetryCounter = new Map<string, number>();

const resolveRetryKey = (msg: ConsumeMessage): string =>
  msg.properties.messageId ?? `delivery-${msg.fields.deliveryTag}`;

export const startFeatureSignalConsumer = async (): Promise<void> => {
  const channel = await assertFeatureSignalTopology();

  consumerLogger.info("Consumer starting", {
    queue:    env.FEATURE_SIGNAL_LLM_REQUEST_QUEUE,
    prefetch: env.FEATURE_SIGNAL_LLM_PREFETCH,
  });

  await channel.consume(env.FEATURE_SIGNAL_LLM_REQUEST_QUEUE, async (msg) => {
    if (!msg) {
      consumerLogger.warn("Received null message; channel may be closing");
      return;
    }

    const retryKey = resolveRetryKey(msg);
    const previousAttempts = inMemoryRetryCounter.get(retryKey) ?? 0;

    try {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(msg.content.toString("utf-8"));
      } catch {
        consumerLogger.warn("Malformed JSON; routing to DLQ");
        channel.nack(msg, false, false);
        inMemoryRetryCounter.delete(retryKey);
        return;
      }

      const validation = featureSignalRequestSchema.safeParse(parsedJson);
      if (!validation.success) {
        consumerLogger.warn("Schema validation failed; routing to DLQ", {
          reason: JSON.stringify(validation.error.format()),
        });
        channel.nack(msg, false, false);
        inMemoryRetryCounter.delete(retryKey);
        return;
      }

      const request = validation.data;
      const userPrompt = buildFeatureSignalUserPrompt(
        request.eventType,
        request.provider,
        request.rawPayload,
      );

      const structuredModel = getChatModel().withStructuredOutput(featureSignalLlmOutputSchema);
      const result = await structuredModel.invoke([
        { role: "system",  content: FEATURE_SIGNAL_SYSTEM_PROMPT },
        { role: "user",    content: userPrompt },
      ]);

      // Compute embedding for the summary so the server can run similarity search
      let summaryEmbedding: number[] | undefined;
      try {
        const embeddingResult = await generateEmbedding(result.summary);
        summaryEmbedding = embeddingResult.embedding;
      } catch (embeddingError) {
        consumerLogger.warn("Failed to generate summary embedding; similarity search will be skipped", {
          error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
        });
      }

      await publishFeatureSignalResponse({
        jobId:                request.jobId,
        eventId:              request.eventId,
        status:               "completed",
        summary:              result.summary,
        affectedFeatures:     result.affectedFeatures,
        userFacingConfidence: result.userFacingConfidence,
        summaryEmbedding,
      });

      consumerLogger.info("Feature signal extracted", {
        jobId:               request.jobId,
        eventId:             request.eventId,
        userFacingConfidence: result.userFacingConfidence,
        featureCount:        result.affectedFeatures.length,
      });

      channel.ack(msg);
      inMemoryRetryCounter.delete(retryKey);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (previousAttempts >= env.FEATURE_SIGNAL_LLM_MAX_RETRIES) {
        consumerLogger.error("Max retries exhausted; routing to DLQ", {
          retryKey,
          attempts: previousAttempts + 1,
          error: errorMessage,
        });

        await publishFeatureSignalResponse({
          jobId:    (JSON.parse(msg.content.toString("utf-8")) as { jobId?: string })?.jobId ?? retryKey,
          eventId:  (JSON.parse(msg.content.toString("utf-8")) as { eventId?: string })?.eventId ?? retryKey,
          status:   "failed",
          errorMessage,
        }).catch(() => {/* best-effort */});

        channel.nack(msg, false, false);
        inMemoryRetryCounter.delete(retryKey);
        return;
      }

      inMemoryRetryCounter.set(retryKey, previousAttempts + 1);
      channel.nack(msg, false, true);
      consumerLogger.warn("Retrying feature signal message", {
        retryKey,
        attempt: previousAttempts + 1,
        error: errorMessage,
      });
    }
  });
};
