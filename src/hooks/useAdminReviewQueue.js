import { useMemo, useState } from "react";

const makePreviewArt = (title, subtitle, accent, bg) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#g)" />
      <rect x="28" y="28" width="584" height="304" rx="20" fill="#ffffff" fill-opacity="0.86" stroke="${accent}" stroke-width="3" />
      <rect x="56" y="58" width="84" height="32" rx="9" fill="${accent}" fill-opacity="0.16" />
      <text x="78" y="80" fill="${accent}" font-family="Arial, sans-serif" font-size="16" font-weight="700">Preview</text>
      <text x="56" y="148" fill="#1f2937" font-family="Arial, sans-serif" font-size="34" font-weight="700">${title}</text>
      <text x="56" y="190" fill="#4b5563" font-family="Arial, sans-serif" font-size="18">${subtitle}</text>
      <rect x="56" y="230" width="220" height="18" rx="9" fill="${accent}" fill-opacity="0.25" />
      <rect x="56" y="260" width="360" height="12" rx="6" fill="#cbd5e1" />
      <rect x="56" y="282" width="280" height="12" rx="6" fill="#dbe3ee" />
    </svg>
  `)}`;

export const INITIAL_QUEUE = [
  {
    id: "REQ-2401",
    submittedAt: "2026-05-09 14:18",
    candidateType: "image",
    productName: "Glow Repair Barrier Cream",
    brand: "Munyeon Lab",
    reporter: "catalog-bot",
    sourceUrl: "https://example.com/products/glow-repair-barrier-cream",
    evidencePath: "crawler/evidence/REQ-2401/package-shot-01.jpg",
    rawDescription:
      "Front-label image shows a ceramide barrier cream with a soft mint band; OCR picked up 50 ml, but the supplier spec line reads 55 mL.",
    normalizedDescription:
      "Barrier cream, 55 mL, front-label packaging image with ceramide focus.",
    riskFlags: ["OCR mismatch", "volume discrepancy", "pack shot crop"],
    confidence: 0.86,
    media: {
      src: makePreviewArt(
        "Glow Repair Barrier Cream",
        "Image candidate preview",
        "#0f766e",
        "#dff6f2",
      ),
      alt: "Stylized packaging preview for Glow Repair Barrier Cream",
    },
    status: "pending",
    reason: "Packaging image mismatch against PDP scrape",
    notes: "Detected image hash differs from previous approved asset.",
  },
  {
    id: "REQ-2402",
    submittedAt: "2026-05-09 15:04",
    candidateType: "text",
    productName: "Calm Cica Toner Pads",
    brand: "Seorin",
    reporter: "ops-jin",
    sourceUrl: "https://example.com/supplier-docs/calm-cica-toner-pads",
    evidencePath: "crawler/evidence/REQ-2402/supplier-inci.pdf#page=3",
    rawDescription:
      "Ingredient sheet mentions madecassoside, beta-glucan, panthenol, and 2% PHA pads. The alias 'cica leaf extract' appears in two lines.",
    normalizedDescription:
      "Toner pads with cica derivatives, beta-glucan, panthenol, and 2% PHA.",
    riskFlags: ["alias collision", "ingredient normalization"],
    confidence: 0.74,
    media: {
      textPreview:
        "Madecassoside, beta-glucan, panthenol, and 2% PHA pads. Alias: cica leaf extract.",
    },
    status: "needs-info",
    reason: "Ingredient INCI list has two unresolved aliases",
    notes: "Awaiting supplier document update.",
  },
  {
    id: "REQ-2403",
    submittedAt: "2026-05-10 09:43",
    candidateType: "image",
    productName: "Vitamin B3 Deep Serum",
    brand: "Hanul Skin",
    reporter: "catalog-bot",
    sourceUrl: "https://example.com/products/vitamin-b3-deep-serum",
    evidencePath: "crawler/evidence/REQ-2403/listing-capture.png",
    rawDescription:
      "Catalog page shows a deep serum with niacinamide and panthenol. Badge text shifted from '30% off' to 'launch price'.",
    normalizedDescription:
      "Vitamin B3 deep serum with niacinamide and panthenol. Confirm promo wording before publish.",
    riskFlags: ["price spike", "promo text drift"],
    confidence: 0.63,
    media: {
      src: makePreviewArt(
        "Vitamin B3 Deep Serum",
        "Listing capture",
        "#1d4ed8",
        "#e6f0ff",
      ),
      alt: "Stylized listing capture for Vitamin B3 Deep Serum",
    },
    status: "pending",
    reason: "Price jump over 35% compared to prior crawl",
    notes: "Needs manual price verification.",
  },
];

export const STATUS_META = {
  pending: { label: "Pending", tone: "pending" },
  approved: { label: "Approved", tone: "approved" },
  rejected: { label: "Rejected", tone: "rejected" },
  "needs-info": { label: "Needs Info", tone: "needs-info" },
};

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.pending;
}

export function getShellNoteForStatus(status) {
  switch (status) {
    case "approved":
      return "Approved in shell state. Backend wiring pending.";
    case "rejected":
      return "Rejected in shell state. Backend wiring pending.";
    case "needs-info":
    default:
      return "Marked needs-info in shell state. Backend wiring pending.";
  }
}

export function updateItemStatusInQueue(queue, targetId, newStatus) {
  return queue.map((item) =>
    item.id === targetId
      ? {
          ...item,
          status: newStatus,
          notes: getShellNoteForStatus(newStatus),
        }
      : item,
  );
}

export function useAdminReviewQueue(initialQueue = INITIAL_QUEUE) {
  const [queue, setQueue] = useState(initialQueue);
  const [selectedId, setSelectedId] = useState(initialQueue[0]?.id || null);

  const selectedItem = useMemo(
    () => queue.find((item) => item.id === selectedId) || queue[0] || null,
    [queue, selectedId],
  );

  const selectedStatusMeta = useMemo(
    () => (selectedItem ? getStatusMeta(selectedItem.status) : null),
    [selectedItem],
  );

  const updateStatus = (status) => {
    if (!selectedItem) return;
    setQueue((prevQueue) =>
      updateItemStatusInQueue(prevQueue, selectedItem.id, status),
    );
  };

  return {
    queue,
    selectedId,
    setSelectedId,
    selectedItem,
    selectedStatusMeta,
    updateStatus,
  };
}

export default useAdminReviewQueue;
