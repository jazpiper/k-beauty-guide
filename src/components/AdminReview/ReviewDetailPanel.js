import { ReviewDetailActions } from "./ReviewDetailActions";

export function ReviewDetailPanel({
  selectedItem,
  selectedStatusMeta,
  onUpdateStatus,
}) {
  if (!selectedItem) {
    return (
      <div className="detail-panel">
        <div className="detail-empty">No queue items.</div>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <div className="detail-head">
        <div className="detail-title-wrap">
          <h2>{selectedItem.productName}</h2>
          <div className="detail-subline">
            <span>{selectedItem.brand}</span>
            <span>{selectedItem.candidateType} candidate</span>
          </div>
        </div>
        {selectedStatusMeta && (
          <span className={`status-badge ${selectedStatusMeta.tone}`}>
            {selectedStatusMeta.label}
          </span>
        )}
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

      <ReviewDetailActions onUpdateStatus={onUpdateStatus} />
    </div>
  );
}
