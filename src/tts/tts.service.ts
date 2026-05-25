import OpenAI from "openai";

import { env } from "../config/env.js";
import {
  isLangSmithTracingEnabled,
  wrapWithLangSmithTrace,
} from "../observability/langsmith-tracing.js";
import type { SynthesizeSpeechParams } from "./tts.types.js";

const TTS_STUB_MP3_HEADER = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

let openAiClient: OpenAI | null = null;

const getOpenAiClient = (): OpenAI => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for text-to-speech");
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  return openAiClient;
};

const synthesizeSpeechToMp3Impl = async (
  params: SynthesizeSpeechParams,
): Promise<Buffer> => {
  const trimmed = params.text.trim();
  if (!trimmed) {
    throw new Error("Narration script is empty");
  }

  if (env.TTS_DISABLE) {
    return Buffer.concat([
      TTS_STUB_MP3_HEADER,
      Buffer.from(trimmed.slice(0, 256), "utf-8"),
    ]);
  }

  const client = getOpenAiClient();
  const response = await client.audio.speech.create({
    model: env.TTS_MODEL,
    voice: env.TTS_VOICE as OpenAI.Audio.SpeechCreateParams["voice"],
    input: trimmed,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const tracedSynthesizeSpeechToMp3 = wrapWithLangSmithTrace(
  synthesizeSpeechToMp3Impl,
  {
    name: "openai_tts_speech_create",
    run_type: "tool",
    tags: ["narration", "tts", "openai"],
    metadata: {
      service: "narration_tts",
      ls_provider: "openai",
      ls_model_name: env.TTS_MODEL,
    },
    processInputs: (params) => {
      const typed = params as Readonly<SynthesizeSpeechParams>;
      const trimmed = typed.text.trim();
      return {
        ...(typed.traceContext ?? {}),
        ttsVoice: env.TTS_VOICE,
        ttsDisabled: env.TTS_DISABLE,
        inputLength: trimmed.length,
        inputPreview: trimmed.slice(0, 200),
      };
    },
  },
);

export const synthesizeSpeechToMp3 = async (
  text: string,
  traceContext?: SynthesizeSpeechParams["traceContext"],
): Promise<Buffer> => {
  if (isLangSmithTracingEnabled()) {
    return tracedSynthesizeSpeechToMp3({ text, traceContext });
  }

  return synthesizeSpeechToMp3Impl({ text, traceContext });
};
