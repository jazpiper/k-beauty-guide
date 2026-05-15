import { useMemo, useState } from "react";
import "./AdminReview.css";

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

const INITIAL_QUEUE = [
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
      src: makePreviewArt("Glow Repair Barrier Cream", "Image candidate preview", "#0f766e", "#dff6f2"),
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
      src: makePreviewArt("Vitamin B3 Deep Serum", "Listing capture", "#1d4ed8", "#e6f0ff"),
      alt: "Stylized listing capture for Vitamin B3 Deep Serum",
    },
    status: "pending",
    reason: "Price jump over 35% compared to prior crawl",
    notes: "Needs manual price verification.",
  },
];

const STATUS_META = {
  pending: { label: "Pending", tone: "pending" },
  approved: { label: "Approved", tone: "approved" },
  rejected: { label: "Rejected", tone: "rejected" },
  "needs-info": { label: "Needs Info", tone: "needs-info" },
};

export default function AdminReview() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [selectedId, setSelectedId] = useState(INITIAL_QUEUE[0]?.id || null);

  const selectedItem = useMemo(
    () => queue.find((item) => item.id === selectedId) || queue[0] || null,
    [queue, selectedId]
  );
  const selectedStatusMeta = selectedItem ? STATUS_META[selectedItem.status] || STATUS_META.pending : null;

  const updateStatus = (status) => {
    if (!selectedItem) return;
    setQueue((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              status,
              notes:
                status === "approved"
                  ? "Approved in shell state. Backend wiring pending."
                  : status === "rejected"
                    ? "Rejected in shell state. Backend wiring pending."
                    : "Marked needs-info in shell state. Backend wiring pending.",
            }
          : item
      )
    );
  };

  return (
    <div className="admin-review-page">
      <header className="admin-review-header">
        <div>
          <h1>Admin Review Queue</h1>
          <p className="admin-review-subtitle">Inspect image and text candidates, then decide in shell state.</p>
        </div>
        <div className="admin-review-shell-tag">Shell mode: no auth/backend</div>
      </header>

      <section className="admin-review-layout">
        <div className="queue-panel">
          <div className="queue-panel-head">
            <h2>Queue</h2>
            <span>{queue.length} items</span>
          </div>
          <div className="queue-list">
            {queue.map((item) => {
              const statusMeta = STATUS_META[item.status] || STATUS_META.pending;
              return (
                <button
                  key={item.id}
                  className={`queue-item ${selectedItem?.id === item.id ? "selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="queue-item-top">
                    <strong>{item.id}</strong>
                    <span className={`status-badge ${statusMeta.tone}`}>{statusMeta.label}</span>
                  </div>
                  <div className="queue-item-name">{item.productName}</div>
                  <div className="queue-item-meta">
                    {item.brand} · {item.submittedAt}
                  </div>
                  <div className="queue-item-foot">
                    <span className="queue-item-chip">{item.candidateType}</span>
                    <span className="queue-item-confidence">{Math.round(item.confidence * 100)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-head">
                <div className="detail-title-wrap">
                  <h2>{selectedItem.productName}</h2>
                  <div className="detail-subline">
                    <span>{selectedItem.brand}</span>
                    <span>{selectedItem.candidateType} candidate</span>
                  </div>
                </div>
                <span className={`status-badge ${selectedStatusMeta.tone}`}>{selectedStatusMeta.label}</span>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Request ID</dt>
                  <dd>{selectedItem.id}</dd>
                </div>
                <div>
                  <dt>Brand</dt>
                  <dd>{selectedItem.brand}</dd>
                </div>
                <div>
                  <dt>Reporter</dt>
                  <dd>{selectedItem.reporter}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>{selectedItem.submittedAt}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{Math.round(selectedItem.confidence * 100)}%</dd>
                </div>
              </dl>
              <div className="detail-media-grid">
                <section className="detail-block detail-media">
                  <h3>Candidate preview</h3>
                  {"src" in selectedItem.media ? (
                    <img className="media-preview-image" src={selectedItem.media.src} alt={selectedItem.media.alt} />
                  ) : (
                    <div className="media-preview-text">{selectedItem.media.textPreview}</div>
                  )}
                </section>
                <section className="detail-block">
                  <h3>Source and evidence</h3>
                  <dl className="detail-kv">
                    <dt>Source URL</dt>
                    <dd>
                      {selectedItem.sourceUrl.startsWith("http://") || selectedItem.sourceUrl.startsWith("https://") ? (
                        <a href={selectedItem.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {selectedItem.sourceUrl}
                        </a>
                      ) : (
                        <span>{selectedItem.sourceUrl}</span>
                      )}
                    </dd>
                    <dt>Evidence path</dt>
                    <dd className="mono">{selectedItem.evidencePath}</dd>
                  </dl>
                </section>
              </div>
              <div className="detail-block">
                <h3>Raw description</h3>
                <p>{selectedItem.rawDescription}</p>
              </div>
              <div className="detail-block">
                <h3>Normalized proposal</h3>
                <p>{selectedItem.normalizedDescription}</p>
              </div>
              <div className="detail-grid detail-grid-tight">
                <div className="detail-block">
                  <h3>Risk flags</h3>
                  <div className="flag-list">
                    {selectedItem.riskFlags.map((flag) => (
                      <span key={flag} className="flag-pill">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="detail-block">
                  <h3>Current note</h3>
                  <p>{selectedItem.notes}</p>
                </div>
              </div>
              <div className="confidence-meter" aria-label={`Confidence ${Math.round(selectedItem.confidence * 100)} percent`}>
                <div className="confidence-meter-bar" style={{ width: `${selectedItem.confidence * 100}%` }} />
              </div>
              <div className="detail-actions">
                <button className="action-btn approve" type="button" onClick={() => updateStatus("approved")}>
                  Approve
                </button>
                <button className="action-btn reject" type="button" onClick={() => updateStatus("rejected")}>
                  Reject
                </button>
                <button className="action-btn needs-info" type="button" onClick={() => updateStatus("needs-info")}>
                  Needs Info
                </button>
              </div>
            </>
          ) : (
            <div className="detail-empty">No queue items.</div>
          )}
        </div>
      </section>
    </div>
  );
}
