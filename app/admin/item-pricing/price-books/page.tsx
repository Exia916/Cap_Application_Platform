"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import styles from "../itemPricingUi.module.css";

type PriceBookRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  effectiveDate: string | null;
  expirationDate: string | null;
  isDefault: boolean;
  itemCount: number;
  updatedAt: string;
  updatedBy: string | null;
  lastValidatedAt?: string | null;
  lastValidationStatus?: string | null;
  lastValidationErrorCount?: number | null;
  lastValidationWarningCount?: number | null;
};

function fmtDate(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function pill(status?: string | null) {
  const s = String(status || "").toUpperCase();
  const cls = s === "PUBLISHED" || s === "PASSED" ? "record-pill record-pill-success" : s === "REVIEW" || s === "WARNINGS" ? "record-pill record-pill-warning" : s === "ARCHIVED" || s === "FAILED" ? "record-pill record-pill-danger" : "record-pill record-pill-neutral";
  return <span className={cls}>{s || "—"}</span>;
}

export default function ItemPricingPriceBooksPage() {
  const [rows, setRows] = useState<PriceBookRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", status: "DRAFT", effectiveDate: "" });

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String(pageIndex * pageSize));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [pageIndex, pageSize, q, sortBy, sortDir]);

  async function loadRows() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/price-books?${queryString}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load price books.");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      setError(err?.message || "Failed to load price books.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [queryString]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/admin/item-pricing/price-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, isDefault: rows.length === 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create price book.");
      setForm({ code: "", name: "", status: "DRAFT", effectiveDate: "" });
      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Failed to create price book.");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<PriceBookRow>[] = [
    { key: "code", header: "Code", sortable: true, render: (r) => <Link href={`/admin/item-pricing/price-books/${encodeURIComponent(r.id)}`}>{r.code}</Link>, getSearchText: (r) => r.code },
    { key: "name", header: "Name", sortable: true, render: (r) => r.name, getSearchText: (r) => r.name },
    { key: "status", header: "Status", sortable: true, render: (r) => pill(r.status), getSearchText: (r) => r.status },
    { key: "itemCount", header: "Items", sortable: true, render: (r) => r.itemCount ?? 0, getSearchText: (r) => String(r.itemCount ?? 0) },
    { key: "validation", header: "Validation", render: (r) => r.lastValidationStatus ? <span title={`${r.lastValidationErrorCount || 0} errors, ${r.lastValidationWarningCount || 0} warnings`}>{pill(r.lastValidationStatus)}</span> : <span className="record-pill record-pill-neutral">Not validated</span>, getSearchText: (r) => r.lastValidationStatus || "Not validated" },
    { key: "effectiveDate", header: "Effective", sortable: true, render: (r) => fmtDate(r.effectiveDate), getSearchText: (r) => fmtDate(r.effectiveDate) },
    { key: "updatedAt", header: "Updated", sortable: true, render: (r) => fmtDate(r.updatedAt), getSearchText: (r) => fmtDate(r.updatedAt) },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className={styles.formActions}>
          <Link className="btn btn-secondary btn-sm" href={`/admin/item-pricing/price-books/${encodeURIComponent(r.id)}`}>
            Open
          </Link>
          <Link className="btn btn-secondary btn-sm" href={`/admin/item-pricing/calculate?priceBookId=${encodeURIComponent(r.id)}`}>
            Preview
          </Link>
        </div>
      ),
    },
  ];

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Price Books</h1>
          <p className="page-subtitle">Maintain pricing versions, lifecycle state, validation status, and supporting documentation.</p>
        </div>
        <Link href="/admin/item-pricing" className="btn btn-secondary">Back to Setup</Link>
      </div>

      <section className="section-card">
        <div className="record-section-header"><h2 className="record-section-title">New Price Book</h2></div>
        <form onSubmit={submit} className={styles.formGrid}>
          <label>Code<input className="input" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="2026_WORKING" /></label>
          <label>Name<input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="2026 Working Price Book" /></label>
          <label>Status<select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}><option>DRAFT</option><option>REVIEW</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label>
          <label>Effective Date<input className="input" type="date" value={form.effectiveDate} onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))} /></label>
          <div className={styles.formActions}><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Create"}</button></div>
        </form>
      </section>

      <section className="section-card">
        <div className={styles.filterGrid}>
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPageIndex(0); }} placeholder="Search price books…" />
          <Link href="/admin/item-pricing/validation" className="btn btn-secondary">Validation Runs</Link>
          <button type="button" className="btn btn-secondary" onClick={loadRows}>Refresh</button>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={(key) => { if (sortBy !== key) { setSortBy(key); setSortDir("asc"); } else setSortDir((d) => d === "asc" ? "desc" : "asc"); }}
          totalCount={total}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          rowKey={(r) => r.id}
          emptyText="No price books found."
          enableCsvExport
          csvFilename="item_pricing_price_books.csv"
          rowToCsv={(r) => ({ Code: r.code, Name: r.name, Status: r.status, Items: r.itemCount, Validation: r.lastValidationStatus || "", Errors: r.lastValidationErrorCount || 0, Warnings: r.lastValidationWarningCount || 0, Effective: fmtDate(r.effectiveDate), Updated: fmtDate(r.updatedAt) })}
        />
      </section>
    </main>
  );
}
