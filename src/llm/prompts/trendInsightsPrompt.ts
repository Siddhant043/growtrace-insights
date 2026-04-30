import { ChatPromptTemplate } from "@langchain/core/prompts";

const trendInsightsSystemMessage = [
  "You analyze week-over-week or period-over-period engagement trends.",
  "Output exactly 1 short insight describing the magnitude and direction of change.",
  "The insight MUST:",
  "- Cite the percentage change (positive or negative).",
  "- Frame the change in plain language (e.g. 'engagement dropped 18% this week').",
  "- Avoid panic phrasing for changes under 30%.",
  "- Be a single sentence with no markdown.",
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
