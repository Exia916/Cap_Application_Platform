"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type Row = {
  id: string;
  departmentName: string;
  categoryName: string;
  title: string;
  slug: string;
  articleType: string;
  status: string;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

type Filters = {
  q: string;
  departmentId: string;
  categoryId: string;
  articleType: string;
  status: string;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  departmentId: "",
  categoryId: "",
  articleType: "",
  status: "",
};

function statusBadge(value: string) {
  if (value === "published") return <span className="badge badge-success">Published</span>;
  if (value === "archived") return <span className="badge badge-warning">Archived</span>;
  return <span className="badge badge-neutral">Draft</span>;
}

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function PlaybooksAdminTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [deptRes, catRes] = await Promise.all([
          fetch("/api/playbooks/departments", { cache: "no-store" }),
          fetch("/api/playbooks/categories", { cache: "no-store" }),
        ]);

        const deptData = await deptRes.json().catch(() => ({}));
        const catData = await catRes.json().catch(() => ({}));

        if (deptRes.ok) setDepartments(Array.isArray(deptData?.rows) ? deptData.rows : []);
        if (catRes.ok) setCategories(Array.isArray(catData?.rows) ? catData.rows : []);
      } catch {
        // allow table to keep working even if lookups fail
      }
    })();
  }, []);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("page", String(pageIndex + 1));
    sp.set("pageSize", String(pageSize));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("publicOnly", "false");

    if (filters.q.trim()) sp.set("q", filters.q.trim());
    if (filters.departmentId) sp.set("departmentId", filters.departmentId);
    if (filters.categoryId) sp.set("categoryId", filters.categoryId);
    if (filters.articleType) sp.set("articleType", filters.articleType);
    if (filters.status) sp.set("status", filters.status);

    return sp.toString();
  }, [filters, pageIndex, pageSize, sortBy, sortDir]);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/playbooks?${queryString}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load playbooks.");

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number(data?.total ?? 0));
    } catch (err: any) {
      setError(err?.message || "Failed to load playbooks.");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [queryString]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }
    setSortDir((cur) => (cur === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    setFilters((cur) => ({ ...cur, [key]: value }));
    setPageIndex(0);
  }

  const columns: Column<Row>[] = useMemo(
    () => [
      {
        key: "title",
        header: "TITLE",
        sortable: true,
        filterable: true,
        placeholder: "Search title/summary...",
        render: (r) => (
          <div>
            <div style={{ fontWeight: 700 }}>{r.title}</div>
            <div className="text-soft" style={{ fontSize: 12 }}>
              {r.slug}
            </div>
          </div>
        ),
        getSearchText: (r) => `${r.title} ${r.slug}`,
      },
      {
        key: "departmentName",
        header: "DEPARTMENT",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.departmentId}
            onChange={(e) => onFilterChange("departmentId", e.target.value)}
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ),
        render: (r) => r.departmentName,
      },
      {
        key: "categoryName",
        header: "CATEGORY",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.categoryId}
            onChange={(e) => onFilterChange("categoryId", e.target.value)}
          >
            <option value="">All</option>
            {categories
              .filter((c) => !filters.departmentId || c.departmentId === filters.departmentId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.departmentName} · {c.name}
                </option>
              ))}
          </select>
        ),
        render: (r) => r.categoryName,
      },
      {
        key: "articleType",
        header: "TYPE",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.articleType}
            onChange={(e) => onFilterChange("articleType", e.target.value)}
          >
            <option value="">All</option>
            <option value="application_guide">application_guide</option>
            <option value="job_function">job_function</option>
            <option value="troubleshooting">troubleshooting</option>
            <option value="reference">reference</option>
          </select>
        ),
        render: (r) => r.articleType,
      },
      {
        key: "status",
        header: "STATUS",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.status}
            onChange={(e) => onFilterChange("status", e.target.value)}
          >
            <option value="">All</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        ),
        render: (r) => statusBadge(r.status),
        getSearchText: (r) => r.status,
      },
      {
        key: "isFeatured",
        header: "FEATURED",
        sortable: true,
        render: (r) =>
          r.isFeatured ? (
            <span className="badge badge-brand-blue">Yes</span>
          ) : (
            <span className="badge badge-neutral">No</span>
          ),
        getSearchText: (r) => (r.isFeatured ? "Yes" : "No"),
      },
      {
        key: "publishedAt",
        header: "PUBLISHED",
        sortable: true,
        render: (r) => fmtDateTime(r.publishedAt),
        getSearchText: (r) => fmtDateTime(r.publishedAt),
      },
      {
        key: "updatedAt",
        header: "UPDATED",
        sortable: true,
        render: (r) => fmtDateTime(r.updatedAt),
        getSearchText: (r) => fmtDateTime(r.updatedAt),
      },
      {
        key: "edit",
        header: "",
        render: (r) => (
          <Link href={`/admin/playbooks/${encodeURIComponent(r.id)}/edit`} className="btn btn-primary btn-sm">
            Edit
          </Link>
        ),
      },
    ],
    [filters, departments, categories]
  );

  const toolbar = (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setFilters(DEFAULT_FILTERS);
          setSortBy("updatedAt");
          setSortDir("desc");
          setPageIndex(0);
        }}
      >
        Clear Filters
      </button>
    </>
  );

  return (
    <DataTable<Row>
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      sortBy={sortBy}
      sortDir={sortDir}
      onToggleSort={onToggleSort}
      filters={filters}
      onFilterChange={onFilterChange}
      totalCount={totalCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageIndexChange={setPageIndex}
      onPageSizeChange={setPageSize}
      toolbar={toolbar}
      rowKey={(r) => r.id}
      emptyText="No playbook articles found."
      globalSearchPlaceholder="Search current view…"
      csvFilename="playbooks-admin.csv"
      rowToCsv={(r) => ({
        Title: r.title,
        Department: r.departmentName,
        Category: r.categoryName,
        Type: r.articleType,
        Status: r.status,
        Featured: r.isFeatured ? "Yes" : "No",
        Published: r.publishedAt ?? "",
        Updated: r.updatedAt,
        Slug: r.slug,
      })}
    />
  );
}