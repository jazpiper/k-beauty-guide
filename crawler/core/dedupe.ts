import type { ProductCandidate } from "./types";

export type DuplicateSignal = {
  reasonCode:
    | "same_source_product_id"
    | "same_source_url"
    | "same_brand_normalized_name"
    | "same_image_url";
  confidence: number;
};

const trackingParamPrefixes = ["utm_"];
const trackingParamNames = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
]);

function normalizeComparableUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();

    for (const paramName of Array.from(url.searchParams.keys())) {
      const normalizedParamName = paramName.toLowerCase();
      const isTrackingParam =
        trackingParamNames.has(normalizedParamName) ||
        trackingParamPrefixes.some((prefix) =>
          normalizedParamName.startsWith(prefix),
        );

      if (isTrackingParam) {
        url.searchParams.delete(paramName);
      }
    }

    const serialized = url.toString();
    return serialized.endsWith("/") ? serialized.slice(0, -1) : serialized;
  } catch {
    return trimmed.replace(/#.*$/, "").replace(/\/$/, "");
  }
}

export function normalizeName(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim();
}

export function normalizeSourceUrl(value: string | undefined): string {
  return normalizeComparableUrl(value);
}

export function normalizeImageUrl(value: string | undefined): string {
  return normalizeComparableUrl(value);
}

export function dedupeCandidateImageUrls(imageUrls: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const imageUrl of imageUrls) {
    const trimmed = imageUrl?.trim();
    if (!trimmed) continue;

    const normalized = normalizeImageUrl(trimmed);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    deduped.push(trimmed);
  }

  return deduped;
}

function hasSameSourceProductId(
  a: ProductCandidate,
  b: ProductCandidate,
): boolean {
  const aProductId = a.sourceProductId?.trim();
  const bProductId = b.sourceProductId?.trim();

  return Boolean(
    a.sourceId === b.sourceId && aProductId && aProductId === bProductId,
  );
}

function hasSameBrandAndProductName(
  a: ProductCandidate,
  b: ProductCandidate,
): boolean {
  const aBrand = normalizeName(a.brandName);
  const bBrand = normalizeName(b.brandName);
  const aProductName = normalizeName(a.productName);
  const bProductName = normalizeName(b.productName);

  return Boolean(
    aBrand &&
      aBrand === bBrand &&
      aProductName &&
      aProductName === bProductName,
  );
}

function hasSameImageUrl(a: ProductCandidate, b: ProductCandidate): boolean {
  const bNormalizedImageUrls = new Set(
    dedupeCandidateImageUrls(b.imageUrls)
      .map((imageUrl) => normalizeImageUrl(imageUrl))
      .filter(Boolean),
  );

  return dedupeCandidateImageUrls(a.imageUrls).some((imageUrl) =>
    bNormalizedImageUrls.has(normalizeImageUrl(imageUrl)),
  );
}

export function compareCandidates(
  a: ProductCandidate,
  b: ProductCandidate,
): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];
  const aSourceUrl = normalizeSourceUrl(a.sourceUrl);
  const bSourceUrl = normalizeSourceUrl(b.sourceUrl);

  if (hasSameSourceProductId(a, b)) {
    signals.push({ reasonCode: "same_source_product_id", confidence: 0.98 });
  }

  if (aSourceUrl && aSourceUrl === bSourceUrl) {
    signals.push({ reasonCode: "same_source_url", confidence: 0.95 });
  }

  if (hasSameImageUrl(a, b)) {
    signals.push({ reasonCode: "same_image_url", confidence: 0.88 });
  }

  if (hasSameBrandAndProductName(a, b)) {
    signals.push({
      reasonCode: "same_brand_normalized_name",
      confidence: 0.9,
    });
  }

  return signals;
}
