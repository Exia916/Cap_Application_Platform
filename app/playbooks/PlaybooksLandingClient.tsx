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
            {
              cache: "no-store",
            }
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
      if (!map.has(cat.departmentName)) {
        map.set(cat.departmentName, []);
      }
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

        .playbooks-layout {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr) 320px;
          gap: 16px;
          align-items: start;
        }

        .playbooks-left,
        .playbooks-center,
        .playbooks-right {
          display: grid;
          gap: 16px;
          align-content: start;
        }

        .playbooks-left {
          grid-column: 1;
        }

        .playbooks-center {
          grid-column: 2;
        }

        .playbooks-right {
          grid-column: 3;
        }

        .playbooks-departments-panel {
          min-height: 420px;
        }

        .playbooks-departments-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .playbooks-department-card {
          text-align: left;
          cursor: pointer;
          min-height: 112px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }

        .playbooks-department-card:hover {
          transform: translateY(-1px);
        }

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

        @media (max-width: 1520px) {
          .playbooks-shell {
            max-width: 1480px;
          }

          .playbooks-layout {
            grid-template-columns: 280px minmax(0, 1fr) 280px;
          }
        }

        @media (max-width: 1180px) {
          .playbooks-shell {
            width: 100%;
            max-width: none;
          }

          .playbooks-layout {
            grid-template-columns: 1fr;
          }

          .playbooks-left,
          .playbooks-center,
          .playbooks-right {
            grid-column: auto;
          }

          .playbooks-departments-grid {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }
        }

        @media (max-width: 720px) {
          .playbooks-departments-grid {
            grid-template-columns: 1fr;
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

      <div className="section-card card playbooks-search-card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 260px",
            gap: 12,
          }}
        >
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
          <div className="playbooks-left">
            <section className="section-card card playbooks-departments-panel">
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
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>{dept.name}</div>
                      <div className="text-soft">
                        {dept.description || "No description provided."}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="playbooks-center">
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

          <div className="playbooks-right">
            <section className="section-card card">
              <div className="section-card-header">
                <h2 style={{ margin: 0 }}>Category Shortcuts</h2>
              </div>

              {categoriesByDepartment.size === 0 ? (
                <div className="text-soft">No categories available.</div>
              ) : (
                Array.from(categoriesByDepartment.entries()).map(([deptName, cats]) => (
                  <div key={deptName} className="playbooks-category-group">
                    <div className="playbooks-category-group-label">{deptName}</div>
                    <div className="playbooks-category-badge-list">
                      {cats.map((cat) => (
                        <span key={cat.id} className="badge badge-neutral">
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}