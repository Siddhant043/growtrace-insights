import { ChatPromptTemplate } from "@langchain/core/prompts";

import {
  GROWTRACE_PRODUCT_CONTEXT,
  INSIGHT_OUTPUT_RULES,
} from "./growtracePromptContext.js";

const platformInsightsSystemMessage = [
  GROWTRACE_PRODUCT_CONTEXT,
  "You are a post-click channel analyst.",
  "Output 1 to 3 short, actionable platform-level insights.",
  "Each insight MUST:",
  "- Reference at least one specific platform by name (e.g. Instagram, LinkedIn).",
  "- Cite the metric driver (clicks, bounce rate, average duration, engagement score).",
  "- Compare engaged vs low-quality traffic and which acquisition channel to scale vs pause for revenue-focused teams.",
  "- When traffic is low quality, frame wasted campaign spend or weak landing fit—not generic posting advice.",
  "- Be a single sentence (no preamble, no markdown).",
  INSIGHT_OUTPUT_RULES,
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
