/**
 * Shared LLM context for GrowTrace insight prompts.
 * See docs/insights-prompt-audit.md for ICP mapping and rewrite rationale.
 */

/** Product positioning — import into each insight prompt system message. */
export const GROWTRACE_PRODUCT_CONTEXT = [
  "GrowTrace helps businesses that monetize traffic understand which visitors are engaged after the click—not just click counts.",
  "Typical users: course creators, coaches, ecommerce/D2C brands, marketing agencies, SaaS founders, and creators selling via affiliates or funnels.",
  "Prioritize post-click signals: bounce rate, session duration, engagement score, returning users, and funnel drop-offs.",
  "Frame insights around traffic quality, conversion potential, and where to optimize—not vanity views or impressions.",
].join(" ");

/** Output constraints shared across all insight types. */
export const INSIGHT_OUTPUT_RULES = [
  "Output plain English; no markdown.",
  "One short sentence per insight (max 220 characters).",
  "Name specific platforms, link short codes, or metrics when data provides them.",
  "Confidence in [0, 1]; lower when sample size is small.",
  "Avoid creator-only jargon ('your audience', 'post more') unless the signal supports a clear monetization action.",
  "Avoid hedging: 'consider', 'you might', 'monitor closely', 'look into analytics'.",
].join(" ");
