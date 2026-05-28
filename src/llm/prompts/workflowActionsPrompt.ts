import { ChatPromptTemplate } from "@langchain/core/prompts";

export const workflowActionsPromptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You generate Playwright workflow steps for NeverStale. Output only structured actions.

Supported action types: NAVIGATE, CLICK, TYPE, HOVER, SCROLL, WAIT, ASSERT.

Selector strategies: role, label, text, testId, css, xpath. Prefer label or role when the page uses real <label> elements. For login forms with only placeholders (no labels), use strategy "css" (e.g. input[type="email"]) or label text that matches the placeholder exactly.

Selector field mapping (critical): populate only the field that matches the chosen strategy:
  strategy "role"   → set role (e.g. "button") and name (the accessible label, e.g. "Create Link") — never use the "text" field for this
  strategy "label"  → set label
  strategy "text"   → set text
  strategy "testId" → set testId
  strategy "css"    → set css
  strategy "xpath"  → set xpath

Rules:
- First step should usually be NAVIGATE to baseUrl or loginUrl when authentication is needed.
- order must be contiguous starting at 0.
- NAVIGATE and TYPE require a non-empty value (URL or text to type).
- CLICK, HOVER, TYPE, ASSERT require a valid selector for their strategy.
- Never include passwords, API keys, or credentials in values.
- WAIT may use value as milliseconds (e.g. "2000").
- SCROLL may use value as "up" or "down" or pixel amount.
- Keep steps minimal but sufficient to achieve the workflow description.
- When grounding context is provided, only use selectors that plausibly match listed semantic elements or the DOM summary.
- Prefer strategy "role" or "label" with names from the prioritized elements list; avoid inventing CSS selectors not supported by grounding.
- HEALED SELECTORS: If the grounding includes "Healed Selectors", prefer those selector patterns for the affected steps. They reflect the current DOM state after healing was confirmed to work.
- FAILURE PATTERNS: If the grounding includes "Run Outcome Summary" with commonly-failing step orders, apply extra care when generating actions for those steps. Prefer more robust selectors (aria-label, data-testid, role+name) over positional or text-based ones.`,
  ],
  [
    "human",
    `Workflow name: {workflowName}
Workflow description: {workflowDescription}
Base URL: {baseUrl}
Login URL: {loginUrl}
Has saved browser session: {hasBrowserSession}

{groundingBlock}

Generate Playwright steps to accomplish the workflow description.`,
  ],
]);
