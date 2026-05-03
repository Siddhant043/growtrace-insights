import { llmInsightArraySchema } from "../../types/generatedInsight.js";
import { getChatModel } from "../../llm/chatModelFactory.js";
import { audienceInsightsPromptTemplate } from "../../llm/prompts/audienceInsightsPrompt.js";
import { createScopedLogger } from "../../utils/logger.js";
import type {
  AudienceCohort,
  AudienceSnapshot,
  AudienceTopPlatform,
} from "../../types/analyticsSnapshot.js";
import type {
  AudienceFinding,
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
} from "../state.js";

const audienceLogger = createScopedLogger("graph.audienceAnalysisNode");

const MIN_COHORT_USERS_FOR_AT_RISK = 5;
const AT_RISK_AVG_ENGAGEMENT_MAX = 20;
const HIGH_LOYALTY_RATIO_THRESHOLD = 0.4;
const LOW_LOYALTY_RATIO_THRESHOLD = 0.05;

const findBestPlatformByEngagement = (
  topPlatforms: AudienceTopPlatform[],
): AudienceTopPlatform | null => {
  if (topPlatforms.length === 0) {
    return null;
  }

  return [...topPlatforms].sort(
    (firstEntry, secondEntry) =>
      secondEntry.avgEngagement - firstEntry.avgEngagement,
  )[0];
};

const findAtRiskCohort = (
  cohorts: AudienceCohort[],
): AudienceCohort | null => {
  const eligibleCohorts = cohorts.filter(
    (cohortRow) =>
      cohortRow.users >= MIN_COHORT_USERS_FOR_AT_RISK &&
      cohortRow.avgEngagement <= AT_RISK_AVG_ENGAGEMENT_MAX,
  );

  if (eligibleCohorts.length === 0) {
    return null;
  }

  return [...eligibleCohorts].sort(
    (firstEntry, secondEntry) => secondEntry.users - firstEntry.users,
  )[0];
};

const computeAudienceFindings = (
  audienceSnapshot: AudienceSnapshot,
): AudienceFinding[] => {
  const findings: AudienceFinding[] = [];
  const { segmentCounts, cohorts, topPlatformsByReturningUsers } =
    audienceSnapshot;

  const bestPlatform = findBestPlatformByEngagement(
    topPlatformsByReturningUsers,
  );

  if (bestPlatform && bestPlatform.avgEngagement > 0) {
    findings.push({
      category: "best_users_platform",
      message:
        `Your best users come from ${bestPlatform.platform} (avg engagement ` +
        `${bestPlatform.avgEngagement.toFixed(1)}, ${bestPlatform.returningUsers} returning).`,
      metadata: {
        platform: bestPlatform.platform,
        avgEngagement: bestPlatform.avgEngagement,
        returningUsers: bestPlatform.returningUsers,
      },
    });
  }

  const atRiskCohort = findAtRiskCohort(cohorts);
  if (atRiskCohort) {
    findings.push({
      category: "at_risk_cohort",
      message:
        `The ${atRiskCohort.cohortDate} ${atRiskCohort.primaryPlatform} cohort ` +
        `(${atRiskCohort.users} users) shows low engagement ` +
        `(avg ${atRiskCohort.avgEngagement.toFixed(1)}).`,
      metadata: {
        cohortDate: atRiskCohort.cohortDate,
        primaryPlatform: atRiskCohort.primaryPlatform,
        users: atRiskCohort.users,
        returningUsers: atRiskCohort.returningUsers,
        avgEngagement: atRiskCohort.avgEngagement,
      },
    });
  }

  if (segmentCounts.total > 0) {
    const loyaltyRatio = segmentCounts.returningUsers / segmentCounts.total;

    if (loyaltyRatio >= HIGH_LOYALTY_RATIO_THRESHOLD) {
      findings.push({
        category: "audience_loyalty",
        message:
          `${(loyaltyRatio * 100).toFixed(0)}% of tracked users are returning visitors — ` +
          `your audience is sticky.`,
        metadata: {
          totalUsers: segmentCounts.total,
          returningUsers: segmentCounts.returningUsers,
          loyaltyRatio,
        },
      });
    } else if (loyaltyRatio < LOW_LOYALTY_RATIO_THRESHOLD) {
      findings.push({
        category: "low_loyalty_warning",
        message:
          `Only ${(loyaltyRatio * 100).toFixed(0)}% of tracked users return — ` +
          `consider posts that bring people back.`,
        metadata: {
          totalUsers: segmentCounts.total,
          returningUsers: segmentCounts.returningUsers,
          loyaltyRatio,
        },
      });
    }

    const highEngagementShare =
      segmentCounts.highEngagement / segmentCounts.total;
    if (highEngagementShare >= 0.2) {
      findings.push({
        category: "high_engagement_share",
        message:
          `${segmentCounts.highEngagement} of ${segmentCounts.total} tracked users are highly engaged ` +
          `(${(highEngagementShare * 100).toFixed(0)}%).`,
        metadata: {
          totalUsers: segmentCounts.total,
          highEngagementUsers: segmentCounts.highEngagement,
          highEngagementShare,
        },
      });
    }
  }

  return findings;
};

