import { useAdminReviewQueue, STATUS_META } from "../hooks/useAdminReviewQueue";
import "./AdminReview.css";

export default function AdminReview() {
  const {
    queue,
    setSelectedId,
    selectedItem,
    selectedStatusMeta,
    updateStatus,
  } = useAdminReviewQueue();

  return (
    <div className="admin-review-page">
      <header className="admin-review-header">
        <div>
          <h1>Admin Review Queue</h1>
          <p className="admin-review-subtitle">
            Inspect image and text candidates, then decide in shell state.
          </p>
        </div>
        <div className="admin-review-shell-tag">
          Shell mode: no auth/backend
        </div>
      </header>

      <section className="admin-review-layout">
        <div className="queue-panel">
          <div className="queue-panel-head">
            <h2>Queue</h2>
            <span>{queue.length} items</span>
          </div>
          <div className="queue-list">
            {queue.map((item) => {
              const statusMeta =
                STATUS_META[item.status] || STATUS_META.pending;
              return (
                <button
                  key={item.id}
                  className={`queue-item ${selectedItem?.id === item.id ? "selected" : ""}`}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="queue-item-top">
                    <strong>{item.id}</strong>
                    <span className={`status-badge ${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="queue-item-name">{item.productName}</div>
                  <div className="queue-item-meta">
                    {item.brand} · {item.submittedAt}
                  </div>
                  <div className="queue-item-foot">
                    <span className="queue-item-chip">
                      {item.candidateType}
                    </span>
                    <span className="queue-item-confidence">
                      {Math.round(item.confidence * 100)}%
                    </span>
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
                <span className={`status-badge ${selectedStatusMeta.tone}`}>
                  {selectedStatusMeta.label}
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
                <div>
                  <dt>Confidence</dt>
                  <dd>{Math.round(selectedItem.confidence * 100)}%</dd>
                </div>
              </dl>
              <div className="detail-media-grid">
                <section className="detail-block detail-media">
                  <h3>Candidate preview</h3>
                  {"src" in selectedItem.media ? (
                    <img
                      className="media-preview-image"
                      src={selectedItem.media.src}
                      alt={selectedItem.media.alt}
                    />
                  ) : (
                    <div className="media-preview-text">
                      {selectedItem.media.textPreview}
                    </div>
                  )}
                </section>
                <section className="detail-block">
                  <h3>Source and evidence</h3>
                  <dl className="detail-kv">
                    <dt>Source URL</dt>
                    <dd>
                      {selectedItem.sourceUrl.startsWith("http://") ||
                      selectedItem.sourceUrl.startsWith("https://") ? (
                        <a
                          href={selectedItem.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
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
              <div
                className="confidence-meter"
                aria-label={`Confidence ${Math.round(selectedItem.confidence * 100)} percent`}
              >
                <div
                  className="confidence-meter-bar"
                  style={{ width: `${selectedItem.confidence * 100}%` }}
                />
              </div>
              <div className="detail-actions">
                <button
                  className="action-btn approve"
                  type="button"
                  onClick={() => updateStatus("approved")}
                >
                  Approve
                </button>
                <button
                  className="action-btn reject"
                  type="button"
                  onClick={() => updateStatus("rejected")}
                >
                  Reject
                </button>
                <button
                  className="action-btn needs-info"
                  type="button"
                  onClick={() => updateStatus("needs-info")}
                >
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
