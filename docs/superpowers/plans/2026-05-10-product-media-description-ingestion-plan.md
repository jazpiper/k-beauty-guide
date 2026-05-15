# Product Media and Description Ingestion Plan

## Purpose

Build a safe MVP process for collecting product images and descriptive copy without treating crawled content as automatically publishable catalog data.

This plan extends the existing product ingestion pipeline. It focuses on two fields with higher quality and rights risk:

- product images
- product detail descriptions, claims, and usage copy

## Scope

### In Scope

- Extract image candidates from official product pages and structured product data.
- Extract description candidates from product detail pages.
- Store source evidence for every candidate.
- Score candidates for confidence and review priority.
- Send risky, incomplete, or ambiguous candidates to the admin review queue.
- Publish only reviewed and normalized image/description data.

### Out of Scope

- Full browser automation.
- Scraping checkout, cart, account, search, filter, sort, or personalized pages.
- Rehosting downloaded image files in MVP.
- Publishing raw brand copy directly without review.
- Making medical, therapeutic, or regulatory claims from crawled text.

## Source Priority

1. Brand official product pages.
2. Brand official Shopify product JSON when available.
3. Official marketplace brand stores.
4. Multi-brand retailers only after official-source connectors are stable.

For MVP, prefer official source data even when retailer data is richer.

## Image Collection Strategy

### Candidate Sources

Collect image candidates in this order:

1. JSON-LD `Product.image`.
2. Shopify product JSON `images`.
3. Open Graph `og:image`.
4. Product gallery images near title/price/ingredient sections.
5. Primary product image from sitemap or embedded product payload.

### Candidate Fields

Each image candidate should keep:

- `source_id`
- `source_url`
- `source_product_id`
- `image_url`
- `candidate_role`: `primary`, `gallery`, `swatch`, `unknown`
- `alt_text`
- `width`
- `height`
- `position`
- `content_type`
- `source_evidence`: selector, JSON path, or structured-data path
- `confidence_score`
- `review_status`

### MVP Storage Rule

Store the remote image URL and evidence. Do not download and rehost images during MVP.

Rehosting through Supabase Storage or Vercel Blob can be added later only after source terms and image usage rights are reviewed.

### Image Quality Rules

Reject or send to review when:

- URL is not `http` or `https`.
- Image is smaller than the configured product-image minimum.
- Image looks like a logo, banner, icon, review photo, or promotional graphic.
- Image URL is unstable, signed, or session-dependent.
- Image host is unrelated to the source.
- Duplicate image URL already exists for the same product.

Prefer:

- white or clean product packshot
- highest non-banner resolution
- official brand CDN
- first structured product image

## Description Collection Strategy

### Candidate Sources

Collect text candidates in this order:

1. JSON-LD `Product.description`.
2. Shopify product body HTML.
3. Product detail description section.
4. Benefit bullet list.
5. How-to-use section.
6. Skin type or concern section.
7. Ingredient callout section.

### Candidate Fields

Each description candidate should keep:

- `source_id`
- `source_url`
- `source_product_id`
- `field_type`: `description`, `claim`, `benefit`, `how_to_use`, `skin_type_note`, `ingredient_callout`
- `raw_text`
- `normalized_text`
- `language`
- `source_evidence`: selector, JSON path, or section heading
- `confidence_score`
- `risk_flags`
- `review_status`

### Public Description Rule

Do not publish raw brand copy directly as the main app description.

Use reviewed normalized copy:

- short product summary
- neutral wording
- no unsupported medical or therapeutic claims
- no unverified safety promise
- no exaggerated before/after language

## Claim Risk Handling

Send candidate to review when text contains:

- acne cure or treatment claims
- whitening or pigmentation treatment claims
- anti-inflammatory or drug-like wording
- eczema, rosacea, dermatitis, or medical-condition references
- SPF/PA claims without supporting source fields
- pregnancy-safe, hypoallergenic, non-comedogenic, or dermatologist-tested claims without evidence

Review output should decide:

- publish as neutral copy
- keep as brand claim with source label
- hide from public detail
- attach safety or evidence note

## Pipeline Changes

```text
source policy
-> robots/rate/path checks
-> product page fetch
-> raw snapshot store
-> connector parser
-> image candidate extraction
-> description candidate extraction
-> deterministic dedupe
-> confidence scoring
-> risk flagging
-> admin review queue
-> normalized products/product_images/product_sources update
-> public app reads reviewed data only
```

