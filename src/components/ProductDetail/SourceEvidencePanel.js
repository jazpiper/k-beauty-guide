import { formatDate } from "../../utils/productUtils";

export function SourceEvidencePanel({ sourceLinks, hasAnySourceEvidence }) {
  return (
    <section className="pd-panel">
      <div className="pd-section-heading">
        <h2>Source Evidence</h2>
        <span>{sourceLinks.length}</span>
      </div>

      {sourceLinks.length > 0 ? (
        <div className="pd-source-list">
          {sourceLinks.map((link) => (
            <article
              key={`${link.url}-${link.label}`}
              className="pd-source-item"
            >
              {link.url ? (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pd-source-link"
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <div className="pd-source-link pd-source-link-static">
                  <span>{link.label}</span>
                </div>
              )}
              {(link.evidence || link.publishedAt) && (
                <div className="pd-source-meta">
                  {link.evidence && <p>{link.evidence}</p>}
                  {link.publishedAt && (
                    <span>{formatDate(link.publishedAt)}</span>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="pd-empty-inline">
          No source evidence is available yet.
        </div>
      )}

      {sourceLinks.length > 0 && !hasAnySourceEvidence && (
        <div className="pd-evidence-note">
          Links are available, but evidence snippets are not yet attached.
        </div>
      )}
    </section>
  );
}
