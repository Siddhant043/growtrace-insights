import { createHash } from "node:crypto";

const SIGNATURE_TRUNCATION_HEX_LENGTH = 32;

const computeUtcDayKey = (referenceTimestampIso: string): string =>
  referenceTimestampIso.slice(0, 10);

export const computeInsightDeduplicationSignature = (input: {
  userId: string;
  type: string;
  message: string;
  referenceTimestampIso: string;
}): string => {
  const normalizedMessage = input.message.trim().toLowerCase();
  const dayKey = computeUtcDayKey(input.referenceTimestampIso);

  const hashInput = `${input.userId}|${input.type}|${dayKey}|${normalizedMessage}`;
  return createHash("sha256")
    .update(hashInput)
    .digest("hex")
    .slice(0, SIGNATURE_TRUNCATION_HEX_LENGTH);
};
