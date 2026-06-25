

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

