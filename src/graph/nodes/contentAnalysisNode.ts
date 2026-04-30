import { llmInsightArraySchema } from "../../types/generatedInsight";
import { getChatModel } from "../../llm/chatModelFactory";
import { contentInsightsPromptTemplate } from "../../llm/prompts/contentInsightsPrompt";
import { createScopedLogger } from "../../utils/logger";
import type {
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
  RankedLinkSignal,
} from "../state";

const contentLogger = createScopedLogger("graph.contentAnalysisNode");

const TOP_LINKS_TO_HIGHLIGHT = 3;
const BOTTOM_LINKS_TO_HIGHLIGHT = 3;
const MIN_LINKS_FOR_BOTTOM_RANKING = 6;

const formatLinkSignal = (linkSignal: RankedLinkSignal): string => {
  const shortCodeOrFallback = linkSignal.shortCode ?? linkSignal.linkId;
  return `- ${shortCodeOrFallback} | clicks=${linkSignal.clicks} | bounce=${(
    linkSignal.bounceRate * 100
  ).toFixed(1)}% | avgDuration=${linkSignal.avgDuration.toFixed(1)}s | engagement=${linkSignal.engagementScore.toFixed(1)}`;
};

export const contentAnalysisNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const { linkMetrics } = state.snapshot;
  if (linkMetrics.length === 0) {
    contentLogger.debug("No link metrics; skipping LLM call");
    return { rankedLinks: [], contentLlmInsights: [] };
  }

  const linksByEngagementDescending = [...linkMetrics].sort(
    (firstLink, secondLink) =>
      secondLink.engagementScore - firstLink.engagementScore,
  );

  const topLinks = linksByEngagementDescending.slice(
    0,
    TOP_LINKS_TO_HIGHLIGHT,
  );
  const bottomLinks =
    linkMetrics.length >= MIN_LINKS_FOR_BOTTOM_RANKING
      ? linksByEngagementDescending.slice(-BOTTOM_LINKS_TO_HIGHLIGHT).reverse()
      : [];

  const rankedLinks: RankedLinkSignal[] = [
    ...topLinks.map<RankedLinkSignal>((linkRow) => ({
      linkId: linkRow.linkId,
      shortCode: linkRow.shortCode,
      rankBucket: "top",
      clicks: linkRow.clicks,
      bounceRate: linkRow.bounceRate,
      avgDuration: linkRow.avgDuration,
      engagementScore: linkRow.engagementScore,
    })),
    ...bottomLinks.map<RankedLinkSignal>((linkRow) => ({
      linkId: linkRow.linkId,
      shortCode: linkRow.shortCode,
      rankBucket: "bottom",
      clicks: linkRow.clicks,
      bounceRate: linkRow.bounceRate,
      avgDuration: linkRow.avgDuration,
      engagementScore: linkRow.engagementScore,
    })),
  ];

  const structuredModel = getChatModel().withStructuredOutput(
    llmInsightArraySchema,
  );

  const topLinksBulleted =
    rankedLinks
      .filter((rankedLinkRow) => rankedLinkRow.rankBucket === "top")
      .map(formatLinkSignal)
      .join("\n") || "(none)";

  const bottomLinksBulleted =
    rankedLinks
      .filter((rankedLinkRow) => rankedLinkRow.rankBucket === "bottom")
      .map(formatLinkSignal)
      .join("\n") || "(insufficient links to rank lowest)";

  const promptValue = await contentInsightsPromptTemplate.invoke({
    windowDays: state.snapshot.windowDays,
    topLinksBulleted,
    bottomLinksBulleted,
  });

  const llmGeneratedInsights = await structuredModel.invoke(promptValue);

  contentLogger.info("Content LLM insights generated", {
    topCount: topLinks.length,
    bottomCount: bottomLinks.length,
    insightCount: llmGeneratedInsights.length,
  });

  return {
    rankedLinks,
    contentLlmInsights: llmGeneratedInsights,
  };
};
