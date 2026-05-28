import type {
  WorkflowGroundingHealingEntry,
  WorkflowGroundingPayload,
  WorkflowGroundingRunOutcome,
} from "../../types/workflowGeneration.js";

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

function formatHealingHistory(entries: WorkflowGroundingHealingEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map(
    (e) =>
      `  - Step ${e.stepOrder}: selector changed to "${e.appliedSelector}" (confidence: ${(e.confidence * 100).toFixed(0)}%)` +
      (e.originalSelector ? ` [was: "${e.originalSelector}"]` : ""),
  );
  return `\n## Healed Selectors (applied fixes — prefer these patterns)\n${lines.join("\n")}`;
}

function formatRunOutcomeSummary(summary: WorkflowGroundingRunOutcome): string {
  const rate =
    summary.totalRuns > 0
      ? ((summary.successCount / summary.totalRuns) * 100).toFixed(0)
      : "0";
  const durationNote =
    summary.averageDurationMs != null
      ? ` Avg duration: ${(summary.averageDurationMs / 1000).toFixed(1)}s.`
      : "";
  const failNote =
    summary.commonFailureStepOrders.length > 0
      ? ` Steps most likely to fail: ${summary.commonFailureStepOrders.join(", ")}.`
      : "";
  return `\n## Run Outcome Summary (last ${summary.totalRuns} runs)\nSuccess rate: ${rate}%.${durationNote}${failNote}`;
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

  let output = `--- Grounding from latest completed workflow run ---
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

  if (grounding.healingHistory?.length) {
    output += formatHealingHistory(grounding.healingHistory);
  }
  if (grounding.runOutcomeSummary) {
    output += formatRunOutcomeSummary(grounding.runOutcomeSummary);
  }

  return output;
}
