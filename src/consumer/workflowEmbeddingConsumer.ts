import type { ConsumeMessage } from "amqplib";

import { env } from "../config/env.js";
import {
  assertWorkflowEmbeddingTopology,
  publishWorkflowEmbeddingResponse,
} from "../infrastructure/rabbitmq.js";
import { generateEmbedding } from "../embedding/embedding.service.js";
import {
  workflowEmbeddingRequestSchema,
  type WorkflowEmbeddingRequest,
  type WorkflowEmbeddingResponse,
} from "../types/workflowEmbedding.js";
import { createScopedLogger } from "../utils/logger.js";

const consumerLogger = createScopedLogger("consumer.workflowEmbedding");

const inMemoryRetryCounter = new Map<string, number>();

const resolveRetryKey = (consumeMessage: ConsumeMessage): string =>
  consumeMessage.properties.messageId ??
  `delivery-${consumeMessage.fields.deliveryTag}`;

type ParsedMessageOutcome =
  | { kind: "valid"; request: WorkflowEmbeddingRequest }
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

  const validationResult =
    workflowEmbeddingRequestSchema.safeParse(parsedJsonPayload);
  if (!validationResult.success) {
    return {
      kind: "invalid",
      reason: `Schema validation failed: ${JSON.stringify(
        validationResult.error.format(),
      )}`,
    };
  }

  return { kind: "valid", request: validationResult.data };
};

const buildResponse = async (
  request: WorkflowEmbeddingRequest,
): Promise<WorkflowEmbeddingResponse> => {
  try {
    const result = await generateEmbedding(request.content);
    return {
      jobId: request.jobId,
      workflowId: request.workflowId,
      projectId: request.projectId,
      status: "completed",
      embedding: result.embedding,
      model: env.EMBEDDING_MODEL,
      inputTokens: result.inputTokens,
      totalTokens: result.totalTokens,
    };
  } catch (processingError) {
    const errorMessage =
      processingError instanceof Error
        ? processingError.message
        : String(processingError);
    return {
      jobId: request.jobId,
      workflowId: request.workflowId,
      projectId: request.projectId,
      status: "failed",
      errorMessage,
    };
  }
};

export const startWorkflowEmbeddingConsumer = async (): Promise<void> => {
  const channel = await assertWorkflowEmbeddingTopology();
  await channel.prefetch(env.WORKFLOW_EMBEDDING_PREFETCH);

  consumerLogger.info("Consumer starting", {
    queue: env.WORKFLOW_EMBEDDING_REQUEST_QUEUE,
    prefetch: env.WORKFLOW_EMBEDDING_PREFETCH,
    maxRetries: env.WORKFLOW_EMBEDDING_MAX_RETRIES,
  });

  await channel.consume(
    env.WORKFLOW_EMBEDDING_REQUEST_QUEUE,
    async (consumeMessage) => {
      if (!consumeMessage) {
        consumerLogger.warn("Received null message; channel may be closing");
        return;
      }

      const retryKey = resolveRetryKey(consumeMessage);
      const previousAttempts = inMemoryRetryCounter.get(retryKey) ?? 0;

      try {
        const parsed = parseAndValidateMessage(consumeMessage);
        if (parsed.kind === "invalid") {
          consumerLogger.warn("Rejecting unparseable message to DLQ", {
            reason: parsed.reason,
          });
          channel.nack(consumeMessage, false, false);
          inMemoryRetryCounter.delete(retryKey);
          return;
        }

        const response = await buildResponse(parsed.request);
        await publishWorkflowEmbeddingResponse(response);

        consumerLogger.info("Workflow embedding response published", {
          workflowId: parsed.request.workflowId,
          jobId: parsed.request.jobId,
          status: response.status,
          dimensions: response.embedding?.length ?? 0,
        });

        channel.ack(consumeMessage);
        inMemoryRetryCounter.delete(retryKey);
      } catch (processingError) {
        const errorMessage =
          processingError instanceof Error
            ? processingError.message
            : String(processingError);

        if (previousAttempts >= env.WORKFLOW_EMBEDDING_MAX_RETRIES) {
          try {
            const reparsed = parseAndValidateMessage(consumeMessage);
            if (reparsed.kind === "valid") {
              await publishWorkflowEmbeddingResponse({
                jobId: reparsed.request.jobId,
                workflowId: reparsed.request.workflowId,
                projectId: reparsed.request.projectId,
                status: "failed",
                errorMessage,
              });
            }
          } catch {
            // best-effort failure response
          }

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
        channel.nack(consumeMessage, false, true);
        consumerLogger.warn("Retrying workflow embedding message", {
          retryKey,
          attempt: previousAttempts + 1,
          error: errorMessage,
        });
      }
    },
  );
};
