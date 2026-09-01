const assert = require("assert/strict");
const fs = require("fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const {
  buildReviewCandidateSnapshot,
  buildReviewItemPayload,
  buildImageCandidateReviewPayload,
  buildDescriptionCandidateReviewPayload,
  buildClaimRiskReviewPayload,
  buildFieldExtractionSuggestionPayload,
} = require("../core/reviewPayload.ts");

// Sample baseline candidate input
const baseCandidate = {
  sourceId: "test-source",
  snapshotId: "snap-123",
  sourceUrl: "  https://example.com/product/123  ",
  sourceProductId: "  PROD-123  ",
  brandName: "  Test Brand  ",
  productName: "  Awesome   Moisturizer  ",
  category: "  Skincare  ",
  imageUrls: [
    "https://example.com/img1.jpg?utm_source=test",
    "https://example.com/img1.jpg", // Duplicate normalized
    "https://example.com/img2.jpg",
  ],
  imageCandidates: [
    {
      url: "https://example.com/img1.jpg",
      source: "dom_selector",
      candidateRole: "primary",
    },
  ],
  description: "  A very   hydrating cream.  ",
  descriptionCandidates: [
    {
      text: "A very hydrating cream.",
      source: "dom_selector",
      fieldType: "description",
    },
  ],
  claims: [
    "  Hydrating  ",
    "Hydrating", // Duplicate
    "", // Empty
    "  Shoothing & Calming  ",
  ],
  confidenceScore: 0.85,
  confidenceHints: [
    {
      field: "brandName",
      reasonCode: "weak_match",
      message: "Brand name matched with low confidence",
    },
  ],
  parserVersion: "1.0.0",
};

// 1. Test buildReviewCandidateSnapshot
{
  const snapshot = buildReviewCandidateSnapshot(baseCandidate);

  assert.equal(snapshot.source_id, "test-source");
  assert.equal(snapshot.snapshot_id, "snap-123");
  assert.equal(snapshot.source_url, "https://example.com/product/123");
  assert.equal(snapshot.normalized_source_url, "https://example.com/product/123");
  assert.equal(snapshot.source_product_id, "PROD-123");
  assert.equal(snapshot.brand_name, "Test Brand");
  assert.equal(snapshot.product_name, "Awesome Moisturizer");
  assert.equal(snapshot.category, "Skincare");

  // Deduplicated image URLs
  assert.deepEqual(snapshot.image_urls, [
    "https://example.com/img1.jpg?utm_source=test",
    "https://example.com/img2.jpg",
  ]);
  assert.deepEqual(snapshot.normalized_image_urls, [
    "https://example.com/img1.jpg",
    "https://example.com/img2.jpg",
  ]);

  // Normalized image and description candidates
  assert.deepEqual(snapshot.image_candidates, [
    {
      url: "https://example.com/img1.jpg",
      source: "dom_selector",
      candidateRole: "primary",
    },
  ]);
  assert.notEqual(snapshot.image_candidates, baseCandidate.imageCandidates, "should clone imageCandidates array");

  assert.equal(snapshot.description, "A very hydrating cream.");
  assert.deepEqual(snapshot.description_candidates, [
    {
      text: "A very hydrating cream.",
      source: "dom_selector",
      fieldType: "description",
    },
  ]);
  assert.notEqual(snapshot.description_candidates, baseCandidate.descriptionCandidates, "should clone descriptionCandidates array");

  // Normalized claims (trimmed, deduped, empty filtered)
  assert.deepEqual(snapshot.claims, ["Hydrating", "Shoothing & Calming"]);

  assert.equal(snapshot.confidence_score, 0.85);
  assert.deepEqual(snapshot.confidence_hints, baseCandidate.confidenceHints);
  assert.notEqual(snapshot.confidence_hints, baseCandidate.confidenceHints, "should clone confidenceHints array");
}

// 1b. Test buildReviewCandidateSnapshot edge cases (undefined/empty optional fields)
{
  const minimalCandidate = {
    sourceId: "min-source",
    snapshotId: "min-snap",
    sourceUrl: "https://example.com/item",
    productName: "   ",
    imageUrls: [],
    claims: [],
    confidenceScore: 0.5,
    confidenceHints: [],
    parserVersion: "1.0.0",
  };

  const snapshot = buildReviewCandidateSnapshot(minimalCandidate);

  assert.equal(snapshot.source_product_id, undefined);
  assert.equal(snapshot.brand_name, undefined);
  assert.equal(snapshot.product_name, "");
  assert.equal(snapshot.category, undefined);
  assert.equal(snapshot.description, undefined);
  assert.deepEqual(snapshot.image_candidates, []);
  assert.deepEqual(snapshot.description_candidates, []);
  assert.deepEqual(snapshot.claims, []);
}

