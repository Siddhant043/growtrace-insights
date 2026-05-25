import { z } from "zod";

export const narrationActionInputSchema = z.object({
  order: z.number().int().min(0),
  type: z.string().min(1),
  targetLabel: z.string().min(1),
  value: z.string().nullable().optional(),
  timestampSeconds: z.number().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
});

export const narrationGenerationContextSchema = z.object({
  workflowName: z.string().min(1),
  workflowDescription: z.string(),
  projectName: z.string().min(1),
  baseUrl: z.string().url(),
  actions: z.array(narrationActionInputSchema).min(1),
});

export const narrationLineResultSchema = z.object({
  order: z.number().int().min(0),
  line: z.string().min(1).max(2000),
  title: z.string().max(200).optional(),
});

export const narrationScriptResultSchema = z.object({
  intro: z.string().max(2000).optional(),
  lines: z.array(narrationLineResultSchema).min(1),
});

export const narrationGenerationRequestSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  context: narrationGenerationContextSchema,
});

export const narrationGenerationResponseSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  script: narrationScriptResultSchema.optional(),
  errorMessage: z.string().optional(),
});

export type NarrationActionInput = z.infer<typeof narrationActionInputSchema>;
export type NarrationGenerationContext = z.infer<
  typeof narrationGenerationContextSchema
>;
export type NarrationLineResult = z.infer<typeof narrationLineResultSchema>;
export type NarrationScriptResult = z.infer<typeof narrationScriptResultSchema>;
export type NarrationGenerationRequest = z.infer<
  typeof narrationGenerationRequestSchema
>;
export type NarrationGenerationResponse = z.infer<
  typeof narrationGenerationResponseSchema
>;
