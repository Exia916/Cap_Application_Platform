"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DepartmentRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

type CategoryRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  name: string;
  slug: string;
};

type ArticleRow = {
  id: string;
  departmentId: string;
  departmentName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  slug: string;
  summary: string | null;
  articleType: string;
  status: string;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

function fmtDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
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

function sortArticlesNewestFirst(a: ArticleRow, b: ArticleRow) {
  const av = new Date(a.publishedAt || a.updatedAt).getTime();
  const bv = new Date(b.publishedAt || b.updatedAt).getTime();
  return bv - av;
}

export default function PlaybooksLandingClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);

  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [articleType, setArticleType] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [deptRes, catRes, articleRes] = await Promise.all([
          fetch("/api/playbooks/departments", { cache: "no-store" }),
          fetch("/api/playbooks/categories", { cache: "no-store" }),
          fetch(
            "/api/playbooks?publicOnly=true&page=1&pageSize=200&sortBy=publishedAt&sortDir=desc",
            { cache: "no-store" }
          ),
        ]);

        const deptData = await deptRes.json().catch(() => ({}));
        const catData = await catRes.json().catch(() => ({}));
        const articleData = await articleRes.json().catch(() => ({}));

        if (!deptRes.ok) throw new Error(deptData?.error || "Failed to load departments.");
        if (!catRes.ok) throw new Error(catData?.error || "Failed to load categories.");
        if (!articleRes.ok) throw new Error(articleData?.error || "Failed to load articles.");

        setDepartments(Array.isArray(deptData?.rows) ? deptData.rows : []);
        setCategories(Array.isArray(catData?.rows) ? catData.rows : []);
        setArticles(Array.isArray(articleData?.rows) ? articleData.rows : []);
      } catch (err: any) {
        setError(err?.message || "Failed to load playbooks.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleCategories = useMemo(() => {
    return categories.filter((row) => !departmentId || row.departmentId === departmentId);
  }, [categories, departmentId]);

  useEffect(() => {
    if (!categoryId) return;

    const stillValid = visibleCategories.some((row) => row.id === categoryId);
    if (!stillValid) {
      setCategoryId("");
    }
  }, [categoryId, visibleCategories]);

  const articleTypes = useMemo(() => {
    return Array.from(new Set(articles.map((row) => row.articleType).filter(Boolean))).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return articles
      .filter((row) => {
        if (departmentId && row.departmentId !== departmentId) return false;
        if (categoryId && row.categoryId !== categoryId) return false;
        if (articleType && row.articleType !== articleType) return false;

        if (!needle) return true;

        const haystack = [
          row.title,
          row.summary,
          row.departmentName,
          row.categoryName,
          row.articleType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(needle);
      })
      .sort(sortArticlesNewestFirst);
  }, [articles, q, departmentId, categoryId, articleType]);

  const featured = filteredArticles.filter((x) => x.isFeatured).slice(0, 6);
  const hasFilters = !!q.trim() || !!departmentId || !!categoryId || !!articleType;

  function clearFilters() {
    setQ("");
    setDepartmentId("");
    setCategoryId("");
    setArticleType("");
  }

  function departmentCount(departmentIdToCount: string) {
    return articles.filter((row) => row.departmentId === departmentIdToCount).length;
  }

  return (
    <div className="page-shell-wide playbooks-shell">
      <style>{`
        .playbooks-shell {
          width: 100%;
          max-width: 1800px;
          margin-inline: auto;
          box-sizing: border-box;
        }

        .playbooks-search-card {
          margin-bottom: 16px;
        }

        .playbooks-search-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 240px 240px auto;
          gap: 12px;
          align-items: end;
        }

        .playbooks-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .playbooks-chip {
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          border-radius: 999px;
          padding: 7px 12px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .playbooks-chip:hover {
          border-color: var(--brand-blue);
        }

        .playbooks-chip-active {
          border-color: var(--brand-blue);
          background: var(--accent-soft);
          box-shadow: 0 0 0 1px var(--brand-blue) inset;
        }

        .playbooks-main {
          display: grid;
          gap: 16px;
        }

        .playbooks-featured-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .playbooks-article-list {
          display: grid;
          gap: 10px;
        }

        .playbooks-article-row {
          text-decoration: none;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: start;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface);
        }

        .playbooks-article-row:hover {
          border-color: var(--brand-blue);
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
        }

        .playbooks-article-title {
          font-weight: 900;
          margin-bottom: 5px;
          color: var(--text);
        }

        .playbooks-article-summary {
          color: var(--text-soft);
          margin-bottom: 10px;
          line-height: 1.45;
        }

        .playbooks-article-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          align-items: center;
        }

        .playbooks-article-date {
          color: var(--text-soft);
          font-size: 12px;
          white-space: nowrap;
          padding-top: 2px;
        }

        .playbooks-results-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .playbooks-active-filter-text {
          margin-top: 4px;
          color: var(--text-soft);
          font-size: 13px;
        }

        .playbooks-empty-state {
          border: 1px dashed var(--border);
          border-radius: 14px;
          padding: 24px;
          text-align: center;
          color: var(--text-soft);
          background: var(--surface);
        }

        @media (max-width: 1500px) {
          .playbooks-featured-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1200px) {
          .playbooks-search-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 900px) {
          .playbooks-search-grid {
            grid-template-columns: 1fr;
          }

          .playbooks-featured-grid {
            grid-template-columns: 1fr;
          }

          .playbooks-article-row {
            grid-template-columns: 1fr;
          }

          .playbooks-article-date {
            white-space: normal;
          }
        }
      `}</style>

      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Playbooks</h1>
          <p className="page-subtitle">
            Search internal guides, how-to documentation, troubleshooting steps, and reference content.
          </p>
        </div>
      </div>

      <section className="section-card card playbooks-search-card">
        <div className="playbooks-search-grid">
          <div>
            <label className="field-label">Search Playbooks</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, summary, department, category..."
            />
          </div>

          <div>
            <label className="field-label">Category</label>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">All Categories</option>
              {visibleCategories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Type</label>
            <select
              className="select"
              value={articleType}
              onChange={(e) => setArticleType(e.target.value)}
            >
              <option value="">All Types</option>
              {articleTypes.map((type) => (
                <option key={type} value={type}>
                  {articleTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">&nbsp;</label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearFilters}
              disabled={!hasFilters}
              style={{ width: "100%" }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="playbooks-chip-row" aria-label="Department filters">
          <button
            type="button"
            className={`playbooks-chip ${departmentId === "" ? "playbooks-chip-active" : ""}`}
            onClick={() => setDepartmentId("")}
          >
            All Departments
            <span className="playbooks-count-pill">{articles.length}</span>
          </button>

          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className={`playbooks-chip ${departmentId === dept.id ? "playbooks-chip-active" : ""}`}
              onClick={() => setDepartmentId((cur) => (cur === dept.id ? "" : dept.id))}
            >
              {dept.name}
              <span className="playbooks-count-pill">{departmentCount(dept.id)}</span>
            </button>
          ))}
        </div>
      </section>

      {loading ? <div className="card text-muted">Loading playbooks…</div> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="playbooks-main">
          {featured.length > 0 ? (
            <section className="section-card card">
              <div className="section-card-header">
                <div>
                  <h2 style={{ margin: 0 }}>Featured Playbooks</h2>
                  <p className="page-subtitle" style={{ marginTop: 4 }}>
                    Common guides and high-priority references.
                  </p>
                </div>
              </div>

              <div className="playbooks-featured-grid">
                {featured.map((row) => (
                  <Link
                    key={row.id}
                    href={`/playbooks/${encodeURIComponent(row.slug)}`}
                    className="playbooks-article-row"
                  >
                    <div>
                      <div className="badge badge-brand-blue" style={{ marginBottom: 8 }}>
                        Featured
                      </div>
                      <div className="playbooks-article-title">{row.title}</div>
                      <div className="playbooks-article-summary">
                        {row.summary || "No summary provided."}
                      </div>
                      <div className="playbooks-article-meta">
                        <span className="badge badge-neutral">{row.departmentName}</span>
                        <span className="badge badge-neutral">{row.categoryName}</span>
                        <span className="badge badge-brand-blue">
                          {articleTypeLabel(row.articleType)}
                        </span>
                      </div>
                    </div>

                    <div className="playbooks-article-date">
                      {fmtDate(row.publishedAt || row.updatedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="section-card card">
            <div className="section-card-header playbooks-results-header">
              <div>
                <h2 style={{ margin: 0 }}>
                  {hasFilters ? "Matching Playbooks" : "All Playbooks"}
                </h2>
                <div className="playbooks-active-filter-text">
                  {filteredArticles.length} published playbook
                  {filteredArticles.length === 1 ? "" : "s"} found.
                </div>
              </div>

              {hasFilters ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                  Clear Filters
                </button>
              ) : null}
            </div>

            {filteredArticles.length === 0 ? (
              <div className="playbooks-empty-state">
                <strong>No playbooks found.</strong>
                <div style={{ marginTop: 6 }}>
                  Try clearing filters or searching for a different keyword.
                </div>
              </div>
            ) : (
              <div className="playbooks-article-list">
                {filteredArticles.map((row) => (
                  <Link
                    key={row.id}
                    href={`/playbooks/${encodeURIComponent(row.slug)}`}
                    className="playbooks-article-row"
                  >
                    <div>
                      <div className="playbooks-article-title">{row.title}</div>

                      <div className="playbooks-article-summary">
                        {row.summary || "No summary provided."}
                      </div>

                      <div className="playbooks-article-meta">
                        <span className="badge badge-neutral">{row.departmentName}</span>
                        <span className="badge badge-neutral">{row.categoryName}</span>
                        <span className="badge badge-brand-blue">
                          {articleTypeLabel(row.articleType)}
                        </span>
                        {row.isFeatured ? (
                          <span className="badge badge-success">Featured</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="playbooks-article-date">
                      Updated {fmtDate(row.publishedAt || row.updatedAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
