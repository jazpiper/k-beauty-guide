import type { ProductImageCandidate } from "./types";

const trackingParamPrefixes = ["utm_"];
const trackingParamNames = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
]);

export function isSafeHttpImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";

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
      if (isTrackingParam) url.searchParams.delete(paramName);
    }

    const serialized = url.toString();
    return serialized.endsWith("/") ? serialized.slice(0, -1) : serialized;
  } catch {
    return "";
  }
}

export function dedupeImageCandidates(
  candidates: ProductImageCandidate[],
): ProductImageCandidate[] {
  const seen = new Set<string>();
  const output: ProductImageCandidate[] = [];

  for (const candidate of candidates) {
    const key = normalizeImageUrl(candidate.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }

  return output;
}
