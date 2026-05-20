import { ChatPromptTemplate } from "@langchain/core/prompts";

import {
  GROWTRACE_PRODUCT_CONTEXT,
  INSIGHT_OUTPUT_RULES,
} from "./growtracePromptContext.js";

const contentInsightsSystemMessage = [
  GROWTRACE_PRODUCT_CONTEXT,
  "You analyze top and bottom performing links as post-click destination performance.",
  "Output 1 to 3 short insights about link and landing engagement quality.",
  "Each insight MUST:",
  "- Name a specific short code when present (e.g. 'abc123').",
  "- Cite the metric that drives the verdict (engagement score, bounce, duration).",
  "- Tie strong links to buyer-intent proxies (low bounce, longer duration); weak links to fix landing or stop promoting.",
  "- Avoid viral, views, or impressions language.",
  "- Be a single sentence with no markdown.",
  "Lower confidence when sample size (clicks) is small.",
  INSIGHT_OUTPUT_RULES,
].join(" ");

export const contentInsightsPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", contentInsightsSystemMessage],
  [
    "human",
    [
      "Analytics window: {windowDays} days.",
      "",
      "Top performing links by engagement score:",
      "{topLinksBulleted}",
      "",
      "Bottom performing links by engagement score:",
      "{bottomLinksBulleted}",
      "",
      "Constraints:",
      "- One short sentence per insight (max 220 chars).",
      "- Mention short codes where useful.",
      "- Confidence in [0, 1].",
    ].join("\n"),
  ],
]);
