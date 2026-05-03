import { END, START, StateGraph } from "@langchain/langgraph";

import type { AnalyticsSnapshot } from "../types/analyticsSnapshot.js";
import type { GeneratedInsight } from "../types/generatedInsight.js";
import { audienceAnalysisNode } from "./nodes/audienceAnalysisNode.js";
import { contentAnalysisNode } from "./nodes/contentAnalysisNode.js";
import { inputNode } from "./nodes/inputNode.js";
import { outputNode } from "./nodes/outputNode.js";
import { platformAnalysisNode } from "./nodes/platformAnalysisNode.js";
import { recommendationNode } from "./nodes/recommendationNode.js";
import { trendAnalysisNode } from "./nodes/trendAnalysisNode.js";
import { insightsWorkflowAnnotation } from "./state.js";

const compiledInsightsWorkflow = new StateGraph(insightsWorkflowAnnotation)
  .addNode("inputNode", inputNode)
  .addNode("platformAnalysisNode", platformAnalysisNode)
  .addNode("contentAnalysisNode", contentAnalysisNode)
  .addNode("trendAnalysisNode", trendAnalysisNode)
  .addNode("audienceAnalysisNode", audienceAnalysisNode)
  .addNode("recommendationNode", recommendationNode)
  .addNode("outputNode", outputNode)
  .addEdge(START, "inputNode")
  .addEdge("inputNode", "platformAnalysisNode")
  .addEdge("platformAnalysisNode", "contentAnalysisNode")
  .addEdge("contentAnalysisNode", "trendAnalysisNode")
  .addEdge("trendAnalysisNode", "audienceAnalysisNode")
  .addEdge("audienceAnalysisNode", "recommendationNode")
  .addEdge("recommendationNode", "outputNode")
  .addEdge("outputNode", END)
  .compile();

export const runInsightsWorkflow = async (
  snapshot: AnalyticsSnapshot,
): Promise<GeneratedInsight[]> => {
  const finalState = await compiledInsightsWorkflow.invoke({
    snapshot,
  });
  return finalState.generatedInsights;
};
