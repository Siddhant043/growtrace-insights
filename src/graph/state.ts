import { Annotation } from "@langchain/langgraph";

import type { AnalyticsSnapshot } from "../types/analyticsSnapshot.js";
import type {
  GeneratedInsight,
  LlmInsight,
} from "../types/generatedInsight.js";

export type PlatformQualityFlag =
  | "low_quality_traffic"
  | "high_quality_traffic"
  | "top_quality_platform";

export type FlaggedPlatformSignal = {
  platform: string;
  flag: PlatformQualityFlag;
  clicks: number;
  bounceRate: number;
  avgDuration: number;
  engagementScore: number;
};

export type RankedLinkSignal = {
  linkId: string;
  shortCode: string | null;
  rankBucket: "top" | "bottom";
  clicks: number;
  bounceRate: number;
  avgDuration: number;
  engagementScore: number;
};

export type TrendComparison = {
  recentAverageEngagementScore: number;
  previousAverageEngagementScore: number;
  percentChange: number | null;
  direction: "up" | "down" | "stable";
  sampleDays: number;
};

export type RecommendationRuleHint =
  | "improve_landing_page"
  | "post_more_on_top_platform"
  | "diagnose_recent_change"
  | "double_down_on_top_link"
  | "double_down_on_audience_platform"
  | "rescue_at_risk_cohort"
  | "celebrate_loyal_audience"
  | "warn_low_loyalty_audience";

export type AudienceFinding = {
  category:
    | "best_users_platform"
    | "at_risk_cohort"
    | "audience_loyalty"
    | "low_loyalty_warning"
    | "high_engagement_share";
  message: string;
  metadata: Record<string, unknown>;
};

export const insightsWorkflowAnnotation = Annotation.Root({
  snapshot: Annotation<AnalyticsSnapshot>(),
  flaggedPlatforms: Annotation<FlaggedPlatformSignal[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  rankedLinks: Annotation<RankedLinkSignal[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  trendComparison: Annotation<TrendComparison | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  ruleHints: Annotation<RecommendationRuleHint[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  platformLlmInsights: Annotation<LlmInsight[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  contentLlmInsights: Annotation<LlmInsight[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  trendLlmInsights: Annotation<LlmInsight[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  recommendationLlmInsights: Annotation<LlmInsight[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  audienceFindings: Annotation<AudienceFinding[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  audienceLlmInsights: Annotation<LlmInsight[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  generatedInsights: Annotation<GeneratedInsight[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type InsightsWorkflowState =
  typeof insightsWorkflowAnnotation.State;
export type InsightsWorkflowUpdate =
  typeof insightsWorkflowAnnotation.Update;
