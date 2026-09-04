import { STATUS_META } from "../../hooks/useAdminReviewQueue";

export function QueueItem({ item, isSelected, onSelect }) {
  const statusMeta = STATUS_META[item.status] || STATUS_META.pending;

  return (
    <button
      className={`queue-item ${isSelected ? "selected" : ""}`}
      type="button"
      onClick={() => onSelect(item.id)}
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
        <span className="queue-item-chip">{item.candidateType}</span>
        <span className="queue-item-confidence">
          {Math.round(item.confidence * 100)}%
        </span>
      </div>
    </button>
  );
}
