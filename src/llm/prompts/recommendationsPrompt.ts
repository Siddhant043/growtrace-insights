import { ChatPromptTemplate } from "@langchain/core/prompts";

const recommendationsSystemMessage = [
  "You convert raw analytics signals into 1 to 3 actionable recommendations",
  "for a content creator. Each recommendation MUST:",
  "- Be a single imperative sentence (e.g. 'Post more on Twitter to compound retention').",
  "- Reference a specific platform, link, or metric driver where applicable.",
  "- Be concrete (an action they can take this week), not generic.",
  "- Avoid hedging phrases ('you might want to', 'consider', 'look into').",
  "Confidence reflects how strong the underlying signal was.",
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
