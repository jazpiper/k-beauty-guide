import { dedupeCandidateImageUrls } from "./dedupe";
import type { ConfidenceHint, ProductCandidate } from "./types";

type ScoreableProductCandidate = Omit<ProductCandidate, "confidenceScore">;

const BASE_SCORE = 0.35;
const MAX_HINT_PENALTY = 0.3;

const hintPenaltyByReasonCode: Record<ConfidenceHint["reasonCode"], number> = {
  missing: 0.08,
  weak_match: 0.05,
  conflict: 0.12,
  parser_fallback: 0.06,
};

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function countMeaningfulStrings(values: string[]): number {
  return values.reduce((count, value) => count + (value?.trim() ? 1 : 0), 0);
}

function normalizedTextLength(value: string | undefined): number {
  return value?.trim().replace(/\s+/g, " ").length ?? 0;
}

function hasPrice(candidate: ScoreableProductCandidate): boolean {
  return (
    typeof candidate.sourcePrice === "number" ||
    typeof candidate.priceKrw === "number"
  );
}

function scoreHintPenalties(hints: ConfidenceHint[]): number {
  const total = hints.reduce((sum, hint) => {
    return sum + hintPenaltyByReasonCode[hint.reasonCode];
  }, 0);

  return Math.min(MAX_HINT_PENALTY, total);
}

function scoreImageCompleteness(candidate: ScoreableProductCandidate): number {
  const imageCount = dedupeCandidateImageUrls(candidate.imageUrls).length;

  if (imageCount === 0) return 0;
  if (imageCount === 1) return 0.08;
  if (imageCount === 2) return 0.11;
  return 0.13;
}

function scoreDescriptionCompleteness(
  candidate: ScoreableProductCandidate,
): number {
  const descriptionLength = normalizedTextLength(candidate.description);

  if (descriptionLength === 0) return 0;
  if (descriptionLength < 60) return 0.04;
  if (descriptionLength < 160) return 0.07;
  return 0.1;
}

function scoreClaimsCompleteness(candidate: ScoreableProductCandidate): number {
  const claimCount = countMeaningfulStrings(candidate.claims);

  if (claimCount === 0) return 0;
  if (claimCount === 1) return 0.03;
  if (claimCount === 2) return 0.05;
  return 0.07;
}

function normalizeScore(score: number): number {
  const clamped = Math.max(0, Math.min(1, score));
  return Number(clamped.toFixed(2));
}

export function scoreCandidate(candidate: ScoreableProductCandidate): number {
  let score = BASE_SCORE;

  if (hasText(candidate.productName)) score += 0.2;
  if (hasText(candidate.brandName)) score += 0.15;
  score += scoreImageCompleteness(candidate);
  score += scoreDescriptionCompleteness(candidate);
  score += scoreClaimsCompleteness(candidate);
  if (hasText(candidate.ingredientTextRaw)) score += 0.15;
  if (hasText(candidate.sourceProductId)) score += 0.05;
  if (hasPrice(candidate)) score += 0.05;

  score -= scoreHintPenalties(candidate.confidenceHints);

  return normalizeScore(score);
}
