import type { VideoVariantAudience } from "../../types/variantGeneration.js";

interface AudienceDirective {
  persona:     string;
  tone:        string;
  emphasis:    string;
  avoid:       string;
  sceneIntros: string;
  ctaStyle:    string;
}

export const AUDIENCE_DIRECTIVES: Record<VideoVariantAudience, AudienceDirective> = {
  SALES: {
    persona:     "A busy decision-maker evaluating this product against competitors.",
    tone:        "Confident, outcome-focused, concise. Every sentence earns its place.",
    emphasis:    "Business value, ROI, time saved, competitive differentiation. Lead with the \"so what\".",
    avoid:       "Technical jargon, implementation details, error states, edge cases.",
    sceneIntros: "Open each scene with the business outcome, then show how the UI achieves it.",
    ctaStyle:    "Close with urgency and a clear next step. \"Book a demo\", \"Start your trial\".",
  },
  ONBOARDING: {
    persona:     "A new user who just signed up and is logging in for the first time.",
    tone:        "Warm, encouraging, step-by-step. Nothing assumed. Celebrate small wins.",
    emphasis:    "What to do first, why each step matters, what success looks like.",
    avoid:       "Advanced features, edge cases, anything that overwhelms before the user has a foothold.",
    sceneIntros: "Orient the user: \"You're now on the X screen. Here's what you'll do here.\"",
    ctaStyle:    "Positive reinforcement. \"Great — you've set up your first project.\"",
  },
  SUPPORT: {
    persona:     "An existing user who is stuck on a specific task and came to the help center.",
    tone:        "Direct, precise, scannable. Get to the answer immediately.",
    emphasis:    "Exact steps, exact button names, exact locations in the UI. Nothing vague.",
    avoid:       "Background context the user already has, marketing language, feature intros.",
    sceneIntros: "State the action immediately. \"To do X, navigate to Y, then click Z.\"",
    ctaStyle:    "Confirm completion. \"Your workflow is now saved and ready to run.\"",
  },
  TRAINING: {
    persona:     "A team member (sales rep, support agent, CSM) learning the product for their role.",
    tone:        "Professional, structured, pedagogical. Explain the \"why\" alongside the \"how\".",
    emphasis:    "Concepts, best practices, role-specific workflows, common mistakes to avoid.",
    avoid:       "Raw feature descriptions without context, overly basic explanations.",
    sceneIntros: "Frame each scene as a learning objective. \"In this section you'll learn how to...\"",
    ctaStyle:    "Summarise the key takeaway. \"Remember: always X before Y to avoid Z.\"",
  },
};

export function buildAudienceBlock(audience: VideoVariantAudience): string {
  const d = AUDIENCE_DIRECTIVES[audience];
  return `
## Target audience: ${audience}
- **Persona:** ${d.persona}
- **Tone:** ${d.tone}
- **Emphasise:** ${d.emphasis}
- **Avoid:** ${d.avoid}
- **Scene openings:** ${d.sceneIntros}
- **CTA style:** ${d.ctaStyle}
`.trim();
}
