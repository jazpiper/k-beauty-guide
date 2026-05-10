import {
  dedupeCandidateImageUrls,
  normalizeImageUrl,
  normalizeSourceUrl,
} from "./dedupe";
import type {
  ConfidenceHint,
  ProductCandidate,
  ProductImageCandidate,
  ProductTextCandidate,
} from "./types";

export type ReviewQueueCandidateInput = ProductCandidate & {
  imageCandidates?: ProductImageCandidate[];
  descriptionCandidates?: ProductTextCandidate[];
};

export type ReviewCandidateSnapshot = {
  source_id: string;
  snapshot_id: string;
  source_url: string;
  normalized_source_url: string;
  source_product_id?: string;
  brand_name?: string;
  product_name: string;
  category?: string;
  image_urls: string[];
  normalized_image_urls: string[];
  image_candidates: ProductImageCandidate[];
  description?: string;
  description_candidates: ProductTextCandidate[];
  claims: string[];
  confidence_score: number;
  confidence_hints: ConfidenceHint[];
};

export type ReviewItemType =
  | "image_candidate_review"
  | "description_candidate_review"
  | "claim_risk_review";

export type ReviewItemPayload = {
  item_type: ReviewItemType;
  payload: Record<string, unknown> & {
    candidate: ReviewCandidateSnapshot;
  };
};

export type FieldExtractionSuggestionPayload = {
  source_id: string;
  snapshot_id: string;
  source_url: string;
  normalized_source_url: string;
  candidate: ReviewCandidateSnapshot;
  field_name: string;
  raw_value: string | string[];
  normalized_value: string | string[];
  evidence_path?: string;
  risk_flags: string[];
  confidence_hints: ConfidenceHint[];
};

export type ReviewItemDetails = {
  evidencePath?: string;
  rawText?: string;
  normalizedText?: string;
  imageUrl?: string;
  imageRole?: string;
  altText?: string;
  riskFlags?: string[];
  fieldName?: string;
  reviewReason?: string;
};

