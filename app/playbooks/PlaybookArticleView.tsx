"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ReadOnlyAttachmentsPanel from "@/components/platform/ReadOnlyAttachmentsPanel";

type Article = {
  id: string;
  departmentName: string;
  categoryName: string;
  title: string;
  slug: string;
  summary: string | null;
  articleType: string;
  contentMarkdown: string;
  updatedAt: string;
  publishedAt: string | null;
};

type RelatedArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  categoryName: string;
};

const PLAYBOOK_ATTACHMENT_ENTITY_TYPE = "playbook_article";

function fmtDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export default function PlaybookArticleView({
  article,
  relatedArticles,
}: {
  article: Article;
  relatedArticles: RelatedArticle[];
}) {
  const router = useRouter();

  return (
    <div className="record-shell">
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/playbooks");
            }
          }}
        >
          ← Back
        </button>
      </div>

      <div className="record-header">
        <div className="record-header-main">
          <div className="record-kicker">
            <Link href="/playbooks" className="btn-linkish">
              Playbooks
            </Link>
            {" / "}
            {article.departmentName}
            {" / "}
            {article.categoryName}
          </div>

          <h1 className="record-title">{article.title}</h1>

          {article.summary ? (
            <p className="record-subtitle" style={{ maxWidth: 900 }}>
              {article.summary}
            </p>
          ) : null}

          <div className="record-badge-row">
            <span className="record-pill record-pill-neutral">
              {article.categoryName}
            </span>

            <span className="record-pill record-pill-info">
              {article.articleType}
            </span>

            {article.publishedAt ? (
              <span className="record-pill record-pill-success">
                Published {fmtDate(article.publishedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="record-layout">
        <aside className="record-sidebar">
          <div className="record-sidebar-card">
            <div className="record-sidebar-section">
              <div className="record-sidebar-section-title">Article Info</div>
              <div className="text-soft">
                Last updated: {fmtDate(article.updatedAt)}
              </div>
            </div>

            <div className="record-sidebar-section">
              <div className="record-sidebar-section-title">
                Related Articles
              </div>

              {relatedArticles.length === 0 ? (
                <div className="text-soft">No related articles linked yet.</div>
              ) : (
                <div className="record-sidebar-nav">
                  {relatedArticles.map((row) => (
                    <Link
                      key={row.id}
                      href={`/playbooks/${encodeURIComponent(row.slug)}`}
                      className="record-sidebar-link"
                    >
                      {row.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="record-sidebar-section">
              <div className="record-sidebar-section-title">
                Supporting Files
              </div>

              <div className="record-sidebar-nav">
                <a href="#supporting-files" className="record-sidebar-link">
                  View supporting files
                </a>
              </div>

              <div className="text-soft">
                Files are managed from the admin edit page.
              </div>
            </div>
          </div>
        </aside>

        <div className="record-content">
          <section className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <h2 className="record-section-title">Content</h2>
              </div>

              <article
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  color: "var(--text)",
                  fontSize: 14,
                }}
              >
                {article.contentMarkdown}
              </article>
            </div>
          </section>

          <section id="supporting-files" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <div>
                  <h2 className="record-section-title">Supporting Files</h2>
                  <p className="page-subtitle" style={{ marginTop: 4 }}>
                    Open or download files attached to this playbook article.
                  </p>
                </div>
              </div>

              <ReadOnlyAttachmentsPanel
                entityType={PLAYBOOK_ATTACHMENT_ENTITY_TYPE}
                entityId={article.id}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}