import type { ProductTextCandidate } from "./types";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_DESCRIPTION_MAX_LENGTH = 2000;

const CLAIM_RISK_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: "medical_treatment", pattern: /\b(treat|treatment|cures?|heals?)\b/i },
  { code: "disease_reference", pattern: /\b(acne|eczema|psoriasis|dermatitis)\b/i },
  { code: "regulatory_drug", pattern: /\b(drug|prescription|fda\s*approved)\b/i },
  { code: "spf_pa_claim", pattern: /\bspf\s*\d+|pa\+{1,4}\b/i },
  { code: "pregnancy_safe_claim", pattern: /\b(pregnancy[-\s]*safe|safe[-\s]*for[-\s]*pregnancy)\b/i },
  { code: "hypoallergenic_claim", pattern: /\bhypoallergenic\b/i },
  { code: "non_comedogenic_claim", pattern: /\bnon[-\s]*comedogenic\b/i },
  { code: "dermatologist_tested_claim", pattern: /\bdermatologist[-\s]*tested\b/i },
  { code: "korean_treatment", pattern: /(치료|완치|의약품|아토피)/i },
];

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function htmlDecodeMinimal(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function cleanupDescriptionText(
  value: unknown,
  maxLength = DEFAULT_DESCRIPTION_MAX_LENGTH,
): string {
  if (typeof value !== "string") return "";
  const withoutScripts = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  const noTags = withoutScripts.replace(/<[^>]+>/g, " ");
  const decoded = htmlDecodeMinimal(noTags);
  const normalized = decoded.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (maxLength <= 0) return "";
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trim()
    : normalized;
}

function getStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    const output: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string") output.push(entry);
    }
    return output;
  }
  return [];
}

function collectJsonLdDescriptions(value: unknown, output: string[]): void {
  if (typeof value === "string") return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdDescriptions(item, output);
    return;
  }
  const record = asRecord(value);
  if (!record) return;

  if ("description" in record) {
    output.push(...getStringValues(record.description));
  }

  if ("@graph" in record && Array.isArray(record["@graph"])) {
    collectJsonLdDescriptions(record["@graph"], output);
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") collectJsonLdDescriptions(nested, output);
  }
}

function toTextCandidates(
  texts: string[],
  source: ProductTextCandidate["source"],
  selector?: string,
): ProductTextCandidate[] {
  const output: ProductTextCandidate[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const cleaned = cleanupDescriptionText(text);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    output.push({ text: cleaned, source, selector });
  }
  return output;
}

function getAttrValue(attrs: string, attrName: string): string | null {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = attrs.match(pattern);
  return match?.[1] ?? null;
}

function extractTagInnerHtml(html: string, tag: string): string[] {
  const values: string[] = [];
  const tagRegex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of html.matchAll(tagRegex)) {
    values.push(match[1] ?? "");
  }
  return values;
}

function extractContainerById(html: string, id: string): string[] {
  const containers: string[] = [];
  for (const tag of ["div", "section", "article", "main", "ul", "ol"]) {
    const pattern = new RegExp(
      `<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,
      "gi",
    );
    for (const match of html.matchAll(pattern)) {
      const attrs = match[1] ?? "";
      const elementId = getAttrValue(attrs, "id");
      if (elementId === id) containers.push(match[2] ?? "");
    }
  }
  return containers;
}

function extractTextBySimpleSelector(html: string, selector: string): string[] {
  const normalized = selector.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return [];
  if (lower.includes("og:description")) {
    return extractDescriptionCandidatesFromOpenGraph(html).map((candidate) => candidate.text);
  }

  const idTagMatch = normalized.match(
    /^#([a-z0-9_-]+)\s+([a-z0-9_-]+)(?:\[(\d+)\])?$/i,
  );
  if (idTagMatch) {
    const id = idTagMatch[1];
    const childTag = idTagMatch[2];
    const indexValue =
      idTagMatch[3] === undefined ? null : Number.parseInt(idTagMatch[3], 10);
    const values: string[] = [];
    for (const container of extractContainerById(html, id)) {
      values.push(...extractTagInnerHtml(container, childTag));
    }
    if (indexValue === null || Number.isNaN(indexValue)) return values;
    if (indexValue < 0 || indexValue >= values.length) return [];
    return [values[indexValue]];
  }

  if (/^[a-z0-9_-]+$/i.test(normalized)) {
    return extractTagInnerHtml(html, normalized);
  }

  return [];
}

export function extractDescriptionCandidatesFromJsonLd(
  payload: unknown,
): ProductTextCandidate[] {
  const descriptions: string[] = [];
  collectJsonLdDescriptions(payload, descriptions);
  return toTextCandidates(descriptions, "json_ld");
}

export function extractDescriptionCandidatesFromOpenGraph(
  html: string,
): ProductTextCandidate[] {
  const values: string[] = [];
  const metaRegex =
    /<meta\b[^>]*(?:property|name)\s*=\s*["']og:description["'][^>]*>/gi;
  const contentRegex = /\bcontent\s*=\s*["']([^"']+)["']/i;

  for (const match of html.matchAll(metaRegex)) {
    const tag = match[0] ?? "";
    const content = tag.match(contentRegex)?.[1];
    if (content) values.push(content);
  }

  return toTextCandidates(values, "open_graph");
}

export function extractDescriptionCandidatesFromShopifyProductJson(
  payload: unknown,
): ProductTextCandidate[] {
  const rootRecord = asRecord(payload);
  const product = asRecord(rootRecord?.product) ?? rootRecord;
  if (!product) return [];

  const descriptions: string[] = [];
  descriptions.push(...getStringValues(product.description));
  descriptions.push(...getStringValues(product.body_html));

  return toTextCandidates(descriptions, "shopify_product_json");
}

export function extractDescriptionCandidatesFromDomSelectors(
  html: string,
  selectors: string[] = ['meta[property="og:description"]', "p"],
): ProductTextCandidate[] {
  const output: ProductTextCandidate[] = [];

  for (const selector of selectors) {
    const extracted = extractTextBySimpleSelector(html, selector);
    for (const rawText of extracted) {
      const text = cleanupDescriptionText(rawText);
      if (!text) continue;
      output.push({ text, source: "dom_selector", selector });
    }
  }

  const seen = new Set<string>();
  const deduped: ProductTextCandidate[] = [];
  for (const candidate of output) {
    if (seen.has(candidate.text)) continue;
    seen.add(candidate.text);
    deduped.push(candidate);
  }

  return deduped;
}

export function detectClaimRiskFlags(value: unknown): string[] {
  const text = cleanupDescriptionText(value, 10000);
  if (!text) return [];

  const flags: string[] = [];
  for (const entry of CLAIM_RISK_PATTERNS) {
    if (entry.pattern.test(text)) flags.push(entry.code);
  }
  return flags;
}
