import { ChatPromptTemplate } from "@langchain/core/prompts";

const audienceInsightsSystemMessage = [
  "You are an audience-intelligence analyst for content creators.",
  "From cohort and segmentation signals, output between 1 and 3 short audience insights.",
  "Each insight MUST:",
  "- Be a single sentence (max 220 chars).",
  "- Cite a concrete platform, cohort date, or segment count when possible.",
  "- Use plain, encouraging language; avoid alarmist or panic phrasing.",
  "- Avoid markdown, bullets, or quotation marks in the message body.",
  "Confidence reflects how strong the underlying signal was.",
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
