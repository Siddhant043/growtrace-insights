import type { ConsumeMessage } from "amqplib";

import { env } from "../config/env.js";
import { runWorkflowGenerationGraph } from "../graph/workflow.js";
import {
  assertWorkflowLlmTopology,
  publishWorkflowGenerationResponse,
} from "../infrastructure/rabbitmq.js";
import {
  workflowGenerationRequestSchema,
  type WorkflowGenerationRequest,
  type WorkflowGenerationResponse,
} from "../types/workflowGeneration.js";
import { createScopedLogger } from "../utils/logger.js";

const consumerLogger = createScopedLogger("consumer.workflowGeneration");

const inMemoryRetryCounter = new Map<string, number>();

const resolveRetryKey = (consumeMessage: ConsumeMessage): string =>
  consumeMessage.properties.messageId ??
  `delivery-${consumeMessage.fields.deliveryTag}`;

type ParsedMessageOutcome =
  | { kind: "valid"; request: WorkflowGenerationRequest }
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
    workflowGenerationRequestSchema.safeParse(parsedJsonPayload);
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
  request: WorkflowGenerationRequest,
): Promise<WorkflowGenerationResponse> => {
  const graphResult = await runWorkflowGenerationGraph(request);

  if (graphResult.errorMessage) {
    return {
      jobId: request.jobId,
      workflowId: request.workflowId,
      status: "failed",
      errorMessage: graphResult.errorMessage,
    };
  }

  if (!graphResult.generatedActions || graphResult.generatedActions.length === 0) {
    return {
      jobId: request.jobId,
      workflowId: request.workflowId,
      status: "failed",
      errorMessage: "LLM returned no workflow actions",
    };
  }

  return {
    jobId: request.jobId,
    workflowId: request.workflowId,
    status: "completed",
    actions: graphResult.generatedActions,
  };
};

export const startWorkflowGenerationConsumer = async (): Promise<void> => {
  const channel = await assertWorkflowLlmTopology();

  consumerLogger.info("Consumer starting", {
    queue: env.WORKFLOW_LLM_REQUEST_QUEUE,
    prefetch: env.WORKFLOW_LLM_PREFETCH,
    maxRetries: env.WORKFLOW_LLM_MAX_RETRIES,
  });

  await channel.consume(
    env.WORKFLOW_LLM_REQUEST_QUEUE,
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
        await publishWorkflowGenerationResponse(response);

        consumerLogger.info("Workflow generation response published", {
          workflowId: parsed.request.workflowId,
          jobId: parsed.request.jobId,
          status: response.status,
          actionCount: response.actions?.length ?? 0,
        });

        channel.ack(consumeMessage);
        inMemoryRetryCounter.delete(retryKey);
      } catch (processingError) {
        const errorMessage =
          processingError instanceof Error
            ? processingError.message
            : String(processingError);

        if (previousAttempts >= env.WORKFLOW_LLM_MAX_RETRIES) {
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
        consumerLogger.warn("Retrying workflow generation message", {
          retryKey,
          attempt: previousAttempts + 1,
          error: errorMessage,
        });
      }
    },
  );
};
