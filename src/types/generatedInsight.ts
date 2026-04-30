import { z } from "zod";

export const INSIGHT_TYPES = [
  "platform",
  "content",
  "trend",
  "recommendation",
] as const;

export type InsightType = (typeof INSIGHT_TYPES)[number];

export const llmInsightSchema = z.object({
  message: z
    .string()
    .trim()
    .min(8, "Insight message too short")
    .max(220, "Insight message too long"),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1"),
});

export const llmInsightArraySchema = z
  .array(llmInsightSchema)
  .min(0)
  .max(5);

export type LlmInsight = z.infer<typeof llmInsightSchema>;

export type GeneratedInsight = {
  userId: string;
  type: InsightType;
  message: string;
  confidence: number;
  signature: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
};
