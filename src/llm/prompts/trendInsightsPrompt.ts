import { ChatPromptTemplate } from "@langchain/core/prompts";

import {
  GROWTRACE_PRODUCT_CONTEXT,
  INSIGHT_OUTPUT_RULES,
} from "./growtracePromptContext.js";

const trendInsightsSystemMessage = [
  GROWTRACE_PRODUCT_CONTEXT,
  "You analyze week-over-week or period-over-period engagement quality trends.",
  "Output exactly 1 short insight describing the magnitude and direction of change in traffic quality (engagement score).",
  "The insight MUST:",
  "- Cite the percentage change (positive or negative).",
  "- Frame the change as post-click engagement quality, not generic popularity or views.",
  "- Use plain language (e.g. 'post-click engagement dropped 18% this period').",
  "- Avoid panic phrasing for changes under 30%.",
  "- Be a single sentence with no markdown.",
  INSIGHT_OUTPUT_RULES,
].join(" ");

export const trendInsightsPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", trendInsightsSystemMessage],
  [
    "human",
    [
      "Recent half average engagement score: {recentAverage}",
      "Previous half average engagement score: {previousAverage}",
      "Percent change: {percentChangeFormatted}",
      "Direction: {direction}",
      "Sample size (days): {sampleDays}",
      "",
      "Constraints:",
      "- One short sentence (max 220 chars).",
      "- Confidence in [0, 1] should be lower when sampleDays < 7.",
    ].join("\n"),
  ],
]);
