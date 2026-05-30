export const FEATURE_SIGNAL_SYSTEM_PROMPT = `
You receive a software development event (PR merge, ticket close, doc update, Slack message) and extract structured signals.

Return ONLY valid JSON with this exact shape:
{
  "summary": "<one sentence, non-technical, describes the user-facing change>",
  "affectedFeatures": ["<route or feature name>", ...],
  "userFacingConfidence": <0.0 to 1.0>
}

Rules:
- summary: write for a non-technical stakeholder, ≤ 20 words
- affectedFeatures: URL paths (/settings/billing) OR feature names ("billing", "checkout"). Max 5 entries.
- userFacingConfidence: probability that this change affects a user-visible UI or flow. 0 = pure infra/refactor, 1 = obvious new user-facing feature.
- No preamble, no markdown, no explanation. JSON only.
`.trim();

export function buildFeatureSignalUserPrompt(
  eventType: string,
  provider: string,
  rawPayload: Record<string, unknown>,
): string {
  const salientFields = extractSalientFields(eventType, provider, rawPayload);
  return `Event type: ${eventType}\nProvider: ${provider}\n\n${salientFields}`;
}

function extractSalientFields(
  eventType: string,
  _provider: string,
  payload: Record<string, unknown>,
): string {
  // Extract the most useful fields per event type to keep prompt compact
  if (eventType === 'PR_MERGED') {
    const pr = (payload['pull_request'] ?? payload) as Record<string, unknown>;
    const lines = [
      `Title: ${pr['title'] ?? ''}`,
      `Body: ${String(pr['body'] ?? '').slice(0, 500)}`,
    ];
    const files = payload['files'] as Array<{ filename: string }> | undefined;
    if (files?.length) {
      lines.push(`Changed files: ${files.slice(0, 10).map(f => f.filename).join(', ')}`);
    }
    return lines.join('\n');
  }

  if (eventType === 'ISSUE_CLOSED' || eventType === 'ISSUE_CREATED') {
    const issue = (payload['fields'] ?? payload) as Record<string, unknown>;
    return [
      `Title: ${(issue['summary'] ?? issue['title'] ?? payload['identifier'] ?? '') as string}`,
      `Description: ${String(issue['description'] ?? '').slice(0, 500)}`,
    ].join('\n');
  }

  if (eventType === 'PAGE_UPDATED') {
    const props = payload['properties'] as Record<string, unknown> | undefined;
    const title = props?.['title'] as { title?: Array<{ plain_text: string }> } | undefined;
    const titleText = title?.title?.map(t => t.plain_text).join('') ?? '';
    return `Page title: ${titleText}`;
  }

  if (eventType === 'MESSAGE_POSTED') {
    return `Message: ${String(payload['text'] ?? '').slice(0, 300)}`;
  }

  if (eventType === 'RELEASE_PUBLISHED') {
    const release = (payload['release'] ?? payload) as Record<string, unknown>;
    return [
      `Release name: ${release['name'] ?? release['tag_name'] ?? ''}`,
      `Body: ${String(release['body'] ?? '').slice(0, 500)}`,
    ].join('\n');
  }

  // Fallback: stringify top-level keys
  return Object.entries(payload)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`)
    .join('\n');
}
