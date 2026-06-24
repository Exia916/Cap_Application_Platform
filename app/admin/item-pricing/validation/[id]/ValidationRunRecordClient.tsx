"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";
import { ITEM_PRICING_ENTITY_TYPES } from "@/lib/itemPricing/constants";
import styles from "../../itemPricingUi.module.css";

type ValidationIssue = {
  id: number;
  severity: string;
  issueCode: string;
  itemCode: string | null;
  ruleSetCode: string | null;
  decorationMethodCode: string | null;
  quantityBreakCode: string | null;
  message: string;
};

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
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  completedAt: string | null;
  issues: ValidationIssue[];
};

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function statusClass(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "PASSED") return "record-pill record-pill-success";
  if (s === "WARNINGS" || s === "WARNING") return "record-pill record-pill-warning";
  if (s === "FAILED" || s === "ERROR") return "record-pill record-pill-danger";
  return "record-pill record-pill-neutral";
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="record-meta-item">
      <div className="record-meta-label">{label}</div>
      <div className="record-meta-value">{value || "—"}</div>
    </div>
  );
}

export default function ValidationRunRecordClient({ id }: { id: string }) {
  const [row, setRow] = useState<ValidationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/validation/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load validation run.");
      setRow(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load validation run.");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return <main className="record-shell"><div className="card">Loading validation run…</div></main>;
  }

  if (!row) {
    return (
      <main className="record-shell">
        <div className="alert alert-danger">{error || "Validation run not found."}</div>
        <Link href="/admin/item-pricing/validation" className="btn btn-secondary">Back to Validation</Link>
      </main>
    );
  }

  const issues = severityFilter ? row.issues.filter((issue) => issue.severity === severityFilter) : row.issues;

  return (
    <main className={`record-shell ${styles.pageStack}`}>
      <div className="record-header">
        <div className="record-header-main">
          <div className="record-kicker">Admin / Item Pricing Validation</div>
          <h1 className="record-title">{row.priceBookCode}</h1>
          <p className="record-subtitle">Foundation validation run</p>
          <div className="record-badge-row">
            <span className={statusClass(row.status)}>{row.status}</span>
            <span className="record-pill record-pill-neutral">{row.errorCount} error(s)</span>
            <span className="record-pill record-pill-neutral">{row.warningCount} warning(s)</span>
          </div>
        </div>
        <div className="record-actions">
          <Link href="/admin/item-pricing/validation" className="btn btn-secondary">Back</Link>
          <Link href={`/admin/item-pricing/price-books/${encodeURIComponent(row.priceBookId)}`} className="btn btn-secondary">Price Book</Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="record-content">
        <section className="record-section-card">
          <div className="record-section-header"><h2 className="record-section-title">Summary</h2></div>
          <div className="record-meta-grid">
            <MetaItem label="Price Book" value={`${row.priceBookCode} — ${row.priceBookName}`} />
            <MetaItem label="Status" value={row.status} />
            <MetaItem label="Items Checked" value={row.itemCount} />
            <MetaItem label="Issues" value={`${row.issueCount} total`} />
            <MetaItem label="Errors" value={row.errorCount} />
            <MetaItem label="Warnings" value={row.warningCount} />
            <MetaItem label="Completed" value={fmtDateTime(row.completedAt)} />
            <MetaItem label="Created By" value={row.createdBy || "—"} />
          </div>
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <div>
              <h2 className="record-section-title">Validation Issues</h2>
              <p className="page-subtitle">Resolve errors before publishing. Warnings should be reviewed before customer price-level logic is added.</p>
            </div>
            <select className="select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">All Severities</option>
              <option value="ERROR">Errors</option>
              <option value="WARNING">Warnings</option>
            </select>
          </div>

          {issues.length === 0 ? (
            <div className="muted-box">No issues for this filter.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Issue</th>
                    <th>Item</th>
                    <th>Rule Set</th>
                    <th>Method</th>
                    <th>Qty</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id}>
                      <td><span className={statusClass(issue.severity)}>{issue.severity}</span></td>
                      <td>{issue.issueCode}</td>
                      <td>{issue.itemCode || "—"}</td>
                      <td>{issue.ruleSetCode || "—"}</td>
                      <td>{issue.decorationMethodCode || "—"}</td>
                      <td>{issue.quantityBreakCode || "—"}</td>
                      <td>{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="record-section-card">
          <ActivityHistoryPanel entityType={ITEM_PRICING_ENTITY_TYPES.validationRun} entityId={row.id} defaultExpanded={false} />
        </section>
      </div>
    </main>
  );
}
