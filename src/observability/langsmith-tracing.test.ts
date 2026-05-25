import { afterEach, describe, expect, it } from "vitest";

import {
  applyLangSmithEnvironment,
  isLangSmithTracingEnabled,
} from "./langsmith-tracing.js";

describe("langsmith-tracing", () => {
  afterEach(() => {
    delete process.env.LANGCHAIN_TRACING_V2;
    delete process.env.LANGCHAIN_API_KEY;
    delete process.env.LANGCHAIN_PROJECT;
    delete process.env.LANGSMITH_API_KEY;
    delete process.env.LANGSMITH_PROJECT;
  });

  it("maps LANGSMITH settings to LangChain tracing env vars", () => {
    applyLangSmithEnvironment({
      tracing: true,
      apiKey: "ls-test-key",
      project: "neverstale-test",
    });

    expect(process.env.LANGCHAIN_TRACING_V2).toBe("true");
    expect(process.env.LANGCHAIN_API_KEY).toBe("ls-test-key");
    expect(process.env.LANGCHAIN_PROJECT).toBe("neverstale-test");
    expect(isLangSmithTracingEnabled()).toBe(true);
  });

  it("does nothing when tracing is disabled", () => {
    applyLangSmithEnvironment({
      tracing: false,
      apiKey: "ls-test-key",
      project: "neverstale-test",
    });

    expect(process.env.LANGCHAIN_TRACING_V2).toBeUndefined();
    expect(isLangSmithTracingEnabled()).toBe(false);
  });
});
