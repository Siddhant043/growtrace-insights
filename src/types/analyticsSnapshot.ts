import { z } from "zod";

export const platformMetricSchema = z.object({
  platform: z.string().trim().min(1),
  clicks: z.number().nonnegative(),
  avgDuration: z.number().nonnegative(),
  bounceRate: z.number().min(0).max(1),
  engagementScore: z.number().nonnegative(),
});

export const linkMetricSchema = z.object({
  linkId: z.string().trim().min(1),
  shortCode: z.string().trim().min(1).nullable(),
  clicks: z.number().nonnegative(),
  avgDuration: z.number().nonnegative(),
  bounceRate: z.number().min(0).max(1),
  engagementScore: z.number().nonnegative(),
});

export const trendMetricSchema = z.object({
  date: z.string().trim().min(8),
  engagementScore: z.number().nonnegative(),
});

export const audienceSegmentCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  highEngagement: z.number().int().nonnegative(),
  lowEngagement: z.number().int().nonnegative(),
  returningUsers: z.number().int().nonnegative(),
});

export const audienceCohortSchema = z.object({
  cohortDate: z.string().trim().min(8),
  primaryPlatform: z.string().trim().min(1),
  users: z.number().int().nonnegative(),
  returningUsers: z.number().int().nonnegative(),
  avgEngagement: z.number().nonnegative(),
});

export const audienceTopPlatformSchema = z.object({
  platform: z.string().trim().min(1),
  returningUsers: z.number().nonnegative(),
  avgEngagement: z.number().nonnegative(),
});

export const audienceSnapshotSchema = z.object({
  segmentCounts: audienceSegmentCountsSchema,
  cohorts: z.array(audienceCohortSchema).default([]),
  topPlatformsByReturningUsers: z
    .array(audienceTopPlatformSchema)
    .default([]),
});

export const analyticsSnapshotSchema = z.object({
  userId: z.string().trim().min(1),
  adminUserContext: z
    .object({
      accountStatus: z.enum(["active", "suspended"]).optional(),
      plan: z.enum(["free", "pro"]).optional(),
      lastLoginAt: z.string().datetime().nullable().optional(),
      stats: z
        .object({
          totalLinks: z.number().int().nonnegative(),
          totalClicks: z.number().int().nonnegative(),
          engagementScore: z.number().nonnegative(),
        })
        .optional(),
    })
    .optional(),
  asOfDate: z.string().trim().min(8),
  windowDays: z.number().int().positive().max(365).default(7),
  platformMetrics: z.array(platformMetricSchema).default([]),
  linkMetrics: z.array(linkMetricSchema).default([]),
  trendMetrics: z.array(trendMetricSchema).default([]),
  audienceSnapshot: audienceSnapshotSchema.optional(),
});

export type PlatformMetric = z.infer<typeof platformMetricSchema>;
export type LinkMetric = z.infer<typeof linkMetricSchema>;
export type TrendMetric = z.infer<typeof trendMetricSchema>;
export type AudienceSegmentCounts = z.infer<typeof audienceSegmentCountsSchema>;
export type AudienceCohort = z.infer<typeof audienceCohortSchema>;
export type AudienceTopPlatform = z.infer<typeof audienceTopPlatformSchema>;
export type AudienceSnapshot = z.infer<typeof audienceSnapshotSchema>;
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
