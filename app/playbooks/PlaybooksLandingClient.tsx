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

export default function PlaybooksLandingClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);

  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");

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

  const filteredArticles = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return articles.filter((row) => {
      if (departmentId && row.departmentId !== departmentId) return false;
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
    });
  }, [articles, q, departmentId]);

  const featured = filteredArticles.filter((x) => x.isFeatured).slice(0, 4);

  const recent = [...filteredArticles]
    .sort((a, b) => {
      const av = new Date(a.publishedAt || a.updatedAt).getTime();
      const bv = new Date(b.publishedAt || b.updatedAt).getTime();
      return bv - av;
    })
    .slice(0, 8);

  const visibleCategories = categories.filter(
    (x) => !departmentId || x.departmentId === departmentId
  );

  const categoriesByDepartment = useMemo(() => {
    const map = new Map<string, CategoryRow[]>();
    for (const cat of visibleCategories) {
      if (!map.has(cat.departmentName)) map.set(cat.departmentName, []);
      map.get(cat.departmentName)!.push(cat);
    }
    return map;
  }, [visibleCategories]);

  return (
    <div className="page-shell-wide playbooks-shell">
      <style>{`
        .playbooks-shell {
          width: 100%;
          max-width: 1680px;
          margin-inline: auto;
          box-sizing: border-box;
        }

        .playbooks-search-card {
          margin-bottom: 16px;
        }

        /* 2-column: 300px left sidebar, flexible right content area */
        .playbooks-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 16px;
          align-items: start;
        }

        .playbooks-left,
        .playbooks-right {
          display: grid;
          gap: 16px;
          align-content: start;
        }

        .playbooks-left  { grid-column: 1; }
        .playbooks-right { grid-column: 2; }

        /* Department cards — single column in the narrow sidebar */
        .playbooks-departments-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .playbooks-department-card {
          text-align: left;
          cursor: pointer;
          min-height: 72px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }

        .playbooks-department-card:hover {
          transform: translateY(-1px);
        }

        /* Article lists */
        .playbooks-featured-list,
        .playbooks-recent-list {
          display: grid;
          gap: 14px;
        }

        .playbooks-featured-card,
        .playbooks-recent-card {
          text-decoration: none;
          display: block;
        }

        .playbooks-recent-list .playbooks-recent-card {
          min-height: 118px;
        }

        /* Category shortcuts — grouped */
        .playbooks-category-group {
          margin-bottom: 14px;
        }

        .playbooks-category-group:last-child {
          margin-bottom: 0;
        }

        .playbooks-category-group-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted, #888);
          margin-bottom: 6px;
        }

        .playbooks-category-badge-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        /* Responsive: stack at narrow viewports */
        @media (max-width: 900px) {
          .playbooks-layout {
            grid-template-columns: 1fr;
          }

          .playbooks-left,
          .playbooks-right {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Playbooks</h1>
          <p className="page-subtitle">
            Internal guides, how-to documentation, troubleshooting steps, and reference content.
          </p>
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="section-card card playbooks-search-card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12 }}>
          <div>
            <label className="field-label">Search</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, summary, department, category..."
            />
          </div>

          <div>
            <label className="field-label">Department</label>
            <select
              className="select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? <div className="card text-muted">Loading playbooks…</div> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      {!loading && !error ? (
        <div className="playbooks-layout">

          {/* ── LEFT: Departments → Featured Articles ───────── */}
          <div className="playbooks-left">
            <section className="section-card card">
              <div className="section-card-header">
                <h2 style={{ margin: 0 }}>Departments</h2>
              </div>

              <div className="playbooks-departments-grid">
                {departments.map((dept) => {
                  const isSelected = departmentId === dept.id;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      className="card playbooks-department-card"
                      onClick={() =>
                        setDepartmentId((cur) => (cur === dept.id ? "" : dept.id))
                      }
                      style={{
                        borderColor: isSelected ? "var(--brand-blue)" : undefined,
                        background: isSelected ? "var(--accent-soft)" : undefined,
                        boxShadow: isSelected
                          ? "0 0 0 1px var(--brand-blue) inset"
                          : undefined,
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>{dept.name}</div>
                      <div className="text-soft">
                        {dept.description || "No description provided."}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="section-card card">
              <div className="section-card-header">
                <h2 style={{ margin: 0 }}>Featured Articles</h2>
              </div>

              {featured.length === 0 ? (
                <div className="text-soft">No featured playbooks yet.</div>
              ) : (
                <div className="playbooks-featured-list">
                  {featured.map((row) => (
                    <Link
                      key={row.id}
                      href={`/playbooks/${encodeURIComponent(row.slug)}`}
                      className="card playbooks-featured-card"
                    >
                      <div className="badge badge-brand-blue" style={{ marginBottom: 10 }}>
                        Featured
                      </div>

                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{row.title}</div>

                      <div className="text-soft" style={{ marginBottom: 8 }}>
                        {row.summary || "No summary provided."}
                      </div>

                      <div className="text-soft" style={{ fontSize: 12 }}>
                        {row.departmentName} · {row.categoryName}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
              {/* ── RIGHT: Recent Articles  ────── */}
            
          
          <div className="playbooks-right">
            <section className="section-card card">
              <div className="section-card-header">
                <h2 style={{ margin: 0 }}>Recent Articles</h2>
              </div>

              {recent.length === 0 ? (
                <div className="text-soft">No published playbooks found.</div>
              ) : (
                <div className="playbooks-recent-list">
                  {recent.map((row) => (
                    <Link
                      key={row.id}
                      href={`/playbooks/${encodeURIComponent(row.slug)}`}
                      className="card playbooks-recent-card"
                    >
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{row.title}</div>

                      <div className="text-soft" style={{ marginBottom: 8 }}>
                        {row.summary || "No summary provided."}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="badge badge-neutral">{row.departmentName}</span>
                        <span className="badge badge-neutral">{row.categoryName}</span>
                        <span className="badge badge-brand-blue">{row.articleType}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            

          </div>

        </div>
      ) : null}
    </div>
  );
}
