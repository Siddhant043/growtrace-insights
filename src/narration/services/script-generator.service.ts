import { z } from "zod";

import { env } from "../../config/env.js";
import { narrationScriptPromptTemplate } from "../prompts/narration-script.prompt.js";
import type {
  NarrationActionInput,
  NarrationGenerationContext,
  NarrationScriptResult,
} from "../../types/narrationGeneration.js";
import { getNarrationChatModel } from "../../llm/chatModelFactory.js";

const WORKFLOW_ACTION_TYPES = {
  NAVIGATE: "NAVIGATE",
  CLICK: "CLICK",
  TYPE: "TYPE",
  HOVER: "HOVER",
  SCROLL: "SCROLL",
  WAIT: "WAIT",
  ASSERT: "ASSERT",
} as const;

const narrationLineSchema = z.object({
  order: z.number().int().min(0),
  line: z.string().min(1).max(2000),
  title: z.string().max(200).optional(),
});

const narrationScriptOutputSchema = z.object({
  intro: z.string().max(2000).optional(),
  lines: z.array(narrationLineSchema).min(1),
});

function buildTemplateLine(action: NarrationActionInput): string {
  const target = action.targetLabel;

  switch (action.type) {
    case WORKFLOW_ACTION_TYPES.NAVIGATE:
      return action.value
        ? `Navigate to ${action.value} to continue the walkthrough.`
        : `Open ${target} to continue the walkthrough.`;
    case WORKFLOW_ACTION_TYPES.CLICK:
      return `Click ${target} to continue.`;
    case WORKFLOW_ACTION_TYPES.TYPE:
      return `Enter text in ${target}.`;
    case WORKFLOW_ACTION_TYPES.HOVER:
      return `Hover over ${target}.`;
    case WORKFLOW_ACTION_TYPES.SCROLL:
      return `Scroll the page to reveal more content.`;
    case WORKFLOW_ACTION_TYPES.WAIT:
      return `Wait briefly for the page to update.`;
    case WORKFLOW_ACTION_TYPES.ASSERT:
      return `Confirm that ${target} is visible.`;
    default:
      return `Complete the ${action.type.toLowerCase()} step on ${target}.`;
  }
}

function generateTemplateScript(
  context: NarrationGenerationContext,
): NarrationScriptResult {
  const intro = `Welcome to ${context.workflowName}.`;

  const lines = context.actions.map((action) => ({
    order: action.order,
    line: buildTemplateLine(action),
    title: action.targetLabel,
  }));

  return { intro, lines };
}

function normalizeScriptResult(
  context: NarrationGenerationContext,
  result: NarrationScriptResult,
): NarrationScriptResult {
  const lineByOrder = new Map(
    result.lines.map((line) => [line.order, line]),
  );

  const lines = context.actions.map((action) => {
    const existing = lineByOrder.get(action.order);
    if (existing) {
      return existing;
    }
    return {
      order: action.order,
      line: buildTemplateLine(action),
      title: action.targetLabel,
    };
  });

  return {
    intro: result.intro,
    lines,
  };
}

export const generateNarrationScript = async (
  context: NarrationGenerationContext,
): Promise<NarrationScriptResult> => {
  if (context.actions.length === 0) {
    return { lines: [] };
  }

  if (env.NARRATION_DISABLE_LLM) {
    return generateTemplateScript(context);
  }

  const structuredModel = getNarrationChatModel().withStructuredOutput(
    narrationScriptOutputSchema,
  );

  const promptValue = await narrationScriptPromptTemplate.invoke({
    workflowName: context.workflowName,
    workflowDescription: context.workflowDescription,
    projectName: context.projectName,
    baseUrl: context.baseUrl,
    actionsJson: JSON.stringify(context.actions, null, 2),
  });

  const output = await structuredModel.invoke(promptValue);
  return normalizeScriptResult(context, output);
};
