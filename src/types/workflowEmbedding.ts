import { z } from "zod";

export const workflowEmbeddingRequestSchema = z.object({
  jobId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  content: z.string().min(1),
});

export const workflowEmbeddingResponseSchema = z.object({
  jobId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  embedding: z.array(z.number()).optional(),
  model: z.string().optional(),
  errorMessage: z.string().optional(),
  inputTokens: z.number().int().optional(),
  totalTokens: z.number().int().optional(),
});

export type WorkflowEmbeddingRequest = z.infer<typeof workflowEmbeddingRequestSchema>;
export type WorkflowEmbeddingResponse = z.infer<typeof workflowEmbeddingResponseSchema>;
