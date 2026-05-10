import { useMemo, useState } from "react";
import "./AdminReview.css";

const INITIAL_QUEUE = [
  {
    id: "REQ-2401",
    submittedAt: "2026-05-09 14:18",
    productName: "Glow Repair Barrier Cream",
    brand: "Munyeon Lab",
    reporter: "catalog-bot",
    reason: "Packaging image mismatch against PDP scrape",
    status: "pending",
    notes: "Detected image hash differs from previous approved asset.",
  },
  {
    id: "REQ-2402",
    submittedAt: "2026-05-09 15:04",
    productName: "Calm Cica Toner Pads",
    brand: "Seorin",
    reporter: "ops-jin",
    reason: "Ingredient INCI list has two unresolved aliases",
    status: "needs-info",
    notes: "Awaiting supplier document update.",
  },
  {
    id: "REQ-2403",
    submittedAt: "2026-05-10 09:43",
    productName: "Vitamin B3 Deep Serum",
    brand: "Hanul Skin",
    reporter: "catalog-bot",
    reason: "Price jump over 35% compared to prior crawl",
    status: "pending",
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
        <h1>Admin Review Queue</h1>
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
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="queue-item-top">
                    <strong>{item.id}</strong>
                    <span className={`status-badge ${statusMeta.tone}`}>{statusMeta.label}</span>
                  </div>
                  <div className="queue-item-name">{item.productName}</div>
                  <div className="queue-item-meta">{item.brand} · {item.submittedAt}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="detail-panel">
          {selectedItem ? (
            <>
              <div className="detail-head">
                <h2>{selectedItem.productName}</h2>
                <span className={`status-badge ${STATUS_META[selectedItem.status].tone}`}>
                  {STATUS_META[selectedItem.status].label}
                </span>
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
              </dl>
              <div className="detail-block">
                <h3>Review reason</h3>
                <p>{selectedItem.reason}</p>
              </div>
              <div className="detail-block">
                <h3>Current note</h3>
                <p>{selectedItem.notes}</p>
              </div>
              <div className="detail-actions">
                <button className="action-btn approve" onClick={() => updateStatus("approved")}>
                  Approve
                </button>
                <button className="action-btn reject" onClick={() => updateStatus("rejected")}>
                  Reject
                </button>
                <button className="action-btn needs-info" onClick={() => updateStatus("needs-info")}>
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
