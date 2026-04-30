import { startInsightsQueueConsumer } from "./consumer/insightsQueueConsumer";
import {
  closeRabbitMqResources,
  connectToRabbitMq,
} from "./infrastructure/rabbitmq";
import {
  connectToInsightsDatabase,
  disconnectFromInsightsDatabase,
} from "./infrastructure/mongo";
import { env } from "./config/env";
import { createScopedLogger } from "./utils/logger";

const bootLogger = createScopedLogger("server");

const bootstrapInsightsMicroservice = async (): Promise<void> => {
  bootLogger.info("Starting insights-ms", {
    nodeEnv: env.NODE_ENV,
    llmProvider: env.LLM_PROVIDER,
    llmModel: env.RESOLVED_LLM_MODEL,
  });

  await connectToInsightsDatabase();
  await connectToRabbitMq();
  await startInsightsQueueConsumer();

  bootLogger.info("insights-ms is running");
};

const handleShutdownSignal = async (signal: NodeJS.Signals): Promise<void> => {
  bootLogger.info("Shutdown signal received", { signal });
  try {
    await closeRabbitMqResources();
    await disconnectFromInsightsDatabase();
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

bootstrapInsightsMicroservice().catch((startupError: unknown) => {
  const errorMessage =
    startupError instanceof Error
      ? startupError.message
      : String(startupError);
  bootLogger.error("Failed to bootstrap insights-ms", { error: errorMessage });
  process.exit(1);
});
