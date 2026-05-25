import { traceable } from "langsmith/traceable";
import type { TraceableConfig } from "langsmith/traceable";

export type LangSmithEnvironmentConfig = {
  tracing: boolean;
  apiKey?: string;
  project: string;
};

/**
 * Maps llm-ms LANGSMITH_* settings to LangChain/LangSmith env vars so
 * @langchain/* chat models and traceable() spans export to LangSmith.
 */
export function applyLangSmithEnvironment(
  config: LangSmithEnvironmentConfig,
): void {
  if (!config.tracing) {
    return;
  }

  process.env.LANGCHAIN_TRACING_V2 = "true";
  process.env.LANGCHAIN_PROJECT = config.project;
  process.env.LANGSMITH_PROJECT = config.project;

  if (config.apiKey) {
    process.env.LANGCHAIN_API_KEY = config.apiKey;
    process.env.LANGSMITH_API_KEY = config.apiKey;
  }
}

export function isLangSmithTracingEnabled(): boolean {
  return (
    process.env.LANGCHAIN_TRACING_V2 === "true" &&
    Boolean(process.env.LANGCHAIN_API_KEY ?? process.env.LANGSMITH_API_KEY)
  );
}

export function wrapWithLangSmithTrace<Func extends (...args: never[]) => unknown>(
  functionToTrace: Func,
  traceConfig: TraceableConfig<Func>,
): Func {
  if (!isLangSmithTracingEnabled()) {
    return functionToTrace;
  }

  return traceable(functionToTrace, traceConfig) as Func;
}