// 2. Test buildReviewItemPayload
{
  const payload = buildReviewItemPayload(baseCandidate, "claim_risk_review", {
    evidencePath: "dom > p#claims",
    fieldName: "claims",
    rawText: "raw claim",
    normalizedText: "normalized claim",
    imageUrl: "  https://example.com/img1.jpg  ",
    imageRole: "gallery",
    altText: "product image",
    riskFlags: ["unverified_claim"],
    reviewReason: "custom_reason",
  });

  assert.equal(payload.item_type, "claim_risk_review");
  assert.equal(payload.payload.review_reason, "custom_reason");
  assert.equal(payload.payload.evidence_path, "dom > p#claims");
  assert.equal(payload.payload.field_name, "claims");
  assert.equal(payload.payload.raw_text, "raw claim");
  assert.equal(payload.payload.normalized_text, "normalized claim");
  assert.equal(payload.payload.image_url, "https://example.com/img1.jpg");
  assert.equal(payload.payload.image_role, "gallery");
  assert.equal(payload.payload.alt_text, "product image");
  assert.deepEqual(payload.payload.risk_flags, ["unverified_claim"]);
}

// 2b. Test buildReviewItemPayload defaults
{
  const payload = buildReviewItemPayload(baseCandidate, "claim_risk_review");

  assert.equal(payload.item_type, "claim_risk_review");
  assert.equal(payload.payload.review_reason, "claim_risk_review");
  assert.equal(payload.payload.image_role, "unknown");
  assert.deepEqual(payload.payload.risk_flags, []);
  assert.equal(payload.payload.image_url, undefined);
}

// 3. Test buildImageCandidateReviewPayload
{
  // With explicit imageUrl detail
  const payloadExplicit = buildImageCandidateReviewPayload(baseCandidate, {
    imageUrl: "  https://example.com/custom.jpg  ",
    imageRole: "primary",
    altText: "Custom image",
    evidencePath: "dom > img",
    reviewReason: "check_primary",
  });

  assert.equal(payloadExplicit.item_type, "image_candidate_review");
  assert.equal(payloadExplicit.payload.review_reason, "check_primary");
  assert.equal(payloadExplicit.payload.evidence_path, "dom > img");
  assert.deepEqual(payloadExplicit.payload.image_candidate, {
    image_url: "https://example.com/custom.jpg",
    normalized_image_url: "https://example.com/custom.jpg",
    image_urls: ["https://example.com/img1.jpg?utm_source=test", "https://example.com/img2.jpg"],
    image_role: "primary",
    alt_text: "Custom image",
    image_candidates: [
      {
        url: "https://example.com/img1.jpg",
        source: "dom_selector",
        candidateRole: "primary",
      },
    ],
  });

  // Default fallback (using first image URL from summary)
  const payloadFallback = buildImageCandidateReviewPayload(baseCandidate);
  assert.equal(payloadFallback.payload.review_reason, "image_candidate_review");
  assert.equal(
    payloadFallback.payload.image_candidate.image_url,
    "https://example.com/img1.jpg?utm_source=test",
  );
  assert.equal(
    payloadFallback.payload.image_candidate.normalized_image_url,
    "https://example.com/img1.jpg",
  );
  assert.equal(payloadFallback.payload.image_candidate.image_role, "unknown");

  // When candidate has no images at all
  const noImageCandidate = { ...baseCandidate, imageUrls: [] };
  const payloadNoImage = buildImageCandidateReviewPayload(noImageCandidate);
  assert.equal(payloadNoImage.payload.image_candidate.image_url, undefined);
  assert.equal(payloadNoImage.payload.image_candidate.normalized_image_url, undefined);
}

