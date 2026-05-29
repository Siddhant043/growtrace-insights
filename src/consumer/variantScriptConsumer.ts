import type { ConsumeMessage } from "amqplib";

import { env } from "../config/env.js";
import { buildChatModel } from "../llm/chatModelFactory.js";
import {
  VARIANT_SCRIPT_SYSTEM_PROMPT,
  buildVariantScriptUserPrompt,
} from "../llm/prompts/variantScriptPrompt.js";
import {
  assertVariantScriptTopology,
  publishVariantScriptResponse,
} from "../infrastructure/rabbitmq.js";
import {
  variantScriptGenerateRequestSchema,
  type VariantScriptGenerateRequest,
  type VariantScriptGenerateResponse,
} from "../types/variantGeneration.js";
import { createScopedLogger } from "../utils/logger.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const consumerLogger = createScopedLogger("consumer.variantScript");

const inMemoryRetryCounter = new Map<string, number>();

const resolveRetryKey = (msg: ConsumeMessage): string =>
  msg.properties.messageId ?? `delivery-${msg.fields.deliveryTag}`;

type ParsedOutcome =
  | { kind: "valid"; request: VariantScriptGenerateRequest }
  | { kind: "invalid"; reason: string };

function parseMessage(msg: ConsumeMessage): ParsedOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(msg.content.toString("utf-8"));
  } catch (err) {
    return {
      kind: "invalid",
      reason: `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = variantScriptGenerateRequestSchema.safeParse(parsed);
  if (!result.success) {
    return {
      kind: "invalid",
      reason: `Schema validation failed: ${JSON.stringify(result.error.format())}`,
    };
  }

  return { kind: "valid", request: result.data };
}

async function generateVariantScript(
  request: VariantScriptGenerateRequest,
): Promise<VariantScriptGenerateResponse> {
  try {
    const model = buildChatModel({ temperature: 0.4 });
    const response = await model.invoke([
      new SystemMessage(VARIANT_SCRIPT_SYSTEM_PROMPT),
      new HumanMessage(buildVariantScriptUserPrompt(request)),
    ]);

    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const jsonStart = content.indexOf("{");
    const jsonEnd   = content.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("LLM response did not contain a JSON object");
    }

    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
      fullScript?: string;
      scenes?: unknown[];
    };

    if (!parsed.fullScript || !Array.isArray(parsed.scenes)) {
      throw new Error("LLM response missing fullScript or scenes");
    }

    return {
      variantId:  request.variantId,
      videoId:    request.videoId,
      success:    true,
      fullScript: parsed.fullScript,
      scenes:     parsed.scenes as VariantScriptGenerateResponse["scenes"],
    };
  } catch (err) {
    return {
      variantId:    request.variantId,
      videoId:      request.videoId,
      success:      false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

export const startVariantScriptConsumer = async (): Promise<void> => {
  const channel = await assertVariantScriptTopology();
  await channel.prefetch(env.VARIANT_SCRIPT_PREFETCH);

  consumerLogger.info("Consumer starting", {
    queue:      env.VARIANT_SCRIPT_REQUEST_QUEUE,
    prefetch:   env.VARIANT_SCRIPT_PREFETCH,
    maxRetries: env.VARIANT_SCRIPT_MAX_RETRIES,
  });

  await channel.consume(
    env.VARIANT_SCRIPT_REQUEST_QUEUE,
    async (msg) => {
      if (!msg) {
        consumerLogger.warn("Received null message; channel may be closing");
        return;
      }

      const retryKey       = resolveRetryKey(msg);
      const previousAttempts = inMemoryRetryCounter.get(retryKey) ?? 0;

      try {
        const parsed = parseMessage(msg);
        if (parsed.kind === "invalid") {
          consumerLogger.warn("Rejecting unparseable message to DLQ", { reason: parsed.reason });
          channel.nack(msg, false, false);
          inMemoryRetryCounter.delete(retryKey);
          return;
        }

        const response = await generateVariantScript(parsed.request);
        await publishVariantScriptResponse(response);

        consumerLogger.info("Variant script response published", {
          variantId: parsed.request.variantId,
          success:   response.success,
        });

        channel.ack(msg);
        inMemoryRetryCounter.delete(retryKey);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (previousAttempts >= env.VARIANT_SCRIPT_MAX_RETRIES) {
          consumerLogger.error("Max retries exhausted; routing to DLQ", {
            retryKey,
            attempts: previousAttempts + 1,
            error: errorMessage,
          });
          channel.nack(msg, false, false);
          inMemoryRetryCounter.delete(retryKey);
          return;
        }

        inMemoryRetryCounter.set(retryKey, previousAttempts + 1);
        channel.nack(msg, false, true);
        consumerLogger.warn("Retrying variant script message", {
          retryKey,
          attempt: previousAttempts + 1,
          error: errorMessage,
        });
      }
    },
  );
};