const formatSegmentCountsLine = (audienceSnapshot: AudienceSnapshot): string => {
  const { segmentCounts } = audienceSnapshot;
  return (
    `total=${segmentCounts.total}, ` +
    `highEngagement=${segmentCounts.highEngagement}, ` +
    `lowEngagement=${segmentCounts.lowEngagement}, ` +
    `returningUsers=${segmentCounts.returningUsers}`
  );
};

const formatBestPlatformLine = (audienceSnapshot: AudienceSnapshot): string => {
  const bestPlatform = findBestPlatformByEngagement(
    audienceSnapshot.topPlatformsByReturningUsers,
  );
  if (!bestPlatform) {
    return "(no platform signal yet)";
  }
  return (
    `${bestPlatform.platform} ` +
    `(avgEngagement=${bestPlatform.avgEngagement.toFixed(1)}, ` +
    `returningUsers=${bestPlatform.returningUsers})`
  );
};

const formatCohortSignalsBulleted = (findings: AudienceFinding[]): string => {
  const cohortFindings = findings.filter((finding) =>
    [
      "at_risk_cohort",
      "audience_loyalty",
      "low_loyalty_warning",
      "high_engagement_share",
    ].includes(finding.category),
  );

  if (cohortFindings.length === 0) {
    return "(no risk or loyalty signals yet)";
  }

  return cohortFindings
    .map((finding) => `- ${finding.category}: ${finding.message}`)
    .join("\n");
};

export const audienceAnalysisNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const audienceSnapshot = state.snapshot.audienceSnapshot;

  if (!audienceSnapshot) {
    audienceLogger.debug("No audienceSnapshot in payload; skipping");
    return { audienceFindings: [], audienceLlmInsights: [] };
  }

  const audienceFindings = computeAudienceFindings(audienceSnapshot);

  if (audienceFindings.length === 0) {
    audienceLogger.debug("No audience findings derived; skipping LLM call");
    return { audienceFindings: [], audienceLlmInsights: [] };
  }

  const structuredModel = getChatModel().withStructuredOutput(
    llmInsightArraySchema,
  );

  const promptValue = await audienceInsightsPromptTemplate.invoke({
    windowDays: state.snapshot.windowDays,
    segmentCountsLine: formatSegmentCountsLine(audienceSnapshot),
    bestPlatformLine: formatBestPlatformLine(audienceSnapshot),
    cohortSignalsBulleted: formatCohortSignalsBulleted(audienceFindings),
  });

  const llmGeneratedInsights = await structuredModel.invoke(promptValue);

  audienceLogger.info("Audience LLM insights generated", {
    findingCount: audienceFindings.length,
    llmInsightCount: llmGeneratedInsights.length,
  });

  return {
    audienceFindings,
    audienceLlmInsights: llmGeneratedInsights,
  };
};
