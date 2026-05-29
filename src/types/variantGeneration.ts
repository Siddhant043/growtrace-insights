import { z } from "zod";

export const VideoVariantAudienceSchema = z.enum([
  "SALES",
  "ONBOARDING",
  "SUPPORT",
  "TRAINING",
]);
export type VideoVariantAudience = z.infer<typeof VideoVariantAudienceSchema>;

export const variantScriptGenerateRequestSchema = z.object({
  variantId:    z.string(),
  videoId:      z.string(),
  workflowId:   z.string(),
  audience:     VideoVariantAudienceSchema,
  baseScript:   z.string(),
  workflowName: z.string(),
  projectName:  z.string(),
  baseUrl:      z.string(),
  scenes: z.array(
    z.object({
      sceneOrder:    z.number(),
      title:         z.string().nullable(),
      narrationText: z.string().nullable(),
      startTimeMs:   z.number().nullable(),
      endTimeMs:     z.number().nullable(),
    })
  ),
  grounding: z
    .object({
      recentChangesSummary: z.string().optional(),
    })
    .optional(),
});

export type VariantScriptGenerateRequest = z.infer<
  typeof variantScriptGenerateRequestSchema
>;

export const variantScriptGenerateResponseSchema = z.object({
  variantId:    z.string(),
  videoId:      z.string(),
  success:      z.boolean(),
  errorMessage: z.string().optional(),
  fullScript:   z.string().optional(),
  scenes: z
    .array(
      z.object({
        sceneOrder:    z.number(),
        title:         z.string(),
        narrationText: z.string(),
      })
    )
    .optional(),
});

export type VariantScriptGenerateResponse = z.infer<
  typeof variantScriptGenerateResponseSchema
>;
