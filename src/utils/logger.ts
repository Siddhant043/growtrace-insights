import { env } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minimumPrintablePriority = LOG_LEVEL_PRIORITY[env.LOG_LEVEL];

const shouldEmitLevel = (candidateLevel: LogLevel): boolean =>
  LOG_LEVEL_PRIORITY[candidateLevel] >= minimumPrintablePriority;

type LogContext = Record<string, unknown> | undefined;

const formatLogLine = (
  scope: string,
  message: string,
  context: LogContext,
): string => {
  const baseLine = `[${scope}] ${message}`;
  if (!context || Object.keys(context).length === 0) {
    return baseLine;
  }
  return `${baseLine} ${JSON.stringify(context)}`;
};

export const createScopedLogger = (scope: string) => ({
  debug: (message: string, context?: LogContext) => {
    if (!shouldEmitLevel("debug")) return;
    console.debug(formatLogLine(scope, message, context));
  },
  info: (message: string, context?: LogContext) => {
    if (!shouldEmitLevel("info")) return;
    console.info(formatLogLine(scope, message, context));
  },
  warn: (message: string, context?: LogContext) => {
    if (!shouldEmitLevel("warn")) return;
    console.warn(formatLogLine(scope, message, context));
  },
  error: (message: string, context?: LogContext) => {
    if (!shouldEmitLevel("error")) return;
    console.error(formatLogLine(scope, message, context));
  },
});

export type ScopedLogger = ReturnType<typeof createScopedLogger>;
