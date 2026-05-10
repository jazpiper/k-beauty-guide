import { scoreCandidate } from "./confidenceScorer";
import { dedupeCandidateImageUrls } from "./dedupe";
import {
  extractImageCandidatesFromDomSelectors,
  extractImageCandidatesFromJsonLd,
  extractImageCandidatesFromOpenGraph,
  extractImageCandidatesFromShopifyProductJson,
} from "./mediaExtractors";
import {
  cleanupDescriptionText,
  detectClaimRiskFlags,
  extractDescriptionCandidatesFromDomSelectors,
  extractDescriptionCandidatesFromJsonLd,
  extractDescriptionCandidatesFromOpenGraph,
  extractDescriptionCandidatesFromShopifyProductJson,
} from "./textExtractors";
import {
  buildClaimRiskReviewPayload,
  buildDescriptionCandidateReviewPayload,
  buildImageCandidateReviewPayload,
  type ReviewItemPayload,
} from "./reviewPayload";
import type {
  ConfidenceHint,
  ProductCandidate,
  ProductImageCandidate,
  ProductTextCandidate,
} from "./types";

type UnknownRecord = Record<string, unknown>;

export type ProductMediaDescriptionExtractionInput = {
  html?: string;
  jsonPayload?: unknown;
  sourceId: string;
  snapshotId: string;
  sourceUrl: string;
  sourceProductId?: string;
  domImageSelectors?: string[];
  domTextSelectors?: string[];
};

export type ProductMediaDescriptionCandidateOutput = {
  candidate: ProductCandidate;
  reviewPayloads: ReviewItemPayload[];
};

const PARSER_VERSION = "product-media-description-v1";

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function getAttrValue(attrs: string, attrName: string): string | undefined {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  return attrs.match(pattern)?.[1];
}

function normalizeWhitespace(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function readString(value: unknown): string | undefined {
  const normalized = normalizeWhitespace(value);
  return normalized || undefined;
}

function getFirstRecordValue(value: unknown, key: string): unknown {
  const record = asRecord(value);
  if (!record) return undefined;
  return record[key];
}

function scriptJsonLdPayloads(html: string | undefined): unknown[] {
  if (!html) return [];
  const payloads: unknown[] = [];
  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      payloads.push(JSON.parse(rawJson));
    } catch {
      continue;
    }
  }

  return payloads;
}

