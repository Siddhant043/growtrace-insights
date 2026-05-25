import { z } from "zod";

export const MAX_NARRATION_CAPTION_AUDIO_BASE64_LENGTH = 20_000_000;

export const captionSegmentSchema = z.object({
  text: z.string().min(1).max(5000),
  start: z.number().min(0),
  end: z.number().min(0),
});

export const narrationCaptionRequestSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  audioBase64: z.string().min(1).max(MAX_NARRATION_CAPTION_AUDIO_BASE64_LENGTH),
  contentType: z.literal("audio/mpeg").optional(),
});

export const narrationCaptionResponseSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  segments: z.array(captionSegmentSchema).optional(),
  errorMessage: z.string().optional(),
});

export type CaptionSegment = z.infer<typeof captionSegmentSchema>;
export type NarrationCaptionRequest = z.infer<typeof narrationCaptionRequestSchema>;
export type NarrationCaptionResponse = z.infer<typeof narrationCaptionResponseSchema>;
