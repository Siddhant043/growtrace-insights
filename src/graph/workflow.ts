import { END, START, StateGraph } from "@langchain/langgraph";

import type { AnalyticsSnapshot } from "../types/analyticsSnapshot";
import type { GeneratedInsight } from "../types/generatedInsight";
import { contentAnalysisNode } from "./nodes/contentAnalysisNode";
import { inputNode } from "./nodes/inputNode";
import { outputNode } from "./nodes/outputNode";
import { platformAnalysisNode } from "./nodes/platformAnalysisNode";
import { recommendationNode } from "./nodes/recommendationNode";
import { trendAnalysisNode } from "./nodes/trendAnalysisNode";
import { insightsWorkflowAnnotation } from "./state";

const compiledInsightsWorkflow = new StateGraph(insightsWorkflowAnnotation)
  .addNode("inputNode", inputNode)
  .addNode("platformAnalysisNode", platformAnalysisNode)
  .addNode("contentAnalysisNode", contentAnalysisNode)
  .addNode("trendAnalysisNode", trendAnalysisNode)
  .addNode("recommendationNode", recommendationNode)
  .addNode("outputNode", outputNode)
  .addEdge(START, "inputNode")
  .addEdge("inputNode", "platformAnalysisNode")
  .addEdge("platformAnalysisNode", "contentAnalysisNode")
  .addEdge("contentAnalysisNode", "trendAnalysisNode")
  .addEdge("trendAnalysisNode", "recommendationNode")
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
