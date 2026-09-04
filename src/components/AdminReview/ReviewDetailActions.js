export function ReviewDetailActions({ onUpdateStatus }) {
  return (
    <div className="detail-actions">
      <button
        className="action-btn approve"
        type="button"
        onClick={() => onUpdateStatus("approved")}
      >
        Approve
      </button>
      <button
        className="action-btn reject"
        type="button"
        onClick={() => onUpdateStatus("rejected")}
      >
        Reject
      </button>
      <button
        className="action-btn needs-info"
        type="button"
        onClick={() => onUpdateStatus("needs-info")}
      >
        Needs Info
      </button>
    </div>
  );
}
