import type {
  GeneratedInsight,
  InsightType,
  LlmInsight,
} from "../../types/generatedInsight";
import { computeInsightDeduplicationSignature } from "../../utils/hashSignature";
import { createScopedLogger } from "../../utils/logger";
import type {
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
} from "../state";

const outputLogger = createScopedLogger("graph.outputNode");

const buildGeneratedInsight = (
  state: InsightsWorkflowState,
  rawInsight: LlmInsight,
  insightType: InsightType,
  metadata: Record<string, unknown>,
): GeneratedInsight => {
  const referenceTimestampIso = new Date().toISOString();
  return {
    userId: state.snapshot.userId,
    type: insightType,
    message: rawInsight.message,
    confidence: rawInsight.confidence,
    signature: computeInsightDeduplicationSignature({
      userId: state.snapshot.userId,
      type: insightType,
      message: rawInsight.message,
      referenceTimestampIso,
    }),
    createdAt: new Date(referenceTimestampIso),
    metadata,
  };
};

export const outputNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const generatedInsights: GeneratedInsight[] = [
    ...state.platformLlmInsights.map((rawInsight) =>
      buildGeneratedInsight(state, rawInsight, "platform", {
        flaggedPlatforms: state.flaggedPlatforms,
      }),
    ),
    ...state.contentLlmInsights.map((rawInsight) =>
      buildGeneratedInsight(state, rawInsight, "content", {
        rankedLinks: state.rankedLinks,
      }),
    ),
    ...state.trendLlmInsights.map((rawInsight) =>
      buildGeneratedInsight(state, rawInsight, "trend", {
        trendComparison: state.trendComparison,
      }),
    ),
    ...state.recommendationLlmInsights.map((rawInsight) =>
      buildGeneratedInsight(state, rawInsight, "recommendation", {
        ruleHints: state.ruleHints,
      }),
    ),
  ];

  outputLogger.info("Insights composed", {
    userId: state.snapshot.userId,
    total: generatedInsights.length,
    platform: state.platformLlmInsights.length,
    content: state.contentLlmInsights.length,
    trend: state.trendLlmInsights.length,
    recommendation: state.recommendationLlmInsights.length,
  });

  return {
    generatedInsights,
  };
};
