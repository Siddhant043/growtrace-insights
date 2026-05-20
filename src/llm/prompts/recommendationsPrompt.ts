import { ChatPromptTemplate } from "@langchain/core/prompts";

import {
  GROWTRACE_PRODUCT_CONTEXT,
  INSIGHT_OUTPUT_RULES,
} from "./growtracePromptContext.js";

const recommendationsSystemMessage = [
  GROWTRACE_PRODUCT_CONTEXT,
  "You convert raw analytics signals into 1 to 3 actionable recommendations for teams monetizing traffic.",
  "Each recommendation MUST:",
  "- Be a single imperative sentence (e.g. 'Pause Instagram spend until landing bounce drops below 40%').",
  "- Reference a specific platform, link, or metric driver where applicable.",
  "- Target this-week optimizations: pause weak campaigns, fix high-bounce landings, scale best channel or link, re-engage at-risk cohorts.",
  "- Prefer funnel and campaign language over creating more content.",
  "- Be concrete, not generic.",
  "- Avoid hedging phrases ('you might want to', 'consider', 'look into').",
  "Confidence reflects how strong the underlying signal was.",
  INSIGHT_OUTPUT_RULES,
].join(" ");

export const recommendationsPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", recommendationsSystemMessage],
  [
    "human",
    [
      "Signals derived from this analytics window ({windowDays} days):",
      "",
      "Platform signals:",
      "{platformSignalsBulleted}",
      "",
      "Content signals:",
      "{contentSignalsBulleted}",
      "",
      "Trend signal:",
      "{trendSignalLine}",
      "",
      "Audience signals:",
      "{audienceSignalsBulleted}",
      "",
      "Rule-derived recommendation hints (use as guidance, do not echo verbatim):",
      "{ruleHintsBulleted}",
      "",
      "Output 1 to 3 recommendations as imperative sentences.",
    ].join("\n"),
  ],
]);
