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

function normalizeScore(score: number): number {
  const clamped = Math.max(0, Math.min(1, score));
  return Number(clamped.toFixed(2));
}

export function scoreCandidate(candidate: ScoreableProductCandidate): number {
  let score = BASE_SCORE;

  if (hasText(candidate.productName)) score += 0.2;
  if (hasText(candidate.brandName)) score += 0.15;
  if (candidate.imageUrls.length > 0) score += 0.1;
  if (hasText(candidate.ingredientTextRaw)) score += 0.15;
  if (hasText(candidate.sourceProductId)) score += 0.05;
  if (hasPrice(candidate)) score += 0.05;

  score -= scoreHintPenalties(candidate.confidenceHints);

  return normalizeScore(score);
}
