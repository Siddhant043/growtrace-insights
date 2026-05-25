import type { ConsumeMessage } from "amqplib";

import { env } from "../config/env.js";
import { transcribeAudioToSegments } from "../captions/whisper.service.js";
import {
  assertNarrationCaptionTopology,
  publishNarrationCaptionResponse,
} from "../infrastructure/rabbitmq.js";
import {
  narrationCaptionRequestSchema,
  type NarrationCaptionRequest,
  type NarrationCaptionResponse,
} from "../types/narrationCaption.js";
import { createScopedLogger } from "../utils/logger.js";

const consumerLogger = createScopedLogger("consumer.narrationCaption");

const inMemoryRetryCounter = new Map<string, number>();

const resolveRetryKey = (consumeMessage: ConsumeMessage): string =>
  consumeMessage.properties.messageId ??
  `delivery-${consumeMessage.fields.deliveryTag}`;

type ParsedMessageOutcome =
  | { kind: "valid"; request: NarrationCaptionRequest }
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
    narrationCaptionRequestSchema.safeParse(parsedJsonPayload);
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
  request: NarrationCaptionRequest,
): Promise<NarrationCaptionResponse> => {
  try {
    const audioBuffer = Buffer.from(request.audioBase64, "base64");
    const segments = await transcribeAudioToSegments(audioBuffer, {
      jobId: request.jobId,
      videoId: request.videoId,
      workflowId: request.workflowId,
      projectId: request.projectId,
    });

    return {
      jobId: request.jobId,
      videoId: request.videoId,
      workflowId: request.workflowId,
      projectId: request.projectId,
      userId: request.userId,
      status: "completed",
      segments,
    };
  } catch (processingError) {
    const errorMessage =
      processingError instanceof Error
        ? processingError.message
        : String(processingError);

    return {
      jobId: request.jobId,
      videoId: request.videoId,
      workflowId: request.workflowId,
      projectId: request.projectId,
      userId: request.userId,
      status: "failed",
      errorMessage,
    };
  }
};

export const startNarrationCaptionConsumer = async (): Promise<void> => {
  const channel = await assertNarrationCaptionTopology();
  await channel.prefetch(env.NARRATION_CAPTION_PREFETCH);

  consumerLogger.info("Consumer starting", {
    queue: env.NARRATION_CAPTION_REQUEST_QUEUE,
    prefetch: env.NARRATION_CAPTION_PREFETCH,
    maxRetries: env.NARRATION_CAPTION_MAX_RETRIES,
  });

  await channel.consume(
    env.NARRATION_CAPTION_REQUEST_QUEUE,
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
        await publishNarrationCaptionResponse(response);

        consumerLogger.info("Narration caption response published", {
          videoId: parsed.request.videoId,
          jobId: parsed.request.jobId,
          status: response.status,
          segmentCount: response.segments?.length ?? 0,
        });

        channel.ack(consumeMessage);
        inMemoryRetryCounter.delete(retryKey);
      } catch (processingError) {
        const errorMessage =
          processingError instanceof Error
            ? processingError.message
            : String(processingError);

        if (previousAttempts >= env.NARRATION_CAPTION_MAX_RETRIES) {
          try {
            const reparsed = parseAndValidateMessage(consumeMessage);
            if (reparsed.kind === "valid") {
              await publishNarrationCaptionResponse({
                jobId: reparsed.request.jobId,
                videoId: reparsed.request.videoId,
                workflowId: reparsed.request.workflowId,
                projectId: reparsed.request.projectId,
                userId: reparsed.request.userId,
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
        consumerLogger.warn("Retrying narration caption message", {
          retryKey,
          attempt: previousAttempts + 1,
          error: errorMessage,
        });
      }
    },
  );
};