// 4. Test buildDescriptionCandidateReviewPayload
{
  // With explicit rawText and normalizedText
  const payloadExplicit = buildDescriptionCandidateReviewPayload(baseCandidate, {
    rawText: "Raw description text",
    normalizedText: "Normalized description text",
    evidencePath: "dom > div.desc",
  });

  assert.equal(payloadExplicit.item_type, "description_candidate_review");
  assert.equal(payloadExplicit.payload.review_reason, "description_candidate_review");
  assert.equal(payloadExplicit.payload.evidence_path, "dom > div.desc");
  assert.deepEqual(payloadExplicit.payload.description_candidate, {
    field_name: "description",
    raw_text: "Raw description text",
    normalized_text: "Normalized description text",
    description_candidates: [
      {
        text: "A very hydrating cream.",
        source: "dom_selector",
        fieldType: "description",
      },
    ],
  });

  // Fallback to summary description
  const payloadFallback = buildDescriptionCandidateReviewPayload(baseCandidate);
  assert.equal(payloadFallback.payload.description_candidate.raw_text, "A very hydrating cream.");
  assert.equal(payloadFallback.payload.description_candidate.normalized_text, "A very hydrating cream.");

  // When description is empty/undefined
  const noDescCandidate = { ...baseCandidate, description: undefined, descriptionCandidates: [] };
  const payloadEmpty = buildDescriptionCandidateReviewPayload(noDescCandidate);
  assert.equal(payloadEmpty.payload.description_candidate.raw_text, undefined);
  assert.equal(payloadEmpty.payload.description_candidate.normalized_text, undefined);
}

// 5. Test buildClaimRiskReviewPayload
{
  // Explicit details
  const payloadExplicit = buildClaimRiskReviewPayload(baseCandidate, {
    rawText: "Claims raw",
    normalizedText: "Claims normalized",
    fieldName: "custom_claims",
    riskFlags: ["medical_claim"],
    evidencePath: "dom > ul.claims",
  });

  assert.equal(payloadExplicit.item_type, "claim_risk_review");
  assert.equal(payloadExplicit.payload.review_reason, "claim_risk_review");
  assert.deepEqual(payloadExplicit.payload.claim_candidate, {
    field_name: "custom_claims",
    raw_text: "Claims raw",
    normalized_text: "Claims normalized",
    risk_flags: ["medical_claim"],
  });

  // Fallback joining claims with newline
  const payloadFallback = buildClaimRiskReviewPayload(baseCandidate);
  assert.equal(
    payloadFallback.payload.claim_candidate.raw_text,
    "Hydrating\nShoothing & Calming",
  );
  assert.equal(
    payloadFallback.payload.claim_candidate.normalized_text,
    "Hydrating Shoothing & Calming",
  );
  assert.equal(payloadFallback.payload.claim_candidate.field_name, "claims");
  assert.deepEqual(payloadFallback.payload.claim_candidate.risk_flags, []);

  // Empty claims fallback
  const noClaimsCandidate = { ...baseCandidate, claims: [] };
  const payloadEmpty = buildClaimRiskReviewPayload(noClaimsCandidate);
  assert.equal(payloadEmpty.payload.claim_candidate.raw_text, undefined);
  assert.equal(payloadEmpty.payload.claim_candidate.normalized_text, undefined);
}

// 6. Test buildFieldExtractionSuggestionPayload
{
  // Explicit details
  const detailsExplicit = {
    fieldName: "brand_name",
    rawValue: "Raw Brand",
    normalizedValue: "Normalized Brand",
    evidencePath: "meta[name='brand']",
    riskFlags: ["typo"],
    confidenceHints: [
      {
        field: "brandName",
        reasonCode: "missing",
        message: "Missing brand name",
      },
    ],
  };

  const payloadExplicit = buildFieldExtractionSuggestionPayload(
    baseCandidate,
    detailsExplicit,
  );

  assert.equal(payloadExplicit.source_id, "test-source");
  assert.equal(payloadExplicit.snapshot_id, "snap-123");
  assert.equal(payloadExplicit.source_url, "https://example.com/product/123");
  assert.equal(payloadExplicit.normalized_source_url, "https://example.com/product/123");
  assert.equal(payloadExplicit.field_name, "brand_name");
  assert.equal(payloadExplicit.raw_value, "Raw Brand");
  assert.equal(payloadExplicit.normalized_value, "Normalized Brand");
  assert.equal(payloadExplicit.evidence_path, "meta[name='brand']");
  assert.deepEqual(payloadExplicit.risk_flags, ["typo"]);
  assert.deepEqual(payloadExplicit.confidence_hints, detailsExplicit.confidenceHints);

  // Defaults and fallbacks
  const detailsDefaults = {
    fieldName: "category",
    rawValue: ["Cat 1", "Cat 2"],
  };

  const payloadDefaults = buildFieldExtractionSuggestionPayload(
    baseCandidate,
    detailsDefaults,
  );

  assert.deepEqual(payloadDefaults.normalized_value, ["Cat 1", "Cat 2"]);
  assert.deepEqual(payloadDefaults.risk_flags, []);
  assert.deepEqual(payloadDefaults.confidence_hints, baseCandidate.confidenceHints);
}

console.log("reviewPayload tests passed");
