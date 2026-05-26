import type { WorkflowGroundingPayload } from "../../types/workflowGeneration.js";

function formatPrioritizedElements(
  elements: WorkflowGroundingPayload["prioritizedElements"],
): string {
  if (elements.length === 0) {
    return "(none)";
  }
  return elements
    .map((element) => {
      const label = element.name ? `"${element.name}"` : "(unnamed)";
      return `- [${element.category}] role=${element.role} name=${label}`;
    })
    .join("\n");
}

function formatExecutionHistory(
  steps: WorkflowGroundingPayload["executionHistory"],
): string {
  if (steps.length === 0) {
    return "(none)";
  }
  return steps
    .map((step) => {
      const selectorPart = step.selectorSummary
        ? ` selector=${step.selectorSummary}`
        : "";
      return `- step ${step.order}: ${step.action} (${step.status})${selectorPart}`;
    })
    .join("\n");
}

export function formatWorkflowGroundingBlock(
  grounding: WorkflowGroundingPayload | undefined,
): string {
  if (!grounding) {
    return "";
  }

  const routes =
    grounding.routes.length > 0
      ? grounding.routes.join(", ")
      : "(none captured)";
  const screenshotNote =
    grounding.latestScreenshotUrl && grounding.latestStepOrder != null
      ? `Last successful UI capture at step ${grounding.latestStepOrder} (reference only; do not invent elements not listed below).`
      : "No screenshot reference from the last run.";

  return `--- Grounding from latest completed workflow run ---
Source run: ${grounding.sourceWorkflowRunId}
Page URL: ${grounding.pageUrl || "(unknown)"}
Routes seen: ${routes}

Prioritized interactive elements (prefer role/label selectors matching these names):
${formatPrioritizedElements(grounding.prioritizedElements)}

DOM structure summary:
${grounding.domSummary || "(empty)"}

Execution history from last run:
${formatExecutionHistory(grounding.executionHistory)}

Screenshot: ${screenshotNote}
--- End grounding ---`;
}
