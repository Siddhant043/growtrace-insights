import type { WorkflowGenerationAction, WorkflowGenerationRequest } from "../types/workflowGeneration.js";

export type WorkflowGenerationGraphState = {
  request: WorkflowGenerationRequest;
  generatedActions: WorkflowGenerationAction[];
  errorMessage?: string;
};

export type WorkflowGenerationGraphUpdate = Partial<WorkflowGenerationGraphState>;
