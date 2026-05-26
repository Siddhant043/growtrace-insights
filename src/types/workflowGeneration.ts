import { z } from "zod";

export const WORKFLOW_ACTION_TYPES = [
  "NAVIGATE",
  "CLICK",
  "TYPE",
  "HOVER",
  "SCROLL",
  "WAIT",
  "ASSERT",
] as const;

export const workflowGenerationStructuredSelectorSchema = z
  .object({
    strategy: z.enum(["role", "label", "text", "testId", "css", "xpath"]),
    scope: z.enum(["page", "dialog"]).optional(),
    exact: z.boolean().optional(),
    role: z.string().optional(),
    name: z.string().optional(),
    label: z.string().optional(),
    text: z.string().optional(),
    testId: z.string().optional(),
    css: z.string().optional(),
    xpath: z.string().optional(),
  })
  .nullable()
  .optional();

const workflowGenerationSelectorObjectSchema = z.object({
  strategy: z.enum(["role", "label", "text", "testId", "css", "xpath"]),
  scope: z.enum(["page", "dialog"]).optional(),
  exact: z.boolean().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  text: z.string().optional(),
  testId: z.string().optional(),
  css: z.string().optional(),
  xpath: z.string().optional(),
});

export const workflowGenerationActionSchema = z.object({
  order: z.number().int().min(0),
  type: z.enum(WORKFLOW_ACTION_TYPES),
  selector: workflowGenerationStructuredSelectorSchema,
  value: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * Schema passed to withStructuredOutput. Avoids z.record / nullable unions that
 * Gemini rejects (e.g. JSON Schema "propertyNames" and some anyOf shapes).
 */
export const workflowGenerationLlmActionSchema = z.object({
  order: z.number().int().min(0),
  type: z.enum(WORKFLOW_ACTION_TYPES),
  selector: workflowGenerationSelectorObjectSchema.optional(),
  value: z.string().optional(),
});

export const workflowGroundingElementSchema = z.object({
  role: z.string(),
  name: z.string().nullable(),
  category: z.string(),
});

export const workflowGroundingExecutionStepSchema = z.object({
  order: z.number().int().min(0),
  action: z.string(),
  status: z.string(),
  selectorSummary: z.string().nullable().optional(),
});

export const workflowGroundingPayloadSchema = z.object({
  sourceWorkflowRunId: z.string().min(1),
  pageUrl: z.string(),
  routes: z.array(z.string()),
  domSummary: z.string(),
  prioritizedElements: z.array(workflowGroundingElementSchema),
  executionHistory: z.array(workflowGroundingExecutionStepSchema),
  latestScreenshotUrl: z.string().nullable().optional(),
  latestStepOrder: z.number().int().nullable().optional(),
});

export const workflowGenerationRequestSchema = z.object({
  jobId: z.string().min(1),
  workflowId: z.string().min(1),
  projectId: z.string().min(1),
  userId: z.string().min(1),
  description: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  hasBrowserSession: z.boolean(),
  loginUrl: z.string().url().optional(),
  grounding: workflowGroundingPayloadSchema.optional(),
});

export const workflowGenerationResponseSchema = z.object({
  jobId: z.string().min(1),
  workflowId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  actions: z.array(workflowGenerationActionSchema).optional(),
  errorMessage: z.string().optional(),
});

export const workflowGenerationLlmOutputSchema = z.object({
  actions: z.array(workflowGenerationLlmActionSchema).min(1),
});

export type WorkflowGenerationLlmAction = z.infer<
  typeof workflowGenerationLlmActionSchema
>;

export type WorkflowGenerationRequest = z.infer<
  typeof workflowGenerationRequestSchema
>;
export type WorkflowGenerationResponse = z.infer<
  typeof workflowGenerationResponseSchema
>;
export type WorkflowGenerationAction = z.infer<
  typeof workflowGenerationActionSchema
>;
export type WorkflowGroundingPayload = z.infer<
  typeof workflowGroundingPayloadSchema
>;
