import { config as loadDotenvFile } from "dotenv";
import { z } from "zod";

import { applyLangSmithEnvironment } from "../observability/langsmith-tracing.js";

loadDotenvFile({ path: ".env" });
loadDotenvFile();

export const SUPPORTED_LLM_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "ollama",
] as const;

export type SupportedLlmProvider = (typeof SUPPORTED_LLM_PROVIDERS)[number];

const DEFAULT_MODEL_PER_PROVIDER: Record<SupportedLlmProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-2.5-flash",
  ollama: "llama3.1:8b",
};

const workflowLlmEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    RABBITMQ_URL: z.string().url("RABBITMQ_URL must be a valid URL").optional(),
    RABBITMQ_PORT: z.coerce.number().int().min(1).max(65535).default(5672),
    RABBITMQ_HOST: z.string().min(1).default("localhost"),
    RABBITMQ_DEFAULT_USER: z.string().min(1).default("user"),
    RABBITMQ_DEFAULT_PASS: z.string().min(1).default("password"),

    LLM_PROVIDER: z.enum(SUPPORTED_LLM_PROVIDERS).default("google"),
    LLM_MODEL: z.string().trim().min(1).optional(),
    LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    LLM_MAX_TOKENS: z.coerce.number().int().min(1).max(8192).default(4096),
    LLM_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(120000)
      .default(60000),

    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z.string().url().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z
      .string()
      .url("OLLAMA_BASE_URL must be a valid URL")
      .default("http://localhost:11434"),

    WORKFLOW_LLM_EXCHANGE: z.string().min(1).default("neverstale.workflows"),
    WORKFLOW_LLM_REQUEST_QUEUE: z
      .string()
      .min(1)
      .default("workflow.generate.request"),
    WORKFLOW_LLM_RESPONSE_QUEUE: z
      .string()
      .min(1)
      .default("workflow.generate.response"),
    WORKFLOW_LLM_REQUEST_ROUTING_KEY: z
      .string()
      .min(1)
      .default("workflow.generate.request"),
    WORKFLOW_LLM_RESPONSE_ROUTING_KEY: z
      .string()
      .min(1)
      .default("workflow.generate.response"),
    WORKFLOW_LLM_DLX_EXCHANGE: z
      .string()
      .min(1)
      .default("neverstale.workflows.dlx"),
    WORKFLOW_LLM_DLQ: z.string().min(1).default("workflow.generate.dlq"),
    WORKFLOW_LLM_DL_ROUTING_KEY: z
      .string()
      .min(1)
      .default("workflow.generate.dead"),
    WORKFLOW_LLM_PREFETCH: z.coerce.number().int().min(1).max(100).default(1),
    WORKFLOW_LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

    NARRATION_LLM_REQUEST_QUEUE: z
      .string()
      .min(1)
      .default("narration.generate.request"),
    NARRATION_LLM_RESPONSE_QUEUE: z
      .string()
      .min(1)
      .default("narration.generate.response"),
    NARRATION_LLM_REQUEST_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.generate.request"),
    NARRATION_LLM_RESPONSE_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.generate.response"),
    NARRATION_LLM_DLQ: z.string().min(1).default("narration.generate.dlq"),
    NARRATION_LLM_DL_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.generate.dead"),
    NARRATION_LLM_PREFETCH: z.coerce.number().int().min(1).max(100).default(1),
    NARRATION_LLM_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .default(3),

    NARRATION_TTS_REQUEST_QUEUE: z
      .string()
      .min(1)
      .default("narration.tts.request"),
    NARRATION_TTS_RESPONSE_QUEUE: z
      .string()
      .min(1)
      .default("narration.tts.response"),
    NARRATION_TTS_REQUEST_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.tts.request"),
    NARRATION_TTS_RESPONSE_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.tts.response"),
    NARRATION_TTS_DLQ: z.string().min(1).default("narration.tts.dlq"),
    NARRATION_TTS_DL_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.tts.dead"),
    NARRATION_TTS_PREFETCH: z.coerce.number().int().min(1).max(100).default(1),
    NARRATION_TTS_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .default(3),

    TTS_MODEL: z.string().default("tts-1"),
    TTS_VOICE: z.string().default("alloy"),
    TTS_DISABLE: z
      .string()
      .optional()
      .transform((value) => value === "true"),

    NARRATION_CAPTION_REQUEST_QUEUE: z
      .string()
      .min(1)
      .default("narration.caption.request"),
    NARRATION_CAPTION_RESPONSE_QUEUE: z
      .string()
      .min(1)
      .default("narration.caption.response"),
    NARRATION_CAPTION_REQUEST_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.caption.request"),
    NARRATION_CAPTION_RESPONSE_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.caption.response"),
    NARRATION_CAPTION_DLQ: z.string().min(1).default("narration.caption.dlq"),
    NARRATION_CAPTION_DL_ROUTING_KEY: z
      .string()
      .min(1)
      .default("narration.caption.dead"),
    NARRATION_CAPTION_PREFETCH: z.coerce.number().int().min(1).max(100).default(1),
    NARRATION_CAPTION_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .default(3),

    WORKFLOW_EMBEDDING_REQUEST_QUEUE: z
      .string()
      .min(1)
      .default("workflow.embedding.request"),
    WORKFLOW_EMBEDDING_RESPONSE_ROUTING_KEY: z
      .string()
      .min(1)
      .default("workflow.embedding.response"),
    WORKFLOW_EMBEDDING_DLQ: z.string().min(1).default("workflow.embedding.dlq"),
    WORKFLOW_EMBEDDING_DL_ROUTING_KEY: z
      .string()
      .min(1)
      .default("workflow.embedding.dlq"),
    WORKFLOW_EMBEDDING_PREFETCH: z.coerce.number().int().min(1).max(100).default(2),
    WORKFLOW_EMBEDDING_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(10)
      .default(3),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().min(1).default(1536),

    WHISPER_MODEL: z.string().default("whisper-1"),
    WHISPER_DISABLE: z
      .string()
      .optional()
      .transform((value) => value === "true"),

    VARIANT_SCRIPT_REQUEST_QUEUE: z.string().min(1).default("variant-script-generate-request"),
    VARIANT_SCRIPT_RESPONSE_QUEUE: z.string().min(1).default("variant-script-generate-response"),
    VARIANT_SCRIPT_DLQ: z.string().min(1).default("variant-script-generate-dlq"),
    VARIANT_SCRIPT_REQUEST_ROUTING_KEY: z.string().min(1).default("variant.script.generate.request"),
    VARIANT_SCRIPT_RESPONSE_ROUTING_KEY: z.string().min(1).default("variant.script.generate.response"),
    VARIANT_SCRIPT_DL_ROUTING_KEY: z.string().min(1).default("variant.script.generate.dlq"),
    VARIANT_SCRIPT_PREFETCH: z.coerce.number().int().min(1).max(100).default(5),
    VARIANT_SCRIPT_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),

    NARRATION_DISABLE_LLM: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    NARRATION_LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
    NARRATION_LLM_MAX_TOKENS: z.coerce
      .number()
      .int()
      .min(1)
      .max(8192)
      .default(4096),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    LANGSMITH_TRACING: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    LANGSMITH_API_KEY: z.string().optional(),
    LANGSMITH_PROJECT: z.string().default("neverstale-workflow-llm"),
  })
  .superRefine((config, context) => {
    const resolvedModel =
      config.LLM_MODEL ?? DEFAULT_MODEL_PER_PROVIDER[config.LLM_PROVIDER];

    if (config.LLM_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPENAI_API_KEY is required when LLM_PROVIDER=openai",
        path: ["OPENAI_API_KEY"],
      });
    }
    if (config.LLM_PROVIDER === "anthropic" && !config.ANTHROPIC_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
        path: ["ANTHROPIC_API_KEY"],
      });
    }
    if (config.LLM_PROVIDER === "google" && !config.GOOGLE_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_API_KEY is required when LLM_PROVIDER=google",
        path: ["GOOGLE_API_KEY"],
      });
    }

    if (!resolvedModel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LLM_MODEL could not be resolved",
        path: ["LLM_MODEL"],
      });
    }

    if (!config.TTS_DISABLE && !config.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "OPENAI_API_KEY is required for narration TTS when TTS_DISABLE=false (independent of LLM_PROVIDER)",
        path: ["OPENAI_API_KEY"],
      });
    }

    if (!config.WHISPER_DISABLE && !config.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "OPENAI_API_KEY is required for narration captions when WHISPER_DISABLE=false (independent of LLM_PROVIDER)",
        path: ["OPENAI_API_KEY"],
      });
    }
  });

const parsedEnvironment = workflowLlmEnvironmentSchema.safeParse({
  ...process.env,
  NARRATION_DISABLE_LLM:
    process.env.NARRATION_DISABLE_LLM ??
    (process.env.NODE_ENV === "test" ? "true" : "false"),
  TTS_DISABLE:
    process.env.TTS_DISABLE ??
    (process.env.NODE_ENV === "test" ? "true" : "false"),
  WHISPER_DISABLE:
    process.env.WHISPER_DISABLE ??
    (process.env.NODE_ENV === "test" ? "true" : "false"),
});

if (!parsedEnvironment.success) {
  const formattedIssues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid llm-ms environment:\n${formattedIssues}`);
}

const rawConfig = parsedEnvironment.data;

export const env = {
  ...rawConfig,
  RESOLVED_LLM_MODEL:
    rawConfig.LLM_MODEL ?? DEFAULT_MODEL_PER_PROVIDER[rawConfig.LLM_PROVIDER],
};

applyLangSmithEnvironment({
  tracing: env.LANGSMITH_TRACING,
  apiKey: env.LANGSMITH_API_KEY,
  project: env.LANGSMITH_PROJECT,
});
