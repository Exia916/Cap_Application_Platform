"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import styles from "../itemPricingUi.module.css";

type PriceBookRow = { id: string; code: string; name: string };
type ValidationRun = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  status: string;
  itemCount: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  createdAt: string;
  completedAt: string | null;
  createdBy: string | null;
};

function fmtDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function statusPill(status?: string | null) {
  const s = String(status || "").toUpperCase();
  const cls = s === "PASSED" ? "record-pill record-pill-success" : s === "WARNINGS" ? "record-pill record-pill-warning" : s === "FAILED" ? "record-pill record-pill-danger" : "record-pill record-pill-neutral";
  return <span className={cls}>{s || "—"}</span>;
}

export default function ValidationListClient({ initialPriceBookId = "" }: { initialPriceBookId?: string }) {
  const [priceBooks, setPriceBooks] = useState<PriceBookRow[]>([]);
  const [priceBookId, setPriceBookId] = useState(initialPriceBookId);
  const [rows, setRows] = useState<ValidationRun[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPriceBooks() {
    const res = await fetch("/api/admin/item-pricing/price-books?limit=250&sortBy=code&sortDir=asc", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPriceBooks(Array.isArray(data?.rows) ? data.rows : []);
  }

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String(pageIndex * pageSize));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    if (q.trim()) sp.set("q", q.trim());
    if (priceBookId) sp.set("priceBookId", priceBookId);
    return sp.toString();
  }, [pageIndex, pageSize, priceBookId, q, sortBy, sortDir]);

  async function loadRuns() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/validation?${queryString}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load validation runs.");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      setError(err?.message || "Failed to load validation runs.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPriceBooks();
  }, []);

  useEffect(() => {
    loadRuns();
  }, [queryString]);

  async function runValidation() {
    try {
      setRunning(true);
      setError(null);
      const res = await fetch("/api/admin/item-pricing/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceBookId: priceBookId || null, includeCalculationCheck: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to run validation.");
      window.location.href = `/admin/item-pricing/validation/${encodeURIComponent(data.id)}`;
    } catch (err: any) {
      setError(err?.message || "Failed to run validation.");
    } finally {
      setRunning(false);
    }
  }

  const columns: Column<ValidationRun>[] = [
    { key: "priceBookCode", header: "Price Book", sortable: true, render: (r) => r.priceBookCode, getSearchText: (r) => r.priceBookCode },
    { key: "status", header: "Status", sortable: true, render: (r) => statusPill(r.status), getSearchText: (r) => r.status },
    { key: "itemCount", header: "Items", render: (r) => r.itemCount, getSearchText: (r) => String(r.itemCount) },
    { key: "errorCount", header: "Errors", sortable: true, render: (r) => r.errorCount, getSearchText: (r) => String(r.errorCount) },
    { key: "warningCount", header: "Warnings", sortable: true, render: (r) => r.warningCount, getSearchText: (r) => String(r.warningCount) },
    { key: "createdAt", header: "Created", sortable: true, render: (r) => fmtDateTime(r.createdAt), getSearchText: (r) => fmtDateTime(r.createdAt) },
    { key: "actions", header: "Actions", render: (r) => <Link className="btn btn-secondary btn-sm" href={`/admin/item-pricing/validation/${encodeURIComponent(r.id)}`}>Open</Link> },
  ];

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Validation</h1>
          <p className="page-subtitle">Run foundation checks before publishing or using a price book for customer price-level logic.</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" disabled={running} onClick={runValidation}>{running ? "Running…" : "Run Validation"}</button>
          <Link href="/admin/item-pricing" className="btn btn-secondary">Back to Setup</Link>
        </div>
      </div>

      <section className="section-card">
        <div className={styles.filterGrid}>
          <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPageIndex(0); }} placeholder="Search validation runs…" />
          <select className="select" value={priceBookId} onChange={(e) => { setPriceBookId(e.target.value); setPageIndex(0); }}>
            <option value="">Default / All Price Books</option>
            {priceBooks.map((book) => <option value={book.id} key={book.id}>{book.code} — {book.name}</option>)}
          </select>
          <button type="button" className="btn btn-secondary" onClick={loadRuns}>Refresh</button>
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
          emptyText="No validation runs found."
          enableCsvExport
          csvFilename="item_pricing_validation_runs.csv"
          rowToCsv={(r) => ({ PriceBook: r.priceBookCode, Status: r.status, Items: r.itemCount, Errors: r.errorCount, Warnings: r.warningCount, Created: fmtDateTime(r.createdAt), CreatedBy: r.createdBy || "" })}
        />
      </section>
    </main>
  );
}
