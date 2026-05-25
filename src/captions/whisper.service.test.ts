import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/env.js")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      WHISPER_DISABLE: true,
      OPENAI_API_KEY: undefined,
    },
  };
});

describe("whisper.service", () => {
  let transcribeAudioToSegments: typeof import("./whisper.service.js").transcribeAudioToSegments;

  beforeAll(async () => {
    const module = await import("./whisper.service.js");
    transcribeAudioToSegments = module.transcribeAudioToSegments;
  });

  it("returns stub segments when WHISPER_DISABLE is enabled", async () => {
    const segments = await transcribeAudioToSegments(Buffer.from("fake-audio"));
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0]?.text).toBeTruthy();
    expect(segments[0]?.end).toBeGreaterThan(segments[0]?.start ?? 0);
  });
});
