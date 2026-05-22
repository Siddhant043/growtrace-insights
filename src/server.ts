import { startWorkflowGenerationConsumer } from "./consumer/workflowGenerationConsumer.js";
import {
  closeRabbitMqResources,
  connectToRabbitMq,
} from "./infrastructure/rabbitmq.js";
import { env } from "./config/env.js";
import { createScopedLogger } from "./utils/logger.js";

const bootLogger = createScopedLogger("server");

const bootstrapWorkflowLlmMicroservice = async (): Promise<void> => {
  const llmSummary = `provider=${env.LLM_PROVIDER} model=${env.RESOLVED_LLM_MODEL}`;

  bootLogger.info(`Starting llm-ms workflow generator (${llmSummary})`, {
    nodeEnv: env.NODE_ENV,
    llmProvider: env.LLM_PROVIDER,
    llmModel: env.RESOLVED_LLM_MODEL,
    langsmithTracing: env.LANGSMITH_TRACING,
    langsmithProject: env.LANGSMITH_PROJECT,
  });

  await connectToRabbitMq();
  await startWorkflowGenerationConsumer();

  bootLogger.info(`llm-ms is running (${llmSummary})`);
};

const handleShutdownSignal = async (signal: NodeJS.Signals): Promise<void> => {
  bootLogger.info("Shutdown signal received", { signal });
  try {
    await closeRabbitMqResources();
  } catch (shutdownError) {
    bootLogger.error("Error during shutdown", {
      error:
        shutdownError instanceof Error
          ? shutdownError.message
          : String(shutdownError),
    });
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", (signal) => {
  void handleShutdownSignal(signal);
});
process.on("SIGINT", (signal) => {
  void handleShutdownSignal(signal);
});

process.on("unhandledRejection", (rejectionReason) => {
  bootLogger.error("Unhandled rejection", {
    error:
      rejectionReason instanceof Error
        ? rejectionReason.message
        : String(rejectionReason),
  });
});

process.on("uncaughtException", (uncaughtError) => {
  bootLogger.error("Uncaught exception", { error: uncaughtError.message });
});

bootstrapWorkflowLlmMicroservice().catch((startupError: unknown) => {
  const errorMessage =
    startupError instanceof Error
      ? startupError.message
      : String(startupError);
  bootLogger.error("Failed to bootstrap llm-ms", { error: errorMessage });
  process.exit(1);
});
