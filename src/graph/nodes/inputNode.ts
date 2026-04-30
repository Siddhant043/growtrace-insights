import { analyticsSnapshotSchema } from "../../types/analyticsSnapshot";
import { createScopedLogger } from "../../utils/logger";
import type {
  InsightsWorkflowState,
  InsightsWorkflowUpdate,
} from "../state";

const inputNodeLogger = createScopedLogger("graph.inputNode");

/**
 * Validates the inbound snapshot one more time and emits a no-op state
 * patch. The Zod schema runs in the consumer too, but re-validating here
 * keeps the workflow self-contained when invoked outside the consumer
 * (e.g. ad-hoc replay scripts).
 */
export const inputNode = async (
  state: InsightsWorkflowState,
): Promise<InsightsWorkflowUpdate> => {
  const validationResult = analyticsSnapshotSchema.safeParse(state.snapshot);
  if (!validationResult.success) {
    const formattedIssues = JSON.stringify(
      validationResult.error.format(),
      null,
      0,
    );
    throw new Error(`Invalid snapshot at inputNode: ${formattedIssues}`);
  }

  inputNodeLogger.debug("Snapshot accepted", {
    userId: validationResult.data.userId,
    platforms: validationResult.data.platformMetrics.length,
    links: validationResult.data.linkMetrics.length,
    trendDays: validationResult.data.trendMetrics.length,
  });

  return {
    snapshot: validationResult.data,
  };
};
