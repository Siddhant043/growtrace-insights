import { ChatPromptTemplate } from "@langchain/core/prompts";

const contentInsightsSystemMessage = [
  "You analyze top and bottom performing links for a content creator.",
  "Output 1 to 3 short insights about content performance.",
  "Each insight MUST:",
  "- Name a specific short code when present (e.g. 'abc123').",
  "- Cite the metric that drives the verdict (engagement score, bounce, duration).",
  "- Be a single sentence with no markdown.",
  "Lower confidence when sample size (clicks) is small.",
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
