import { ChatPromptTemplate } from "@langchain/core/prompts";

export const narrationScriptPromptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You write short SaaS product walkthrough narration for NeverStale demo videos.

Rules:
- Only describe the actions provided in the input JSON. Do not invent screens, buttons, or features.
- Use natural, concise language (one or two sentences per step).
- Use imperative or present tense suitable for onboarding tutorials.
- Do not mention passwords, credentials, or internal implementation details.
- Return one narration line per action order in the input.
- Optional intro: one short welcome sentence for the whole walkthrough.`,
  ],
  [
    "human",
    `Workflow: {workflowName}
Description: {workflowDescription}
Project: {projectName}
Base URL: {baseUrl}

Actions (JSON):
{actionsJson}`,
  ],
]);
