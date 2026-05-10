import type { ProductImageCandidate } from "./types";
import { dedupeImageCandidates, isSafeHttpImageUrl } from "./mediaValidation";

type UnknownRecord = Record<string, unknown>;
type HtmlElementMatch = { attrs: string; inner: string };

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function toStringList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    const strings: string[] = [];
    for (const entry of value) {
      if (typeof entry === "string") strings.push(entry);
      else {
        const record = asRecord(entry);
        const maybeUrl = record?.url;
        if (typeof maybeUrl === "string") strings.push(maybeUrl);
      }
    }
    return strings;
  }
  const record = asRecord(value);
  const maybeUrl = record?.url;
  return typeof maybeUrl === "string" ? [maybeUrl] : [];
}

function collectJsonLdImages(value: unknown, output: string[]): void {
  if (typeof value === "string") return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdImages(item, output);
    return;
  }
  const record = asRecord(value);
  if (!record) return;

  if ("image" in record) {
    output.push(...toStringList(record.image));
  }

  if ("@graph" in record && Array.isArray(record["@graph"])) {
    collectJsonLdImages(record["@graph"], output);
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") collectJsonLdImages(nested, output);
  }
}

function createImageCandidates(
  urls: string[],
  source: ProductImageCandidate["source"],
  selector?: string,
): ProductImageCandidate[] {
  const candidates: ProductImageCandidate[] = [];

  for (const url of urls) {
    if (!isSafeHttpImageUrl(url)) continue;
    candidates.push({ url: url.trim(), source, selector });
  }

  return dedupeImageCandidates(candidates);
}

function getAttrValue(attrs: string, attrName: string): string | null {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = attrs.match(pattern);
  return match?.[1] ?? null;
}

function collectImageSrcFromHtml(html: string): string[] {
  const urls: string[] = [];
  const imgRegex = /<img\b([^>]*)>/gi;
  for (const match of html.matchAll(imgRegex)) {
    const attrs = match[1] ?? "";
    const src = getAttrValue(attrs, "src");
    if (src) urls.push(src);
  }
  return urls;
}

function extractElementsByTag(html: string, tag: string): HtmlElementMatch[] {
  const matches: HtmlElementMatch[] = [];
  const pairRegex = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of html.matchAll(pairRegex)) {
    matches.push({ attrs: match[1] ?? "", inner: match[2] ?? "" });
  }
  return matches;
}

function extractContainerById(html: string, id: string): string[] {
  const containers: string[] = [];
  for (const tag of ["div", "section", "article", "main", "ul"]) {
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

function extractSectionByAriaLabel(html: string, ariaLabel: string): string[] {
  const sections: string[] = [];
  const sectionRegex = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  for (const match of html.matchAll(sectionRegex)) {
    const attrs = match[1] ?? "";
    const label = getAttrValue(attrs, "aria-label");
    if (label === ariaLabel) sections.push(match[2] ?? "");
  }
  return sections;
}

function extractImageUrlsBySimpleSelector(html: string, selector: string): string[] {
  const normalized = selector.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return [];
  if (lower.includes("og:image")) {
    return extractImageCandidatesFromOpenGraph(html).map((candidate) => candidate.url);
  }

  if (lower === "img") {
    return collectImageSrcFromHtml(html);
  }

  const idTagMatch = normalized.match(/^#([a-z0-9_-]+)\s+([a-z0-9_-]+)$/i);
  if (idTagMatch) {
    const id = idTagMatch[1];
    const childTag = idTagMatch[2];
    const urls: string[] = [];
    for (const container of extractContainerById(html, id)) {
      if (childTag.toLowerCase() === "img") {
        urls.push(...collectImageSrcFromHtml(container));
      } else {
        for (const element of extractElementsByTag(container, childTag)) {
          if (childTag.toLowerCase() === "img") {
            const src = getAttrValue(element.attrs, "src");
            if (src) urls.push(src);
          }
        }
      }
    }
    return urls;
  }

  const sectionAriaImgMatch = normalized.match(
    /^section\[aria-label=["']([^"']+)["']\]\s+img(?:\[(\d+)\])?$/i,
  );
  if (sectionAriaImgMatch) {
    const ariaLabel = sectionAriaImgMatch[1];
    const indexValue =
      sectionAriaImgMatch[2] === undefined
        ? null
        : Number.parseInt(sectionAriaImgMatch[2], 10);
    const urls: string[] = [];
    for (const section of extractSectionByAriaLabel(html, ariaLabel)) {
      urls.push(...collectImageSrcFromHtml(section));
    }
    if (indexValue === null || Number.isNaN(indexValue)) return urls;
    if (indexValue < 0 || indexValue >= urls.length) return [];
    return [urls[indexValue]];
  }

  return [];
}

export function extractImageCandidatesFromJsonLd(
  payload: unknown,
): ProductImageCandidate[] {
  const urls: string[] = [];
  collectJsonLdImages(payload, urls);
  return createImageCandidates(urls, "json_ld");
}

export function extractImageCandidatesFromOpenGraph(
  html: string,
): ProductImageCandidate[] {
  const urls: string[] = [];
  const metaRegex =
    /<meta\b[^>]*(?:property|name)\s*=\s*["']og:image(?::url)?["'][^>]*>/gi;
  const contentRegex = /\bcontent\s*=\s*["']([^"']+)["']/i;

  for (const match of html.matchAll(metaRegex)) {
    const tag = match[0] ?? "";
    const content = tag.match(contentRegex)?.[1];
    if (content) urls.push(content);
  }

  return createImageCandidates(urls, "open_graph");
}

export function extractImageCandidatesFromShopifyProductJson(
  payload: unknown,
): ProductImageCandidate[] {
  const rootRecord = asRecord(payload);
  const product = asRecord(rootRecord?.product) ?? rootRecord;
  if (!product) return [];

  const urls: string[] = [];
  urls.push(...toStringList(product.image));
  urls.push(...toStringList(product.featured_image));
  urls.push(...toStringList(product.images));

  return createImageCandidates(urls, "shopify_product_json");
}

export function extractImageCandidatesFromDomSelectors(
  html: string,
  selectors: string[] = ['meta[property="og:image"]', "img"],
): ProductImageCandidate[] {
  const candidates: ProductImageCandidate[] = [];

  for (const selector of selectors) {
    const urls = extractImageUrlsBySimpleSelector(html, selector);
    for (const url of urls) {
      if (!isSafeHttpImageUrl(url)) continue;
      candidates.push({ url: url.trim(), source: "dom_selector", selector });
    }
  }

  return dedupeImageCandidates(candidates);
}
