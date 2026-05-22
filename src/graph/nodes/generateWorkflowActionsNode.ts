import { getChatModel } from "../../llm/chatModelFactory.js";
import { workflowActionsPromptTemplate } from "../../llm/prompts/workflowActionsPrompt.js";
import { createScopedLogger } from "../../utils/logger.js";
import {
  workflowGenerationLlmOutputSchema,
  type WorkflowGenerationAction,
  type WorkflowGenerationLlmAction,
} from "../../types/workflowGeneration.js";
import type {
  WorkflowGenerationGraphState,
  WorkflowGenerationGraphUpdate,
} from "../state.js";

const generateLogger = createScopedLogger("graph.generateWorkflowActions");

function mapLlmActionToWorkflowAction(
  action: WorkflowGenerationLlmAction,
): WorkflowGenerationAction {
  return {
    order: action.order,
    type: action.type,
    selector: action.selector ?? null,
    value: action.value ?? null,
  };
}

function normalizeActionOrders(
  actions: WorkflowGenerationAction[],
): WorkflowGenerationAction[] {
  return actions
    .slice()
    .sort((first, second) => first.order - second.order)
    .map((action, index) => ({
      ...action,
      order: index,
    }));
}

export const generateWorkflowActionsNode = async (
  state: WorkflowGenerationGraphState,
): Promise<WorkflowGenerationGraphUpdate> => {
  const { request } = state;
  const structuredModel = getChatModel().withStructuredOutput(
    workflowGenerationLlmOutputSchema,
  );

  const promptValue = await workflowActionsPromptTemplate.invoke({
    workflowName: request.name,
    workflowDescription: request.description,
    baseUrl: request.baseUrl,
    loginUrl: request.loginUrl ?? "(none — use base URL)",
    hasBrowserSession: request.hasBrowserSession ? "yes" : "no",
  });

  try {
    const llmOutput = await structuredModel.invoke(promptValue);
    const normalizedActions = normalizeActionOrders(
      llmOutput.actions.map(mapLlmActionToWorkflowAction),
    );

    generateLogger.info("Workflow actions generated", {
      workflowId: request.workflowId,
      actionCount: normalizedActions.length,
    });

    return { generatedActions: normalizedActions };
  } catch (generationError) {
    const errorMessage =
      generationError instanceof Error
        ? generationError.message
        : String(generationError);

    generateLogger.error("Failed to generate workflow actions", {
      workflowId: request.workflowId,
      error: errorMessage,
    });

    return { errorMessage };
  }
};
