import type { VariantScriptGenerateRequest } from "../../types/variantGeneration.js";
import { buildAudienceBlock } from "./audiencePrompts.js";

export const VARIANT_SCRIPT_SYSTEM_PROMPT = `
You are a product education writer. You receive a base narration script for a software product
walkthrough and rewrite it for a specific target audience.

Rules:
- Preserve the scene structure exactly — output one entry per scene, in the same order.
- Do not invent UI elements, features, or steps not present in the base script.
- Keep each scene's narration under 40 words. Voiceover is read aloud; brevity matters.
- Write scene titles as short noun phrases (3–6 words), not full sentences.
- Output ONLY valid JSON matching the schema. No preamble, no markdown fences.
`.trim();

export function buildVariantScriptUserPrompt(
  req: VariantScriptGenerateRequest,
): string {
  const sceneList = req.scenes
    .map(
      (s) =>
        `Scene ${s.sceneOrder}${s.title ? ` (${s.title})` : ""}:\n${s.narrationText ?? "(no narration)"}`,
    )
    .join("\n\n");

  return `
Product: ${req.projectName}
Workflow: ${req.workflowName}
Base URL: ${req.baseUrl}

${buildAudienceBlock(req.audience)}

## Base script (do not copy — rewrite for the target audience)
${req.baseScript}

## Scene-by-scene base narration
${sceneList}

${
  req.grounding?.recentChangesSummary
    ? `## Recent UI changes (mention only if directly relevant)\n${req.grounding.recentChangesSummary}`
    : ""
}

## Output format
Return a JSON object with this exact shape:
{
  "fullScript": "<complete narration as a single paragraph>",
  "scenes": [
    {
      "sceneOrder": <number>,
      "title": "<audience-specific scene title>",
      "narrationText": "<audience-specific narration for this scene, ≤40 words>"
    }
  ]
}
`.trim();
}