## Connector Contract Additions

Extend `ProductCandidate` with optional media and text candidates:

```ts
type ProductImageCandidate = {
  imageUrl: string;
  role: "primary" | "gallery" | "swatch" | "unknown";
  altText?: string;
  width?: number;
  height?: number;
  position?: number;
  evidencePath: string;
  confidenceHints: ConfidenceHint[];
};

type ProductTextCandidate = {
  fieldType:
    | "description"
    | "claim"
    | "benefit"
    | "how_to_use"
    | "skin_type_note"
    | "ingredient_callout";
  rawText: string;
  normalizedText?: string;
  language?: string;
  evidencePath: string;
  riskFlags: string[];
  confidenceHints: ConfidenceHint[];
};
```

The connector may extract these fields, but it must not publish them.

## Database Follow-Up

The existing data model already includes `product_images`, `product_sources`, `raw_product_snapshots`, `product_candidates`, and `review_items`.

Recommended follow-up:

- store MVP image candidates in existing `product_candidates.image_urls`
- store MVP text candidates in existing `product_candidates.description` and `product_candidates.claims`
- keep richer extractor evidence in `review_items.payload` or `field_extraction_suggestions`, not in a non-existent candidate payload column
- store raw extracted text in `raw_product_snapshots` or review payloads, not public product fields
- add review item types:
  - `image_candidate_review`
  - `description_candidate_review`
  - `claim_risk_review`
- track approved image source in `product_sources`

## Admin Review Requirements

The review UI should show:

- product identity and source
- current public product data
- image candidate preview
- image source URL and evidence path
- raw description text
- normalized proposed description
- risk flags
- confidence score
- approve/reject/needs info controls

Approval actions:

- set primary image
- approve gallery image
- approve normalized description
- mark claim as source-labeled brand claim
- reject candidate

## Source-Specific Parser Notes (First Dry Run)

Dry run date: 2026-05-10  
Fixture: `crawler/fixtures/official-brand-product-snapshot.html`  
Companion expectation map: `crawler/fixtures/official-brand-product-snapshot.json`

- JSON-LD `Product.image` is the most stable primary/gallery signal in this fixture and should be parsed before DOM gallery images.
- `og:image` is present and useful as fallback evidence, but role should default to `unknown` unless reinforced by product-context selectors.
- Product gallery images under `section[aria-label="Product gallery"] img` are clean secondary candidates and should keep ordinal `position`.
- `Product.description` from JSON-LD is concise and safe as a source candidate, but still review-gated for public normalization.
- Benefit text from `#benefits li` and usage text from `#how-to-use p` are straightforward section-based extracts.
- Claim text in `#claims p` includes risky phrase `"treat acne"` and should trigger `medical_treatment` + `disease_reference` flags and review routing.
- For this source shape, heading-anchored sections (`Benefits`, `Claims`, `How to use`) appear reliable enough for deterministic extractor helpers.

## MVP Implementation Tasks

- [x] Extend crawler core types with `ProductImageCandidate` and `ProductTextCandidate`.
- [x] Add extractor helpers for JSON-LD, Open Graph, Shopify product JSON, and simple DOM selectors.
- [x] Add image URL safety validation: only `http` and `https`.
- [x] Add image candidate dedupe by normalized URL.
- [x] Add description text cleanup: HTML strip, whitespace normalize, length cap.
- [x] Add claim risk detector for medical/regulatory phrases.
- [x] Update confidence scoring to include image and description completeness.
- [x] Write candidates into review queue payloads.
- [x] Extend Admin Review shell to preview image/text candidates.
- [x] Add smoke fixtures for one official-brand product page snapshot.
- [x] Document source-specific parser notes after first dry run.

## Verification Plan

For each source connector:

1. Run robots and terms review.
2. Run one-product dry run against staging or stored fixture.
3. Confirm raw snapshot is stored.
4. Confirm image and description candidates are generated.
5. Confirm unsafe URLs and risky claims go to review.
6. Confirm approved data appears in product detail.
7. Confirm rejected data stays hidden.

Do not mark a connector production-ready until review queue behavior is verified.

## Open Decisions

- Whether to cache approved images in owned storage after MVP.
- Minimum image size threshold.
- Whether normalized descriptions are written by admin manually or assisted by an AI quality layer.
- How to label brand claims in the public UI.
- Whether retailer images can be used when official images are missing.
