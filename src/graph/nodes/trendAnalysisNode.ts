import { llmInsightArraySchema } from "../../types/generatedInsight";
import { getChatModel } from "../../llm/chatModelFactory";
import { trendInsightsPromptTemplate } from "../../llm/prompts/trendInsightsPrompt";
import { createScopedLogger } from "../../utils/logger";
import type {
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
  TrendComparison,
} from "../state";

const trendLogger = createScopedLogger("graph.trendAnalysisNode");

const MIN_TREND_SAMPLE_DAYS = 4;
const MEANINGFUL_PERCENT_CHANGE_THRESHOLD = 10;

const computeAverageEngagementScore = (
  trendSlice: InsightsWorkflowState["snapshot"]["trendMetrics"],
): number => {
  if (trendSlice.length === 0) return 0;
  const sumOfScores = trendSlice.reduce(
    (accumulator, datum) => accumulator + datum.engagementScore,
    0,
  );
  return sumOfScores / trendSlice.length;
};

export const trendAnalysisNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const { trendMetrics } = state.snapshot;

  if (trendMetrics.length < MIN_TREND_SAMPLE_DAYS) {
    trendLogger.debug("Trend sample too small; skipping LLM call", {
      sampleDays: trendMetrics.length,
    });
    return { trendComparison: null, trendLlmInsights: [] };
  }

  const sortedByDateAscending = [...trendMetrics].sort(
    (firstDatum, secondDatum) =>
      firstDatum.date < secondDatum.date ? -1 : 1,
  );
  const halfwayBoundaryIndex = Math.floor(sortedByDateAscending.length / 2);
  const previousHalf = sortedByDateAscending.slice(0, halfwayBoundaryIndex);
  const recentHalf = sortedByDateAscending.slice(halfwayBoundaryIndex);

  const previousAverageEngagementScore =
    computeAverageEngagementScore(previousHalf);
  const recentAverageEngagementScore =
    computeAverageEngagementScore(recentHalf);

  let percentChange: number | null = null;
  if (previousAverageEngagementScore > 0) {
    percentChange =
      ((recentAverageEngagementScore - previousAverageEngagementScore) /
        previousAverageEngagementScore) *
      100;
  }

  const direction: TrendComparison["direction"] = (() => {
    if (percentChange === null) return "stable";
    if (Math.abs(percentChange) < MEANINGFUL_PERCENT_CHANGE_THRESHOLD)
      return "stable";
    return percentChange > 0 ? "up" : "down";
  })();

  const trendComparison: TrendComparison = {
    recentAverageEngagementScore,
    previousAverageEngagementScore,
    percentChange,
    direction,
    sampleDays: sortedByDateAscending.length,
  };

  if (direction === "stable") {
    trendLogger.debug("Trend stable; emitting deterministic message");
    return {
      trendComparison,
      trendLlmInsights: [
        {
          message: `Engagement is roughly flat over the last ${trendComparison.sampleDays} days (avg ${recentAverageEngagementScore.toFixed(
            1,
          )} vs prior ${previousAverageEngagementScore.toFixed(1)}).`,
          confidence: 0.5,
        },
      ],
    };
  }

  const structuredModel = getChatModel().withStructuredOutput(
    llmInsightArraySchema,
  );

  const promptValue = await trendInsightsPromptTemplate.invoke({
    recentAverage: recentAverageEngagementScore.toFixed(1),
    previousAverage: previousAverageEngagementScore.toFixed(1),
    percentChangeFormatted:
      percentChange === null ? "n/a" : `${percentChange.toFixed(1)}%`,
    direction,
    sampleDays: trendComparison.sampleDays,
  });

  const llmGeneratedInsights = await structuredModel.invoke(promptValue);

  trendLogger.info("Trend LLM insight generated", {
    percentChange,
    direction,
    sampleDays: trendComparison.sampleDays,
  });

  return {
    trendComparison,
    trendLlmInsights: llmGeneratedInsights,
  };
};
