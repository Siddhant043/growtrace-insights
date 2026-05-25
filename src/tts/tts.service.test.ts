import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/env.js")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      TTS_DISABLE: true,
      OPENAI_API_KEY: undefined,
    },
  };
});

describe("tts.service", () => {
  let synthesizeSpeechToMp3: typeof import("./tts.service.js").synthesizeSpeechToMp3;

  beforeAll(async () => {
    const module = await import("./tts.service.js");
    synthesizeSpeechToMp3 = module.synthesizeSpeechToMp3;
  });

  it("returns stub MP3 bytes when TTS_DISABLE is enabled", async () => {
    const buffer = await synthesizeSpeechToMp3("Hello narration world");
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 3).toString()).toBe("ID3");
  });
});
