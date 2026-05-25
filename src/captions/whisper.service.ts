import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import OpenAI from "openai";
import { toFile } from "openai/uploads";

import { env } from "../config/env.js";
import {
  isLangSmithTracingEnabled,
  wrapWithLangSmithTrace,
} from "../observability/langsmith-tracing.js";
import type { CaptionSegment } from "../types/narrationCaption.js";
import type { TranscribeAudioParams } from "./whisper.types.js";

let openAiClient: OpenAI | null = null;

const getOpenAiClient = (): OpenAI => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for Whisper transcription");
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    });
  }

  return openAiClient;
};

const buildStubSegments = (): CaptionSegment[] => [
  { text: "Welcome to the walkthrough.", start: 0, end: 2.5 },
  { text: "Follow each step on screen.", start: 2.5, end: 5 },
];

type WhisperVerboseSegment = {
  start?: number;
  end?: number;
  text?: string;
};

const parseVerboseJsonSegments = (raw: unknown): CaptionSegment[] => {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const segments = (raw as { segments?: WhisperVerboseSegment[] }).segments;
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .map((segment) => ({
      text: segment.text?.trim() ?? "",
      start: segment.start ?? 0,
      end: segment.end ?? 0,
    }))
    .filter((segment) => segment.text.length > 0 && segment.end >= segment.start);
};

const transcribeAudioToSegmentsImpl = async (
  params: TranscribeAudioParams,
): Promise<CaptionSegment[]> => {
  const { audioBuffer } = params;

  if (audioBuffer.length === 0) {
    throw new Error("Audio buffer is empty");
  }

  if (env.WHISPER_DISABLE) {
    return buildStubSegments();
  }

  const tempPath = path.join(tmpdir(), `whisper-${randomUUID()}.mp3`);
  await writeFile(tempPath, audioBuffer);

  try {
    const client = getOpenAiClient();
    const file = await toFile(createReadStream(tempPath), "narration.mp3", {
      type: "audio/mpeg",
    });

    const transcription = await client.audio.transcriptions.create({
      file,
      model: env.WHISPER_MODEL,
      response_format: "verbose_json",
    });

    const segments = parseVerboseJsonSegments(transcription);
    if (segments.length === 0) {
      throw new Error("Whisper returned no timed segments");
    }

    return segments;
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
};

const tracedTranscribeAudioToSegments = wrapWithLangSmithTrace(
  transcribeAudioToSegmentsImpl,
  {
    name: "openai_whisper_transcription",
    run_type: "tool",
    tags: ["narration", "captions", "whisper", "openai"],
    metadata: {
      service: "narration_captions",
      ls_provider: "openai",
      ls_model_name: env.WHISPER_MODEL,
    },
    processInputs: (params) => {
      const typed = params as Readonly<TranscribeAudioParams>;
      return {
        ...(typed.traceContext ?? {}),
        whisperDisabled: env.WHISPER_DISABLE,
        audioBytes: typed.audioBuffer.length,
      };
    },
  },
);

export const transcribeAudioToSegments = async (
  audioBuffer: Buffer,
  traceContext?: TranscribeAudioParams["traceContext"],
): Promise<CaptionSegment[]> => {
  if (isLangSmithTracingEnabled()) {
    return tracedTranscribeAudioToSegments({ audioBuffer, traceContext });
  }

  return transcribeAudioToSegmentsImpl({ audioBuffer, traceContext });
};
