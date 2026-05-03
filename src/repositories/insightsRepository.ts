import { InsightModel } from "../models/insight.model.js";
import type { GeneratedInsight } from "../types/generatedInsight.js";
import { createScopedLogger } from "../utils/logger.js";

const repositoryLogger = createScopedLogger("repository.insights");

export type InsightUpsertSummary = {
  insertedCount: number;
  duplicateCount: number;
  attemptedCount: number;
};

/**
 * Bulk-upserts insights with deterministic dedup on
 * `{userId, type, signature}`. Duplicates within the same UTC day are a
 * no-op (signature already encodes the day key + normalized message).
 */
export const upsertGeneratedInsightBatch = async (
  insightBatch: GeneratedInsight[],
): Promise<InsightUpsertSummary> => {
  if (insightBatch.length === 0) {
    return { insertedCount: 0, duplicateCount: 0, attemptedCount: 0 };
  }

  const bulkOperations = insightBatch.map((insight) => ({
    updateOne: {
      filter: {
        userId: insight.userId,
        type: insight.type,
        signature: insight.signature,
      },
      update: {
        $setOnInsert: {
          userId: insight.userId,
          type: insight.type,
          message: insight.message,
          confidence: insight.confidence,
          signature: insight.signature,
          metadata: insight.metadata ?? null,
          createdAt: insight.createdAt,
        },
      },
      upsert: true,
    },
  }));

  const bulkWriteResult = await InsightModel.bulkWrite(bulkOperations, {
    ordered: false,
  });

  const insertedCount = bulkWriteResult.upsertedCount ?? 0;
  const duplicateCount = insightBatch.length - insertedCount;

  repositoryLogger.info("Insight batch upserted", {
    attempted: insightBatch.length,
    inserted: insertedCount,
    duplicates: duplicateCount,
  });

  return {
    insertedCount,
    duplicateCount,
    attemptedCount: insightBatch.length,
  };
};