function collectProductRecords(value: unknown, output: UnknownRecord[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectProductRecords(item, output);
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  const typeValue = record["@type"];
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  if (types.some((type) => String(type).toLowerCase() === "product")) {
    output.push(record);
  }

  if (Array.isArray(record["@graph"])) {
    collectProductRecords(record["@graph"], output);
  }
}

function getProductRecords(payloads: unknown[]): UnknownRecord[] {
  const records: UnknownRecord[] = [];
  for (const payload of payloads) collectProductRecords(payload, records);
  return records;
}

function imageEvidenceByUrl(productRecords: UnknownRecord[]): Map<string, string> {
  const evidence = new Map<string, string>();

  for (const product of productRecords) {
    const imageValue = product.image;
    const values = Array.isArray(imageValue) ? imageValue : [imageValue];
    values.forEach((entry, index) => {
      const url =
        typeof entry === "string"
          ? entry
          : readString(getFirstRecordValue(entry, "url"));
      if (url && !evidence.has(url)) {
        evidence.set(url, `jsonld:Product.image[${index}]`);
      }
    });
  }

  return evidence;
}

function descriptionEvidenceByText(productRecords: UnknownRecord[]): Map<string, string> {
  const evidence = new Map<string, string>();

  for (const product of productRecords) {
    const text = cleanupDescriptionText(product.description);
    if (text && !evidence.has(text)) {
      evidence.set(text, "jsonld:Product.description");
    }
  }

  return evidence;
}

function parseProductMeta(productRecords: UnknownRecord[]): {
  brandName?: string;
  productName?: string;
  sourceProductId?: string;
} {
  const product = productRecords[0];
  const brand = asRecord(product?.brand);

  return {
    brandName: readString(brand?.name ?? product?.brand),
    productName: readString(product?.name),
    sourceProductId: readString(product?.sku),
  };
}

function deriveImageRole(
  source: ProductImageCandidate["source"],
  position: number,
): ProductImageCandidate["candidateRole"] {
  if (source === "open_graph") return "unknown";
  return position === 0 ? "primary" : "gallery";
}

function imageConfidence(source: ProductImageCandidate["source"]): number {
  if (source === "json_ld") return 0.92;
  if (source === "shopify_product_json") return 0.9;
  if (source === "open_graph") return 0.72;
  return 0.66;
}

function enrichImageCandidates(
  candidates: ProductImageCandidate[],
  options: {
    evidenceByUrl?: Map<string, string>;
    fallbackEvidence?: string;
    roleOffset?: number;
  } = {},
): ProductImageCandidate[] {
  return candidates.map((candidate, index) => {
    const position = (options.roleOffset ?? 0) + index;
    return {
      ...candidate,
      candidateRole: deriveImageRole(candidate.source, position),
      sourceEvidence:
        options.evidenceByUrl?.get(candidate.url) ??
        candidate.selector ??
        options.fallbackEvidence,
      position,
      contentType: "image",
      reviewStatus: "needs_review",
      imageStoragePolicy: "remote_url_only",
      confidence: candidate.confidence ?? imageConfidence(candidate.source),
    };
  });
}

function dedupeImages(candidates: ProductImageCandidate[]): ProductImageCandidate[] {
  const seen = new Set<string>();
  const output: ProductImageCandidate[] = [];

  for (const candidate of candidates) {
    const normalized = dedupeCandidateImageUrls([candidate.url])[0];
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(candidate);
  }

  return output.map((candidate, index) => ({
    ...candidate,
    candidateRole:
      candidate.source === "open_graph"
        ? candidate.candidateRole
        : index === 0
          ? "primary"
          : candidate.candidateRole === "swatch"
            ? "swatch"
            : "gallery",
    position: candidate.position ?? index,
  }));
}

function getDomImageDetails(
  html: string | undefined,
  selector: string | undefined,
): Pick<ProductImageCandidate, "altText" | "width" | "height"> {
  if (!html || !selector) return {};

  const sectionMatch = selector.match(
    /^section\[aria-label=["']([^"']+)["']\]\s+img(?:\[(\d+)\])?$/i,
  );
  if (!sectionMatch) return {};

  const sectionRegex = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  for (const match of html.matchAll(sectionRegex)) {
    const attrs = match[1] ?? "";
    if (getAttrValue(attrs, "aria-label") !== sectionMatch[1]) continue;

    const imgTags = Array.from((match[2] ?? "").matchAll(/<img\b([^>]*)>/gi));
    const index = sectionMatch[2] ? Number.parseInt(sectionMatch[2], 10) : 0;
    const imgAttrs = imgTags[index]?.[1] ?? "";
    return {
      altText: getAttrValue(imgAttrs, "alt"),
      width: Number.parseInt(getAttrValue(imgAttrs, "width") ?? "", 10) || undefined,
      height: Number.parseInt(getAttrValue(imgAttrs, "height") ?? "", 10) || undefined,
    };
  }

  return {};
}

function fieldTypeForSelector(
  selector: string | undefined,
): ProductTextCandidate["fieldType"] {
  if (!selector) return "unknown";
  if (selector.includes("benefit")) return "benefit";
  if (selector.includes("claim")) return "claim";
  if (selector.includes("how-to-use")) return "how_to_use";
  if (selector.toLowerCase().includes("description")) return "description";
  return "unknown";
}

function textConfidence(source: ProductTextCandidate["source"]): number {
  if (source === "json_ld") return 0.9;
  if (source === "shopify_product_json") return 0.88;
  if (source === "open_graph") return 0.68;
  return 0.63;
}

function enrichTextCandidates(
  candidates: ProductTextCandidate[],
  options: {
    evidenceByText?: Map<string, string>;
    fieldType?: ProductTextCandidate["fieldType"];
  } = {},
): ProductTextCandidate[] {
  return candidates.map((candidate) => {
    const fieldType = options.fieldType ?? fieldTypeForSelector(candidate.selector);
    return {
      ...candidate,
      fieldType,
      sourceEvidence:
        options.evidenceByText?.get(candidate.text) ?? candidate.selector,
      riskFlags: detectClaimRiskFlags(candidate.text),
      reviewStatus: "needs_review",
      confidence: candidate.confidence ?? textConfidence(candidate.source),
    };
  });
}

function dedupeTextCandidates(
  candidates: ProductTextCandidate[],
): ProductTextCandidate[] {
  const seen = new Set<string>();
  const output: ProductTextCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.text)) continue;
    seen.add(candidate.text);
    output.push(candidate);
  }

  return output;
}

