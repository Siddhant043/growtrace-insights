import { generateWorkflowActionsNode } from "./nodes/generateWorkflowActionsNode.js";
import type { WorkflowGenerationGraphUpdate } from "./state.js";
import type { WorkflowGenerationRequest } from "../types/workflowGeneration.js";

export async function runWorkflowGenerationGraph(
  request: WorkflowGenerationRequest,
): Promise<WorkflowGenerationGraphUpdate> {
  return generateWorkflowActionsNode({
    request,
    generatedActions: [],
  });
}
