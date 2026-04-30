import { config as loadDotenvFile } from "dotenv";
import { z } from "zod";

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
  google: "gemini-1.5-flash",
  ollama: "llama3.1:8b",
};

const insightsRuntimeEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    MONGO_URI: z.string().min(1, "MONGO_URI is required"),
    MONGO_USER: z.string().min(1, "MONGO_USER is required"),
    MONGO_PASSWORD: z.string().min(1, "MONGO_PASSWORD is required"),
    MONGO_DB: z.string().min(1, "MONGO_DB is required"),

    RABBITMQ_URL: z.string().url("RABBITMQ_URL must be a valid URL").optional(),
    RABBITMQ_PORT: z.coerce.number().int().min(1).max(65535).default(5672),
    RABBITMQ_HOST: z.string().min(1).default("localhost"),
    RABBITMQ_DEFAULT_USER: z.string().min(1).default("guest"),
    RABBITMQ_DEFAULT_PASS: z.string().min(1).default("guest"),

    LLM_PROVIDER: z.enum(SUPPORTED_LLM_PROVIDERS).default("google"),
    LLM_MODEL: z.string().trim().min(1).optional(),
    LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
    LLM_MAX_TOKENS: z.coerce.number().int().min(1).max(8192).default(512),
    LLM_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(120000)
      .default(30000),

    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z.string().url().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_API_KEY: z.string().optional(),
    OLLAMA_BASE_URL: z
      .string()
      .url("OLLAMA_BASE_URL must be a valid URL")
      .default("http://localhost:11434"),

    INSIGHTS_EXCHANGE: z.string().min(1).default("analytics_exchange"),
    INSIGHTS_QUEUE: z.string().min(1).default("ai_insights_queue"),
    INSIGHTS_DEAD_LETTER_EXCHANGE: z.string().min(1).default("ai_insights_dlx"),
    INSIGHTS_DEAD_LETTER_QUEUE: z.string().min(1).default("ai_insights_dlq"),
    INSIGHTS_DEAD_LETTER_ROUTING_KEY: z
      .string()
      .min(1)
      .default("ai_insights_dead"),
    INSIGHTS_ROUTING_KEY: z.string().min(1).default("generate_insights"),
    INSIGHTS_PREFETCH: z.coerce.number().int().min(1).max(100).default(1),
    INSIGHTS_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
    INSIGHTS_RETRY_BACKOFF_MS: z.coerce
      .number()
      .int()
      .min(0)
      .max(60000)
      .default(750),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((parsedEnvironment, validationContext) => {
    const provider = parsedEnvironment.LLM_PROVIDER;
    if (provider === "openai" && !parsedEnvironment.OPENAI_API_KEY) {
      validationContext.addIssue({
        code: "custom",
        message: "OPENAI_API_KEY is required when LLM_PROVIDER=openai",
        path: ["OPENAI_API_KEY"],
      });
    }
    if (provider === "anthropic" && !parsedEnvironment.ANTHROPIC_API_KEY) {
      validationContext.addIssue({
        code: "custom",
        message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
        path: ["ANTHROPIC_API_KEY"],
      });
    }
    if (provider === "google" && !parsedEnvironment.GOOGLE_API_KEY) {
      validationContext.addIssue({
        code: "custom",
        message: "GOOGLE_API_KEY is required when LLM_PROVIDER=google",
        path: ["GOOGLE_API_KEY"],
      });
    }
  });

const parsedRuntimeEnvironment = insightsRuntimeEnvironmentSchema.safeParse(
  process.env,
);

if (!parsedRuntimeEnvironment.success) {
  throw new Error(
    `Invalid environment variables for insights-ms: ${JSON.stringify(
      parsedRuntimeEnvironment.error.format(),
      null,
      2,
    )}`,
  );
}

const validatedEnvironment = parsedRuntimeEnvironment.data;

export const env = {
  ...validatedEnvironment,
  RESOLVED_LLM_MODEL:
    validatedEnvironment.LLM_MODEL ??
    DEFAULT_MODEL_PER_PROVIDER[validatedEnvironment.LLM_PROVIDER],
} as const;

export type InsightsRuntimeEnvironment = typeof env;
