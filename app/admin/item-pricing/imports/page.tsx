// app/admin/item-pricing/imports/page.tsx

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import styles from "../itemPricingUi.module.css";
type PriceBook = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type ImportRow = {
  id: string;
  rowNumber: number;
  itemCode: string | null;
  itemDescription: string | null;
  ruleSetCode: string | null;
  blankEqpPrice: number | null;
  status: string;
  errorMessage: string | null;
  warningMessage: string | null;
};

type ImportBatch = {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  priceBookName: string;
  status: string;
  fileName: string | null;
  rowCount: number;
  validRowCount: number;
  warningRowCount: number;
  errorRowCount: number;
  appliedRowCount: number;
  skippedRowCount: number;
  snapshotErrorCount: number;
  createdAt: string;
  createdBy: string | null;
  appliedAt: string | null;
  appliedBy: string | null;
  rows?: ImportRow[];
};

const SAMPLE_CSV = `item_code,item_description,rule_set_code,blank_eqp_2500,active,product_family,allows_blank_override,allows_flat_emb_override,allows_3d_override,allows_knit_in_override,notes\nTEST-CAP-280,Test Cap,IN_STOCK_CAPS,2.80,true,In Stock Caps,,,,,Example row\nTEST-PREM-280,Test Premium,PREMIUM_LINE,2.80,true,Premium Line,,,,,Example row`;

