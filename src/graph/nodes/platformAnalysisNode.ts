import { llmInsightArraySchema } from "../../types/generatedInsight";
import { getChatModel } from "../../llm/chatModelFactory";
import { platformInsightsPromptTemplate } from "../../llm/prompts/platformInsightsPrompt";
import { createScopedLogger } from "../../utils/logger";
import type {
  FlaggedPlatformSignal,
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
  PlatformQualityFlag,
} from "../state";

const platformLogger = createScopedLogger("graph.platformAnalysisNode");

const HIGH_BOUNCE_RATE_THRESHOLD = 0.6;
const HIGH_QUALITY_AVG_DURATION_SECONDS = 15;
const QUARTILE_BOUNDARY_FRACTION = 0.25;

const computeQuartileBoundaries = (
  sortedAscendingClicks: number[],
): { lowerQuartileClicks: number; upperQuartileClicks: number } => {
  if (sortedAscendingClicks.length === 0) {
    return { lowerQuartileClicks: 0, upperQuartileClicks: 0 };
  }
  const lowerIndex = Math.max(
    0,
    Math.floor(
      (sortedAscendingClicks.length - 1) * QUARTILE_BOUNDARY_FRACTION,
    ),
  );
  const upperIndex = Math.min(
    sortedAscendingClicks.length - 1,
    Math.ceil(
      (sortedAscendingClicks.length - 1) * (1 - QUARTILE_BOUNDARY_FRACTION),
    ),
  );
  return {
    lowerQuartileClicks: sortedAscendingClicks[lowerIndex] ?? 0,
    upperQuartileClicks: sortedAscendingClicks[upperIndex] ?? 0,
  };
};

const formatBulletedSignals = (
  flaggedPlatformSignals: FlaggedPlatformSignal[],
): string => {
  if (flaggedPlatformSignals.length === 0) {
    return "(no flagged platforms)";
  }
  return flaggedPlatformSignals
    .map(
      (signal) =>
        `- ${signal.platform} | flag=${signal.flag} | clicks=${signal.clicks} | bounce=${(
          signal.bounceRate * 100
        ).toFixed(1)}% | avgDuration=${signal.avgDuration.toFixed(1)}s | engagement=${signal.engagementScore.toFixed(1)}`,
    )
    .join("\n");
};

const formatPlatformContext = (
  platformMetrics: InsightsWorkflowState["snapshot"]["platformMetrics"],
): string => {
  if (platformMetrics.length === 0) {
    return "(none)";
  }
  return platformMetrics
    .map(
      (platformMetric) =>
        `- ${platformMetric.platform}: clicks=${platformMetric.clicks}, bounce=${(
          platformMetric.bounceRate * 100
        ).toFixed(1)}%, avgDuration=${platformMetric.avgDuration.toFixed(1)}s, engagement=${platformMetric.engagementScore.toFixed(1)}`,
    )
    .join("\n");
};

export const platformAnalysisNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const { platformMetrics } = state.snapshot;
  if (platformMetrics.length === 0) {
    platformLogger.debug("No platform metrics; skipping LLM call");
    return {
      flaggedPlatforms: [],
      platformLlmInsights: [],
    };
  }

  const sortedAscendingClicks = [...platformMetrics]
    .map((platformMetric) => platformMetric.clicks)
    .sort((firstClicks, secondClicks) => firstClicks - secondClicks);
  const { lowerQuartileClicks, upperQuartileClicks } =
    computeQuartileBoundaries(sortedAscendingClicks);

  const topQualityPlatform = [...platformMetrics].sort(
    (firstPlatform, secondPlatform) =>
      secondPlatform.engagementScore - firstPlatform.engagementScore,
  )[0];

  const flaggedSignals: FlaggedPlatformSignal[] = [];

  for (const platformMetric of platformMetrics) {
    if (
      platformMetric.clicks >= upperQuartileClicks &&
      platformMetric.bounceRate >= HIGH_BOUNCE_RATE_THRESHOLD
    ) {
      flaggedSignals.push({
        platform: platformMetric.platform,
        flag: "low_quality_traffic" satisfies PlatformQualityFlag,
        clicks: platformMetric.clicks,
        bounceRate: platformMetric.bounceRate,
        avgDuration: platformMetric.avgDuration,
        engagementScore: platformMetric.engagementScore,
      });
    } else if (
      platformMetric.clicks <= lowerQuartileClicks &&
      platformMetric.avgDuration >= HIGH_QUALITY_AVG_DURATION_SECONDS
    ) {
      flaggedSignals.push({
        platform: platformMetric.platform,
        flag: "high_quality_traffic" satisfies PlatformQualityFlag,
        clicks: platformMetric.clicks,
        bounceRate: platformMetric.bounceRate,
        avgDuration: platformMetric.avgDuration,
        engagementScore: platformMetric.engagementScore,
      });
    }
  }

  if (
    topQualityPlatform &&
    !flaggedSignals.some(
      (existingSignal) =>
        existingSignal.platform === topQualityPlatform.platform,
    )
  ) {
    flaggedSignals.push({
      platform: topQualityPlatform.platform,
      flag: "top_quality_platform" satisfies PlatformQualityFlag,
      clicks: topQualityPlatform.clicks,
      bounceRate: topQualityPlatform.bounceRate,
      avgDuration: topQualityPlatform.avgDuration,
      engagementScore: topQualityPlatform.engagementScore,
    });
  }

  if (flaggedSignals.length === 0) {
    platformLogger.debug("No platform signals flagged; skipping LLM call");
    return { flaggedPlatforms: [], platformLlmInsights: [] };
  }

  const structuredModel = getChatModel().withStructuredOutput(
    llmInsightArraySchema,
  );

  const promptValue = await platformInsightsPromptTemplate.invoke({
    windowDays: state.snapshot.windowDays,
    flaggedPlatformsBulleted: formatBulletedSignals(flaggedSignals),
    platformsContextBulleted: formatPlatformContext(platformMetrics),
  });

  const llmGeneratedInsights = await structuredModel.invoke(promptValue);

  platformLogger.info("Platform LLM insights generated", {
    flaggedCount: flaggedSignals.length,
    insightCount: llmGeneratedInsights.length,
  });

  return {
    flaggedPlatforms: flaggedSignals,
    platformLlmInsights: llmGeneratedInsights,
  };
};