function createConfidenceHints(candidate: Omit<ProductCandidate, "confidenceScore">): ConfidenceHint[] {
  const hints: ConfidenceHint[] = [];
  if (!candidate.brandName) {
    hints.push({
      field: "brandName",
      reasonCode: "missing",
      message: "Brand name was not found in official structured data.",
    });
  }
  if (!candidate.productName) {
    hints.push({
      field: "productName",
      reasonCode: "missing",
      message: "Product name was not found in official structured data.",
    });
  }
  if (candidate.imageUrls.length === 0) {
    hints.push({
      field: "imageUrls",
      reasonCode: "missing",
      message: "No safe official image URLs were extracted.",
    });
  }
  return hints;
}

function collectImages(input: ProductMediaDescriptionExtractionInput): ProductImageCandidate[] {
  const jsonLdPayloads = scriptJsonLdPayloads(input.html);
  const productRecords = getProductRecords(jsonLdPayloads);
  const evidence = imageEvidenceByUrl(productRecords);
  const candidates: ProductImageCandidate[] = [];

  for (const payload of jsonLdPayloads) {
    candidates.push(
      ...enrichImageCandidates(extractImageCandidatesFromJsonLd(payload), {
        evidenceByUrl: evidence,
      }),
    );
  }

  if (input.jsonPayload) {
    candidates.push(
      ...enrichImageCandidates(
        extractImageCandidatesFromShopifyProductJson(input.jsonPayload),
      ),
    );
  }

  candidates.push(
    ...enrichImageCandidates(extractImageCandidatesFromOpenGraph(input.html ?? ""), {
      fallbackEvidence: "meta[property='og:image']",
      roleOffset: candidates.length,
    }),
  );

  const domCandidates = extractImageCandidatesFromDomSelectors(
    input.html ?? "",
    input.domImageSelectors ?? [],
  ).map((candidate) => ({
    ...candidate,
    ...getDomImageDetails(input.html, candidate.selector),
  }));
  candidates.push(
    ...enrichImageCandidates(domCandidates, { roleOffset: candidates.length }),
  );

  return dedupeImages(candidates);
}