function normalizeWhitespace(value: string | undefined): string {
  return value ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeClaimList(claims: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const claim of claims) {
    const trimmed = normalizeWhitespace(claim);
    if (!trimmed || seen.has(trimmed)) continue;

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function normalizeConfidenceHints(hints: ConfidenceHint[]): ConfidenceHint[] {
  return hints.slice();
}

function normalizeImageCandidates(
  imageCandidates: ProductImageCandidate[] | undefined,
): ProductImageCandidate[] {
  return (imageCandidates ?? []).map((candidate) => ({ ...candidate }));
}

function normalizeTextCandidates(
  textCandidates: ProductTextCandidate[] | undefined,
): ProductTextCandidate[] {
  return (textCandidates ?? []).map((candidate) => ({ ...candidate }));
}

function normalizeProductImageUrls(candidate: ReviewQueueCandidateInput): string[] {
  const imageUrls = dedupeCandidateImageUrls(candidate.imageUrls);
  return imageUrls;
}

export function buildReviewCandidateSnapshot(
  candidate: ReviewQueueCandidateInput,
): ReviewCandidateSnapshot {
  const imageCandidates = normalizeImageCandidates(candidate.imageCandidates);
  const descriptionCandidates = normalizeTextCandidates(
    candidate.descriptionCandidates,
  );
  const imageUrls = normalizeProductImageUrls(candidate);

  return {
    source_id: candidate.sourceId,
    snapshot_id: candidate.snapshotId,
    source_url: candidate.sourceUrl.trim(),
    normalized_source_url: normalizeSourceUrl(candidate.sourceUrl),
    source_product_id: candidate.sourceProductId?.trim() || undefined,
    brand_name: candidate.brandName?.trim() || undefined,
    product_name: normalizeWhitespace(candidate.productName),
    category: candidate.category?.trim() || undefined,
    image_urls: imageUrls,
    normalized_image_urls: imageUrls.map((imageUrl) =>
      normalizeImageUrl(imageUrl),
    ),
    image_candidates: imageCandidates,
    description: normalizeWhitespace(candidate.description) || undefined,
    description_candidates: descriptionCandidates,
    claims: normalizeClaimList(candidate.claims),
    confidence_score: candidate.confidenceScore,
    confidence_hints: normalizeConfidenceHints(candidate.confidenceHints),
  };
}

export function buildReviewItemPayload(
  candidate: ReviewQueueCandidateInput,
  itemType: ReviewItemType,
  details: ReviewItemDetails = {},
): ReviewItemPayload {
  const summary = buildReviewCandidateSnapshot(candidate);

  return {
    item_type: itemType,
    payload: {
      candidate: summary,
      review_reason: details.reviewReason ?? itemType,
      evidence_path: details.evidencePath,
      field_name: details.fieldName,
      raw_text: details.rawText,
      normalized_text: details.normalizedText,
      image_url: details.imageUrl?.trim() || undefined,
      image_role: details.imageRole ?? "unknown",
      alt_text: details.altText,
      risk_flags: details.riskFlags ?? [],
    },
  };
}

export function buildImageCandidateReviewPayload(
  candidate: ReviewQueueCandidateInput,
  details: ReviewItemDetails = {},
): ReviewItemPayload {
  const summary = buildReviewCandidateSnapshot(candidate);
  const primaryImageUrl = details.imageUrl?.trim() || summary.image_urls[0];

  return {
    item_type: "image_candidate_review",
    payload: {
      candidate: summary,
      review_reason: details.reviewReason ?? "image_candidate_review",
      evidence_path: details.evidencePath,
      image_candidate: {
        image_url: primaryImageUrl || undefined,
        normalized_image_url: primaryImageUrl
          ? normalizeImageUrl(primaryImageUrl)
          : undefined,
        image_urls: summary.image_urls,
        image_role: details.imageRole ?? "unknown",
        alt_text: details.altText,
        image_candidates: summary.image_candidates,
      },
    },
  };
}

export function buildDescriptionCandidateReviewPayload(
  candidate: ReviewQueueCandidateInput,
  details: ReviewItemDetails = {},
): ReviewItemPayload {
  const summary = buildReviewCandidateSnapshot(candidate);
  const rawText = details.rawText ?? summary.description ?? "";
  const normalizedText =
    details.normalizedText ?? (normalizeWhitespace(rawText) || undefined);

  return {
    item_type: "description_candidate_review",
    payload: {
      candidate: summary,
      review_reason: details.reviewReason ?? "description_candidate_review",
      evidence_path: details.evidencePath,
      description_candidate: {
        field_name: "description",
        raw_text: rawText || undefined,
        normalized_text: normalizedText,
        description_candidates: summary.description_candidates,
      },
    },
  };
}

export function buildClaimRiskReviewPayload(
  candidate: ReviewQueueCandidateInput,
  details: ReviewItemDetails = {},
): ReviewItemPayload {
  const summary = buildReviewCandidateSnapshot(candidate);
  const rawText = details.rawText ?? summary.claims.join("\n");
  const normalizedText =
    details.normalizedText ?? (normalizeWhitespace(rawText) || undefined);

  return {
    item_type: "claim_risk_review",
    payload: {
      candidate: summary,
      review_reason: details.reviewReason ?? "claim_risk_review",
      evidence_path: details.evidencePath,
      claim_candidate: {
        field_name: details.fieldName ?? "claims",
        raw_text: rawText || undefined,
        normalized_text: normalizedText,
        risk_flags: details.riskFlags ?? [],
      },
    },
  };
}

export function buildFieldExtractionSuggestionPayload(
  candidate: ReviewQueueCandidateInput,
  details: {
    fieldName: string;
    rawValue: string | string[];
    normalizedValue?: string | string[];
    evidencePath?: string;
    riskFlags?: string[];
    confidenceHints?: ConfidenceHint[];
  },
): FieldExtractionSuggestionPayload {
  const summary = buildReviewCandidateSnapshot(candidate);

  return {
    source_id: summary.source_id,
    snapshot_id: summary.snapshot_id,
    source_url: summary.source_url,
    normalized_source_url: summary.normalized_source_url,
    candidate: summary,
    field_name: details.fieldName,
    raw_value: details.rawValue,
    normalized_value: details.normalizedValue ?? details.rawValue,
    evidence_path: details.evidencePath,
    risk_flags: details.riskFlags ?? [],
    confidence_hints: details.confidenceHints ?? summary.confidence_hints,
  };
}
