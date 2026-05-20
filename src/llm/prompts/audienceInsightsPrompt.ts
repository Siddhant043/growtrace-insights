import { ChatPromptTemplate } from "@langchain/core/prompts";

import {
  GROWTRACE_PRODUCT_CONTEXT,
  INSIGHT_OUTPUT_RULES,
} from "./growtracePromptContext.js";

const audienceInsightsSystemMessage = [
  GROWTRACE_PRODUCT_CONTEXT,
  "You are an audience segmentation analyst for businesses monetizing traffic.",
  "From cohort and segmentation signals, output between 1 and 3 short audience insights.",
  "Each insight MUST:",
  "- Be a single sentence (max 220 chars).",
  "- Cite a concrete platform, cohort date, or segment count when possible.",
  "- Frame segments as high-value vs at-risk cohorts supporting retention and conversion.",
  "- Use neutral terms like visitors, users, leads, or buyers—not 'grow your following'.",
  "- Use plain, encouraging language; avoid alarmist or panic phrasing.",
  "- Avoid markdown, bullets, or quotation marks in the message body.",
  "Confidence reflects how strong the underlying signal was.",
  INSIGHT_OUTPUT_RULES,
].join(" ");

export const audienceInsightsPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", audienceInsightsSystemMessage],
  [
    "human",
    [
      "Audience signals derived from this analytics window ({windowDays} days):",
      "",
      "Segment counts:",
      "{segmentCountsLine}",
      "",
      "Best-performing audience platform:",
      "{bestPlatformLine}",
      "",
      "Cohort risk and loyalty signals:",
      "{cohortSignalsBulleted}",
      "",
      "Constraints:",
      "- 1 to 3 insights total.",
      "- Confidence in [0, 1].",
    ].join("\n"),
  ],
]);
