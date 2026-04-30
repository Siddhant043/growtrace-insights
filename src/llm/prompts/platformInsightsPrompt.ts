import { ChatPromptTemplate } from "@langchain/core/prompts";

const platformInsightsSystemMessage = [
  "You are a senior growth analyst writing for a content creator.",
  "Output 1 to 3 short, actionable platform-level insights.",
  "Each insight MUST:",
  "- Reference at least one specific platform by name (e.g. Instagram).",
  "- Cite the metric driver (clicks, bounce rate, average duration, engagement score).",
  "- Be a single sentence (no preamble, no markdown).",
  "Avoid generic phrases like 'consider exploring', 'monitor closely',",
  "'look into your analytics', or filler hedging.",
  "Confidence reflects signal strength: low click counts -> lower confidence.",
].join(" ");

export const platformInsightsPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", platformInsightsSystemMessage],
  [
    "human",
    [
      "Analytics window: {windowDays} days.",
      "",
      "Flagged platform signals:",
      "{flaggedPlatformsBulleted}",
      "",
      "All observed platforms (for context):",
      "{platformsContextBulleted}",
      "",
      "Constraints:",
      "- One short sentence per insight (max 220 chars).",
      "- Each must name the platform and the metric driver.",
      "- Confidence in [0, 1] reflects signal strength.",
    ].join("\n"),
  ],
]);