function collectTexts(input: ProductMediaDescriptionExtractionInput): ProductTextCandidate[] {
  const jsonLdPayloads = scriptJsonLdPayloads(input.html);
  const productRecords = getProductRecords(jsonLdPayloads);
  const evidence = descriptionEvidenceByText(productRecords);
  const candidates: ProductTextCandidate[] = [];

  for (const payload of jsonLdPayloads) {
    candidates.push(
      ...enrichTextCandidates(extractDescriptionCandidatesFromJsonLd(payload), {
        evidenceByText: evidence,
        fieldType: "description",
      }),
    );
  }

  if (input.jsonPayload) {
    candidates.push(
      ...enrichTextCandidates(
        extractDescriptionCandidatesFromShopifyProductJson(input.jsonPayload),
        { fieldType: "description" },
      ),
    );
  }

  candidates.push(
    ...enrichTextCandidates(
      extractDescriptionCandidatesFromOpenGraph(input.html ?? ""),
      { fieldType: "description" },
    ),
  );
  candidates.push(
    ...enrichTextCandidates(
      extractDescriptionCandidatesFromDomSelectors(
        input.html ?? "",
        input.domTextSelectors ?? [],
      ),
    ),
  );

  return dedupeTextCandidates(candidates);
}

function buildReviewPayloads(candidate: ProductCandidate): ReviewItemPayload[] {
  const payloads: ReviewItemPayload[] = [];

  for (const imageCandidate of candidate.imageCandidates ?? []) {
    payloads.push(
      buildImageCandidateReviewPayload(candidate, {
        evidencePath: imageCandidate.sourceEvidence,
        imageUrl: imageCandidate.url,
        imageRole: imageCandidate.candidateRole,
        altText: imageCandidate.altText,
        reviewReason: "crawler_image_candidate_needs_review",
      }),
    );
  }

  for (const textCandidate of candidate.descriptionCandidates ?? []) {
    payloads.push(
      buildDescriptionCandidateReviewPayload(candidate, {
        evidencePath: textCandidate.sourceEvidence,
        rawText: textCandidate.text,
        normalizedText: textCandidate.text,
        reviewReason: "crawler_description_candidate_needs_review",
      }),
    );

    if ((textCandidate.riskFlags ?? []).length > 0) {
      payloads.push(
        buildClaimRiskReviewPayload(candidate, {
          evidencePath: textCandidate.sourceEvidence,
          rawText: textCandidate.text,
          normalizedText: textCandidate.text,
          riskFlags: textCandidate.riskFlags,
          fieldName: textCandidate.fieldType ?? "claims",
          reviewReason: "crawler_claim_risk_needs_review",
        }),
      );
    }
  }

  return payloads;
}

export function buildProductMediaDescriptionCandidateOutput(
  input: ProductMediaDescriptionExtractionInput,
): ProductMediaDescriptionCandidateOutput {
  const jsonLdPayloads = scriptJsonLdPayloads(input.html);
  const productMeta = parseProductMeta(getProductRecords(jsonLdPayloads));
  const imageCandidates = collectImages(input);
  const descriptionCandidates = collectTexts(input);
  const claims = descriptionCandidates
    .filter((candidate) => candidate.fieldType === "claim")
    .map((candidate) => candidate.text);

  const candidateWithoutScore: Omit<ProductCandidate, "confidenceScore"> = {
    sourceId: input.sourceId,
    snapshotId: input.snapshotId,
    sourceProductId:
      input.sourceProductId ?? productMeta.sourceProductId ?? undefined,
    sourceUrl: input.sourceUrl,
    brandName: productMeta.brandName,
    productName: productMeta.productName ?? "Unknown product",
    imageUrls: imageCandidates.map((candidate) => candidate.url),
    imageCandidates,
    description:
      descriptionCandidates.find((candidate) => candidate.fieldType === "description")
        ?.text ?? descriptionCandidates[0]?.text,
    descriptionCandidates,
    claims,
    claimRiskFlags: Array.from(
      new Set(descriptionCandidates.flatMap((candidate) => candidate.riskFlags ?? [])),
    ),
    parserVersion: PARSER_VERSION,
    confidenceHints: [],
  };
  candidateWithoutScore.confidenceHints = createConfidenceHints(candidateWithoutScore);

  const candidate: ProductCandidate = {
    ...candidateWithoutScore,
    confidenceScore: scoreCandidate(candidateWithoutScore),
  };

  return {
    candidate,
    reviewPayloads: buildReviewPayloads(candidate),
  };
}
