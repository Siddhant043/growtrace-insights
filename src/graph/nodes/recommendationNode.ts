import { llmInsightArraySchema } from "../../types/generatedInsight";
import { getChatModel } from "../../llm/chatModelFactory";
import { recommendationsPromptTemplate } from "../../llm/prompts/recommendationsPrompt";
import { createScopedLogger } from "../../utils/logger";
import type {
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
  RecommendationRuleHint,
} from "../state";

const recommendationLogger = createScopedLogger("graph.recommendationNode");

const RULE_HINT_TO_TEXT: Record<RecommendationRuleHint, string> = {
  improve_landing_page:
    "Improve the landing page experience for high-traffic but high-bounce platforms",
  post_more_on_top_platform:
    "Post more frequently on the highest-engagement platform",
  diagnose_recent_change:
    "Diagnose and address the recent engagement drop",
  double_down_on_top_link:
    "Promote the top-performing link in additional channels",
};

const deriveRuleHints = (
  state: InsightsWorkflowState,
): RecommendationRuleHint[] => {
  const ruleHints: RecommendationRuleHint[] = [];

  if (
    state.flaggedPlatforms.some(
      (platformSignal) => platformSignal.flag === "low_quality_traffic",
    )
  ) {
    ruleHints.push("improve_landing_page");
  }
  if (
    state.flaggedPlatforms.some(
      (platformSignal) => platformSignal.flag === "top_quality_platform",
    )
  ) {
    ruleHints.push("post_more_on_top_platform");
  }
  if (state.trendComparison?.direction === "down") {
    ruleHints.push("diagnose_recent_change");
  }
  if (
    state.rankedLinks.some(
      (rankedLinkRow) => rankedLinkRow.rankBucket === "top",
    )
  ) {
    ruleHints.push("double_down_on_top_link");
  }
  return ruleHints;
};

const formatPlatformSignals = (
  state: InsightsWorkflowState,
): string => {
  if (state.flaggedPlatforms.length === 0) return "(none)";
  return state.flaggedPlatforms
    .map(
      (platformSignal) =>
        `- ${platformSignal.platform} -> ${platformSignal.flag}`,
    )
    .join("\n");
};

const formatContentSignals = (
  state: InsightsWorkflowState,
): string => {
  if (state.rankedLinks.length === 0) return "(none)";
  return state.rankedLinks
    .map(
      (rankedLinkRow) =>
        `- ${rankedLinkRow.shortCode ?? rankedLinkRow.linkId} (${rankedLinkRow.rankBucket}) engagement=${rankedLinkRow.engagementScore.toFixed(1)}`,
    )
    .join("\n");
};

const formatTrendSignal = (state: InsightsWorkflowState): string => {
  if (!state.trendComparison) return "(insufficient sample)";
  const { direction, percentChange, sampleDays } = state.trendComparison;
  const formattedPercent =
    percentChange === null ? "n/a" : `${percentChange.toFixed(1)}%`;
  return `direction=${direction}, change=${formattedPercent}, sampleDays=${sampleDays}`;
};

export const recommendationNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const ruleHints = deriveRuleHints(state);

  if (ruleHints.length === 0) {
    recommendationLogger.debug(
      "No rule hints derived; skipping recommendation LLM call",
    );
    return { ruleHints: [], recommendationLlmInsights: [] };
  }

  const structuredModel = getChatModel().withStructuredOutput(
    llmInsightArraySchema,
  );

  const ruleHintsBulleted = ruleHints
    .map((ruleHint) => `- ${RULE_HINT_TO_TEXT[ruleHint]}`)
    .join("\n");

  const promptValue = await recommendationsPromptTemplate.invoke({
    windowDays: state.snapshot.windowDays,
    platformSignalsBulleted: formatPlatformSignals(state),
    contentSignalsBulleted: formatContentSignals(state),
    trendSignalLine: formatTrendSignal(state),
    ruleHintsBulleted,
  });

  const llmGeneratedInsights = await structuredModel.invoke(promptValue);

  recommendationLogger.info("Recommendations generated", {
    ruleHints,
    insightCount: llmGeneratedInsights.length,
  });

  return {
    ruleHints,
    recommendationLlmInsights: llmGeneratedInsights,
  };
};
