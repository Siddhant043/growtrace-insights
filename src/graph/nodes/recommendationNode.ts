import { llmInsightArraySchema } from "../../types/generatedInsight.js";
import { getChatModel } from "../../llm/chatModelFactory.js";
import { recommendationsPromptTemplate } from "../../llm/prompts/recommendationsPrompt.js";
import { createScopedLogger } from "../../utils/logger.js";
import type {
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
  RecommendationRuleHint,
} from "../state.js";

const recommendationLogger = createScopedLogger("graph.recommendationNode");

const RULE_HINT_TO_TEXT: Record<RecommendationRuleHint, string> = {
  improve_landing_page:
    "Fix landing pages for high-traffic platforms with high bounce—post-click quality is weak",
  post_more_on_top_platform:
    "Scale spend or distribution on the highest-engagement platform—it drives the strongest post-click sessions",
  diagnose_recent_change:
    "Diagnose and address the recent drop in post-click engagement quality",
  double_down_on_top_link:
    "Route more campaign traffic to the top-performing link by engagement score",
  double_down_on_audience_platform:
    "Scale the platform that brings your most engaged returning visitors",
  rescue_at_risk_cohort:
    "Re-engage the at-risk visitor cohort before they churn from your funnel",
  celebrate_loyal_audience:
    "Reward loyal visitor segments to protect repeat conversion and retention",
  warn_low_loyalty_audience:
    "Improve onboarding or offers for first-time visitors with low return rates",
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
  if (
    state.audienceFindings.some(
      (audienceFinding) => audienceFinding.category === "best_users_platform",
    )
  ) {
    ruleHints.push("double_down_on_audience_platform");
  }
  if (
    state.audienceFindings.some(
      (audienceFinding) => audienceFinding.category === "at_risk_cohort",
    )
  ) {
    ruleHints.push("rescue_at_risk_cohort");
  }
  if (
    state.audienceFindings.some(
      (audienceFinding) => audienceFinding.category === "audience_loyalty",
    )
  ) {
    ruleHints.push("celebrate_loyal_audience");
  }
  if (
    state.audienceFindings.some(
      (audienceFinding) => audienceFinding.category === "low_loyalty_warning",
    )
  ) {
    ruleHints.push("warn_low_loyalty_audience");
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

const formatAudienceSignals = (state: InsightsWorkflowState): string => {
  if (state.audienceFindings.length === 0) return "(none)";
  return state.audienceFindings
    .map(
      (audienceFinding) =>
        `- ${audienceFinding.category}: ${audienceFinding.message}`,
    )
    .join("\n");
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
    audienceSignalsBulleted: formatAudienceSignals(state),
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
