import { z } from "zod";

export const MAX_NARRATION_TTS_SCRIPT_LENGTH = 100_000;

export const narrationTtsRequestSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  narrationScript: z.string().min(1).max(MAX_NARRATION_TTS_SCRIPT_LENGTH),
});

export const narrationTtsResponseSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  audioBase64: z.string().optional(),
  contentType: z.literal("audio/mpeg").optional(),
  errorMessage: z.string().optional(),
});

export type NarrationTtsRequest = z.infer<typeof narrationTtsRequestSchema>;
export type NarrationTtsResponse = z.infer<typeof narrationTtsResponseSchema>;
