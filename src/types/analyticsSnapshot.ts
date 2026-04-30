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

export const analyticsSnapshotSchema = z.object({
  userId: z.string().trim().min(1),
  asOfDate: z.string().trim().min(8),
  windowDays: z.number().int().positive().max(365).default(7),
  platformMetrics: z.array(platformMetricSchema).default([]),
  linkMetrics: z.array(linkMetricSchema).default([]),
  trendMetrics: z.array(trendMetricSchema).default([]),
});

export type PlatformMetric = z.infer<typeof platformMetricSchema>;
export type LinkMetric = z.infer<typeof linkMetricSchema>;
export type TrendMetric = z.infer<typeof trendMetricSchema>;
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
