"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../../itemPricingUi.module.css";

type Row = {
  id: string;
  rowNumber: number;
  itemCode: string | null;
  itemDescription: string | null;
  ruleSetCode: string | null;
  oldBlankEqp: number | null;
  newBlankEqp: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  oldFlatEqp: number | null;
  newFlatEqp: number | null;
  old3dEqp: number | null;
  new3dEqp: number | null;
  status: string;
  warningMessage: string | null;
  errorMessage: string | null;
};

type Batch = {
  id: string;
  batchNumber: string;
  priceBookCode: string;
  priceBookName: string;
  name: string;
  updateType: string;
  adjustmentType: string;
  adjustmentValue: number | null;
  status: string;
  notes: string | null;
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
  rows: Row[];
};

function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function pct(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
}

export default function ItemPricingUpdateBatchDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [id, setId] = useState<string>("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id));
  }, [params]);

  async function load(batchId = id) {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/item-pricing/update-batches/${batchId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load update batch.");
      setBatch(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load update batch.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function applyBatch() {
    if (!id) return;
    if (!confirm("Apply this update batch? This will update Blank EQP base prices for all valid rows.")) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/item-pricing/update-batches/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveCalculatedSnapshots: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to apply update batch.");
      setBatch(json);
    } catch (err: any) {
      setError(err?.message || "Failed to apply update batch.");
    } finally {
      setApplying(false);
    }
  }

  const canApply = batch && batch.status !== "APPLIED" && batch.errorRowCount === 0 && (batch.validRowCount + batch.warningRowCount) > 0;

  return (
    <main className={`page-shell-wide ${styles.pageStack}`}>
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Item Pricing Update Batch</h1>
          <p className="page-subtitle">Review old/new Blank EQP, Flat EQP, and 3D EQP before applying.</p>
        </div>
        <div className="page-header-actions">
          <Link href="/admin/item-pricing/update-batches" className="btn btn-secondary btn-sm">Back to Batches</Link>
          <Link href="/admin/item-pricing" className="btn btn-secondary btn-sm">Setup</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <section className="card">Loading update batch...</section> : null}

      {batch ? (
        <>
          <section className="card">
            <div className="record-meta-grid">
              <div className="record-meta-item">
                <span className="record-meta-label">Batch</span>
                <span className="record-meta-value">{batch.batchNumber}</span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Name</span>
                <span className="record-meta-value">{batch.name}</span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Price Book</span>
                <span className="record-meta-value">{batch.priceBookCode}</span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Status</span>
                <span className="record-meta-value"><span className="badge">{batch.status}</span></span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Update Type</span>
                <span className="record-meta-value">{batch.updateType}</span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Adjustment</span>
                <span className="record-meta-value">{batch.adjustmentType}{batch.adjustmentValue !== null ? ` ${batch.adjustmentValue}` : ""}</span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Rows</span>
                <span className="record-meta-value">{batch.rowCount} total / {batch.errorRowCount} errors</span>
              </div>
              <div className="record-meta-item">
                <span className="record-meta-label">Applied</span>
                <span className="record-meta-value">{batch.appliedRowCount} applied</span>
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="record-section-header">
              <div>
                <h2 className="record-section-title">Before / After Preview</h2>
                <p className="page-subtitle">Error rows must be corrected in a new batch before this batch can be applied.</p>
              </div>
              <div className="page-header-actions">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => load()}>Refresh</button>
                <button className="btn btn-primary btn-sm" type="button" disabled={!canApply || applying} onClick={applyBatch}>
                  {applying ? "Applying..." : "Apply Batch"}
                </button>
              </div>
            </div>

            {batch.notes ? <p className="page-subtitle">{batch.notes}</p> : null}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Status</th>
                    <th>Item</th>
                    <th>Rule Set</th>
                    <th>Old Blank</th>
                    <th>New Blank</th>
                    <th>Change</th>
                    <th>Change %</th>
                    <th>Old Flat</th>
                    <th>New Flat</th>
                    <th>Old 3D</th>
                    <th>New 3D</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rowNumber}</td>
                      <td><span className="badge">{row.status}</span></td>
                      <td>{row.itemCode}<br /><span className="page-subtitle">{row.itemDescription || ""}</span></td>
                      <td>{row.ruleSetCode || "—"}</td>
                      <td>{money(row.oldBlankEqp)}</td>
                      <td>{money(row.newBlankEqp)}</td>
                      <td>{money(row.changeAmount)}</td>
                      <td>{pct(row.changePercent)}</td>
                      <td>{money(row.oldFlatEqp)}</td>
                      <td>{money(row.newFlatEqp)}</td>
                      <td>{money(row.old3dEqp)}</td>
                      <td>{money(row.new3dEqp)}</td>
                      <td>{row.errorMessage || row.warningMessage || ""}</td>
                    </tr>
                  ))}
                  {batch.rows.length === 0 ? <tr><td colSpan={13}>No rows found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
