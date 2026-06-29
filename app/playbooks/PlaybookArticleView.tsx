"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import ReadOnlyAttachmentsPanel from "@/components/platform/ReadOnlyAttachmentsPanel";
import PlaybookMarkdownRenderer from "@/components/playbooks/PlaybookMarkdownRenderer";

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

type ArticleHeading = {
  id: string;
  text: string;
  level: number;
};

const PLAYBOOK_ATTACHMENT_ENTITY_TYPE = "playbook_article";

function fmtDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function articleTypeLabel(value: string) {
  const normalized = String(value || "").trim();

  if (normalized === "application_guide") return "Application Guide";
  if (normalized === "job_function") return "Job Function";
  if (normalized === "troubleshooting") return "Troubleshooting";
  if (normalized === "reference") return "Reference";

  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugifyHeading(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractHeadings(markdown: string): ArticleHeading[] {
  const seen = new Map<string, number>();

  return String(markdown || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^(#{2,3})\s+(.+)$/);
      if (!match) return null;

      const level = match[1].length;
      const text = match[2].trim();
      const baseId = slugifyHeading(text) || "section";
      const count = seen.get(baseId) || 0;
      seen.set(baseId, count + 1);

      return {
        id: count > 0 ? `${baseId}-${count + 1}` : baseId,
        text,
        level,
      };
    })
    .filter((row): row is ArticleHeading => !!row);
}

export default function PlaybookArticleView({
  article,
  relatedArticles,
}: {
  article: Article;
  relatedArticles: RelatedArticle[];
}) {
  const router = useRouter();
  const headings = useMemo(
    () => extractHeadings(article.contentMarkdown),
    [article.contentMarkdown]
  );

  return (
    <div className="record-shell playbook-article-shell">
      <style>{`
        .playbook-article-shell {
          width: 100%;
          max-width: 1800px;
          margin-inline: auto;
        }

        .playbook-article-shell .record-layout {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .playbook-article-shell .record-content,
        .playbook-article-shell .record-header-main {
          min-width: 0;
        }

        .playbook-article-content-card {
          padding: 22px 30px;
        }

        .playbook-article-sidebar-note {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-soft);
          line-height: 1.45;
        }

        .playbook-article-toc-link {
          padding-left: 0;
        }

        .playbook-article-toc-link-level-3 {
          padding-left: 14px;
        }

        @media (max-width: 1000px) {
          .playbook-article-shell .record-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .playbook-article-content-card {
            padding: 18px;
          }
        }
      `}</style>

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
            <p className="record-subtitle" style={{ maxWidth: 1100 }}>
              {article.summary}
            </p>
          ) : null}

          <div className="record-badge-row">
            <span className="record-pill record-pill-neutral">
              {article.departmentName}
            </span>

            <span className="record-pill record-pill-neutral">
              {article.categoryName}
            </span>

            <span className="record-pill record-pill-info">
              {articleTypeLabel(article.articleType)}
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

            {headings.length > 0 ? (
              <div className="record-sidebar-section">
                <div className="record-sidebar-section-title">On This Page</div>

                <div className="record-sidebar-nav">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={`record-sidebar-link playbook-article-toc-link ${
                        heading.level === 3 ? "playbook-article-toc-link-level-3" : ""
                      }`}
                    >
                      {heading.text}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

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

              <div className="playbook-article-sidebar-note">
                Files are managed from the admin edit page.
              </div>
            </div>
          </div>
        </aside>

        <div className="record-content">
          <section className="record-section">
            <div className="record-section-card playbook-article-content-card">
              <div className="record-section-header">
                <h2 className="record-section-title">Content</h2>
              </div>

              <PlaybookMarkdownRenderer content={article.contentMarkdown} />
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