function statusClass(status: string) {
  if (status === "APPLIED") return "record-pill record-pill-success";
  if (status === "FAILED" || status === "ERROR" || status === "SKIPPED") return "record-pill record-pill-danger";
  if (status === "WARNING" || status === "STAGED") return "record-pill record-pill-warning";
  return "record-pill record-pill-neutral";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ItemPricingImportsPage() {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [priceBookId, setPriceBookId] = useState("");
  const [fileName, setFileName] = useState("item-pricing-import.csv");
  const [sourceSheetName, setSourceSheetName] = useState("");
  const [notes, setNotes] = useState("");
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedHasApplyErrors = useMemo(
    () => Boolean(selectedBatch && selectedBatch.errorRowCount > 0),
    [selectedBatch]
  );

  async function loadPriceBooks() {
    const res = await fetch("/api/admin/item-pricing/price-books?limit=100", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load price books.");
    const data = await res.json();
    const rows = data.rows || [];
    setPriceBooks(rows);
    if (!priceBookId && rows[0]?.id) setPriceBookId(rows[0].id);
  }

  async function loadBatches(nextSelectedId?: string) {
    const params = new URLSearchParams({ limit: "25", sortBy: "createdAt", sortDir: "desc" });
    if (priceBookId) params.set("priceBookId", priceBookId);
    const res = await fetch(`/api/admin/item-pricing/imports?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load import batches.");
    const data = await res.json();
    const rows = data.rows || [];
    setBatches(rows);

    const idToLoad = nextSelectedId || selectedBatch?.id || rows[0]?.id;
    if (idToLoad) await loadBatchDetail(idToLoad);
    else setSelectedBatch(null);
  }

  async function loadBatchDetail(id: string) {
    const res = await fetch(`/api/admin/item-pricing/imports/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load import batch details.");
    const data = await res.json();
    setSelectedBatch(data);
  }

  useEffect(() => {
    loadPriceBooks().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBatches().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceBookId]);

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
  }

  async function stageImport() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/item-pricing/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceBookId, fileName, sourceSheetName, notes, csvText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to stage import.");
      setMessage(`Import staged: ${data.validRowCount} valid, ${data.warningRowCount} warnings, ${data.errorRowCount} errors.`);
      await loadBatches(data.id);
    } catch (err: any) {
      setError(err.message || "Failed to stage import.");
    } finally {
      setLoading(false);
    }
  }

  async function applyImport() {
    if (!selectedBatch) return;
    if (selectedBatch.errorRowCount > 0) {
      setError("This import has error rows. Fix the CSV and stage a new batch before applying.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/item-pricing/imports/${selectedBatch.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveCalculatedSnapshots: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply import.");
      setMessage(`Import applied: ${data.appliedRowCount} rows applied${data.skippedRowCount ? `, ${data.skippedRowCount} skipped` : ""}.`);
      await loadBatches(data.id);
    } catch (err: any) {
      setError(err.message || "Failed to apply import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Imports</h1>
          <p className="page-subtitle">
            Stage, validate, and apply CSV item pricing rows into a price book. This imports Blank EQP 2500+ only.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/api/admin/item-pricing/import-template" className="btn btn-secondary">
            Download Template
          </Link>
          <Link href="/admin/item-pricing" className="btn btn-secondary">
            Back to Setup
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <section className="card">
        <div className="record-meta-grid">
          <label className="record-meta-item">
            <span className="record-meta-label">Price Book</span>
            <select className="select" value={priceBookId} onChange={(event) => setPriceBookId(event.target.value)}>
              {priceBooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.code} — {book.name}
                </option>
              ))}
            </select>
          </label>
          <label className="record-meta-item">
            <span className="record-meta-label">File Name</span>
            <input className="input" value={fileName} onChange={(event) => setFileName(event.target.value)} />
          </label>
          <label className="record-meta-item">
            <span className="record-meta-label">Source Sheet</span>
            <input className="input" value={sourceSheetName} onChange={(event) => setSourceSheetName(event.target.value)} placeholder="Optional" />
          </label>
          <label className="record-meta-item">
            <span className="record-meta-label">Upload CSV</span>
            <input className="input" type="file" accept=".csv,text/csv" onChange={(event) => handleFileChange(event.target.files?.[0] || null)} />
          </label>
        </div>

        <label>
          <span className="record-meta-label">Notes</span>
          <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional import notes" />
        </label>

        <label>
          <span className="record-meta-label">CSV Content</span>
          <textarea className={`textarea ${styles.csvTextarea}`} rows={10} value={csvText} onChange={(event) => setCsvText(event.target.value)} />
        </label>

        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" disabled={loading || !priceBookId || !csvText.trim()} onClick={stageImport}>
            {loading ? "Working..." : "Stage and Validate Import"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setCsvText(SAMPLE_CSV)}>
            Reset Sample
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Recent Import Batches</h2>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Price Book</th>
                <th>File</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Valid</th>
                <th>Warnings</th>
                <th>Errors</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDate(batch.createdAt)}</td>
                  <td>{batch.priceBookCode}</td>
                  <td>{batch.fileName || "—"}</td>
                  <td><span className={statusClass(batch.status)}>{batch.status}</span></td>
                  <td>{batch.rowCount}</td>
                  <td>{batch.validRowCount}</td>
                  <td>{batch.warningRowCount}</td>
                  <td>{batch.errorRowCount}</td>
                  <td>{batch.appliedRowCount}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadBatchDetail(batch.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={10}>No import batches staged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedBatch && (
        <section className="section-card">
          <div className="record-section-header">
            <div>
              <h2 className="record-section-title">Batch Detail</h2>
              <p className="page-subtitle">
                {selectedBatch.fileName || "Import"} · {selectedBatch.priceBookCode} · {selectedBatch.rowCount} rows
              </p>
            </div>
            <div className="page-header-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || selectedBatch.status === "APPLIED" || selectedHasApplyErrors}
                onClick={applyImport}
              >
                Apply Valid Rows
              </button>
            </div>
          </div>

          {selectedHasApplyErrors && (
            <div className="alert alert-warning">
              This batch has error rows. Correct the CSV and stage a new batch before applying.
            </div>
          )}

          {selectedBatch.snapshotErrorCount > 0 && (
            <div className="alert alert-warning">
              {selectedBatch.snapshotErrorCount} rows applied but did not save calculated snapshots. Re-test those items in Calculate / Preview.
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Item</th>
                  <th>Description</th>
                  <th>Rule Set</th>
                  <th>Blank EQP</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {(selectedBatch.rows || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.rowNumber}</td>
                    <td><span className={statusClass(row.status)}>{row.status}</span></td>
                    <td>{row.itemCode || "—"}</td>
                    <td>{row.itemDescription || "—"}</td>
                    <td>{row.ruleSetCode || "—"}</td>
                    <td>{row.blankEqpPrice == null ? "—" : Number(row.blankEqpPrice).toFixed(2)}</td>
                    <td>{row.errorMessage || row.warningMessage || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
