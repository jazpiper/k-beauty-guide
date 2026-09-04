import { useAdminReviewQueue } from "../hooks/useAdminReviewQueue";
import { QueuePanel } from "../components/AdminReview/QueuePanel";
import { ReviewDetailPanel } from "../components/AdminReview/ReviewDetailPanel";
import "./AdminReview.css";

export default function AdminReview() {
  const {
    queue,
    selectedId,
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
        <QueuePanel
          queue={queue}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ReviewDetailPanel
          selectedItem={selectedItem}
          selectedStatusMeta={selectedStatusMeta}
          onUpdateStatus={updateStatus}
        />
      </section>
    </div>
  );
}
