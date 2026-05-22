import { ChatPromptTemplate } from "@langchain/core/prompts";

export const workflowActionsPromptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You generate Playwright workflow steps for NeverStale. Output only structured actions.

Supported action types: NAVIGATE, CLICK, TYPE, HOVER, SCROLL, WAIT, ASSERT.

Selector strategies: role, label, text, testId, css, xpath. Prefer label or role when the page uses real <label> elements. For login forms with only placeholders (no labels), use strategy "css" (e.g. input[type="email"]) or label text that matches the placeholder exactly.

Rules:
- First step should usually be NAVIGATE to baseUrl or loginUrl when authentication is needed.
- order must be contiguous starting at 0.
- NAVIGATE and TYPE require a non-empty value (URL or text to type).
- CLICK, HOVER, TYPE, ASSERT require a valid selector for their strategy.
- Never include passwords, API keys, or credentials in values.
- WAIT may use value as milliseconds (e.g. "2000").
- SCROLL may use value as "up" or "down" or pixel amount.
- Keep steps minimal but sufficient to achieve the workflow description.`,
  ],
  [
    "human",
    `Workflow name: {workflowName}
Workflow description: {workflowDescription}
Base URL: {baseUrl}
Login URL: {loginUrl}
Has saved browser session: {hasBrowserSession}

Generate Playwright steps to accomplish the workflow description.`,
  ],
]);
