"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import CommentsPanel from "@/components/platform/CommentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";
import {
  ITEM_PRICING_ATTACHMENT_CATEGORIES,
  ITEM_PRICING_ENTITY_TYPES,
} from "@/lib/itemPricing/constants";
import styles from "../../itemPricingUi.module.css";

type PriceBook = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  effectiveDate: string | null;
  expirationDate: string | null;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  reviewRequestedAt?: string | null;
  reviewRequestedBy?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  lastValidatedAt?: string | null;
  lastValidationStatus?: string | null;
  lastValidationErrorCount?: number | null;
  lastValidationWarningCount?: number | null;
};

type ValidationRun = {
  id: string;
  status: string;
  errorCount: number;
  warningCount: number;
  createdAt: string;
  createdBy: string | null;
};

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "PUBLISHED" || s === "PASSED") return "record-pill record-pill-success";
  if (s === "REVIEW" || s === "WARNINGS") return "record-pill record-pill-warning";
  if (s === "ARCHIVED" || s === "FAILED") return "record-pill record-pill-danger";
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

export default function PriceBookRecordClient({ id }: { id: string }) {
  const router = useRouter();
  const [row, setRow] = useState<PriceBook | null>(null);
  const [validationRuns, setValidationRuns] = useState<ValidationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateForm, setDuplicateForm] = useState({ code: "", name: "", effectiveDate: "" });

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [bookRes, validationRes] = await Promise.all([
        fetch(`/api/admin/item-pricing/price-books/${encodeURIComponent(id)}`, {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/admin/item-pricing/validation?priceBookId=${encodeURIComponent(id)}&limit=5&sortBy=createdAt&sortDir=desc`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      const bookData = await bookRes.json().catch(() => ({}));
      if (!bookRes.ok) throw new Error(bookData?.error || "Failed to load price book.");

      const validationData = await validationRes.json().catch(() => ({}));
      setRow(bookData);
      setValidationRuns(Array.isArray(validationData?.rows) ? validationData.rows : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load price book.");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function updateStatus(status: string) {
    if (!row) return;
    const confirmMessage =
      status === "PUBLISHED"
        ? "Publish this price book? This requires the latest validation to have no errors."
        : status === "ARCHIVED"
          ? "Archive this price book?"
          : `Move this price book to ${status}?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/price-books/${encodeURIComponent(row.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update status.");
      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to update status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function runValidation() {
    if (!row) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch("/api/admin/item-pricing/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceBookId: row.id, includeCalculationCheck: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to run validation.");
      router.push(`/admin/item-pricing/validation/${encodeURIComponent(data.id)}`);
    } catch (err: any) {
      setError(err?.message || "Failed to run validation.");
    } finally {
      setActionLoading(false);
    }
  }

  async function duplicatePriceBook(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/item-pricing/price-books/${encodeURIComponent(row.id)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(duplicateForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to duplicate price book.");
      router.push(`/admin/item-pricing/price-books/${encodeURIComponent(data.id)}`);
    } catch (err: any) {
      setError(err?.message || "Failed to duplicate price book.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="record-shell">
        <div className="card">Loading price book…</div>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="record-shell">
        <div className="alert alert-danger">{error || "Price book not found."}</div>
        <Link href="/admin/item-pricing/price-books" className="btn btn-secondary">Back to Price Books</Link>
      </main>
    );
  }

  const canPublish = Number(row.lastValidationErrorCount || 0) === 0 && !!row.lastValidatedAt;

  return (
    <main className={`record-shell ${styles.pageStack}`}>
      <div className="record-header">
        <div className="record-header-main">
          <div className="record-kicker">Admin / Item Pricing Setup</div>
          <h1 className="record-title">{row.code}</h1>
          <p className="record-subtitle">{row.name}</p>
          <div className="record-badge-row">
            <span className={statusClass(row.status)}>{row.status}</span>
            {row.isDefault ? <span className="record-pill record-pill-info">Default</span> : null}
            {row.lastValidationStatus ? (
              <span className={statusClass(row.lastValidationStatus)}>
                Validation: {row.lastValidationStatus}
              </span>
            ) : (
              <span className="record-pill record-pill-neutral">Not validated</span>
            )}
          </div>
        </div>

        <div className="record-actions">
          <Link href="/admin/item-pricing/price-books" className="btn btn-secondary">Back</Link>
          <Link href={`/admin/item-pricing/calculate?priceBookId=${encodeURIComponent(row.id)}`} className="btn btn-secondary">Preview</Link>
          <button type="button" className="btn btn-secondary" disabled={actionLoading} onClick={runValidation}>Run Validation</button>
          {row.status === "DRAFT" ? (
            <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={() => updateStatus("REVIEW")}>Send to Review</button>
          ) : null}
          {row.status !== "PUBLISHED" ? (
            <button type="button" className="btn btn-primary" disabled={actionLoading || !canPublish} title={!canPublish ? "Run validation with no errors before publishing." : undefined} onClick={() => updateStatus("PUBLISHED")}>Publish</button>
          ) : null}
          {row.status !== "ARCHIVED" ? (
            <button type="button" className="btn btn-secondary" disabled={actionLoading} onClick={() => updateStatus("ARCHIVED")}>Archive</button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="record-content">
        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Price Book Details</h2>
          </div>
          <div className="record-meta-grid">
            <MetaItem label="Code" value={row.code} />
            <MetaItem label="Name" value={row.name} />
            <MetaItem label="Status" value={row.status} />
            <MetaItem label="Items with Base Prices" value={row.itemCount ?? 0} />
            <MetaItem label="Effective Date" value={row.effectiveDate || "—"} />
            <MetaItem label="Expiration Date" value={row.expirationDate || "—"} />
            <MetaItem label="Last Validated" value={fmtDateTime(row.lastValidatedAt)} />
            <MetaItem label="Validation Issues" value={`${row.lastValidationErrorCount || 0} error(s), ${row.lastValidationWarningCount || 0} warning(s)`} />
            <MetaItem label="Published" value={row.publishedAt ? `${fmtDateTime(row.publishedAt)} by ${row.publishedBy || "—"}` : "—"} />
            <MetaItem label="Updated" value={`${fmtDateTime(row.updatedAt)} by ${row.updatedBy || "—"}`} />
          </div>
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Duplicate Price Book</h2>
          </div>
          {!duplicateOpen ? (
            <button type="button" className="btn btn-secondary" onClick={() => setDuplicateOpen(true)}>Create Draft Copy</button>
          ) : (
            <form onSubmit={duplicatePriceBook} className={styles.formGrid}>
              <label>New Code<input className="input" value={duplicateForm.code} onChange={(e) => setDuplicateForm((p) => ({ ...p, code: e.target.value }))} placeholder="2027_WORKING" /></label>
              <label>New Name<input className="input" value={duplicateForm.name} onChange={(e) => setDuplicateForm((p) => ({ ...p, name: e.target.value }))} placeholder="2027 Working Price Book" /></label>
              <label>Effective Date<input className="input" type="date" value={duplicateForm.effectiveDate} onChange={(e) => setDuplicateForm((p) => ({ ...p, effectiveDate: e.target.value }))} /></label>
              <div className={styles.formActions}>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>Duplicate</button>
                <button type="button" className="btn btn-secondary" onClick={() => setDuplicateOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Recent Validation Runs</h2>
            <Link href={`/admin/item-pricing/validation?priceBookId=${encodeURIComponent(row.id)}`} className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {validationRuns.length === 0 ? (
            <div className="muted-box">No validation runs yet.</div>
          ) : (
            <div className={styles.tableScroll}>
              <table className="data-table">
                <thead><tr><th>Status</th><th>Errors</th><th>Warnings</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {validationRuns.map((run) => (
                    <tr key={run.id}>
                      <td><span className={statusClass(run.status)}>{run.status}</span></td>
                      <td>{run.errorCount}</td>
                      <td>{run.warningCount}</td>
                      <td>{fmtDateTime(run.createdAt)}</td>
                      <td><Link className="btn btn-secondary btn-sm" href={`/admin/item-pricing/validation/${encodeURIComponent(run.id)}`}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="record-section-card">
          <div className="record-section-header"><h2 className="record-section-title">Pricing Source Files</h2></div>
          <AttachmentsPanel
            entityType={ITEM_PRICING_ENTITY_TYPES.priceBook}
            entityId={row.id}
            attachmentCategory={ITEM_PRICING_ATTACHMENT_CATEGORIES.sourceWorkbook}
            emptyMessage="No source workbooks attached yet."
            dialogTitle="Pricing Source Workbook"
          />
        </section>

        <section className="record-section-card">
          <div className="record-section-header"><h2 className="record-section-title">Guidelines / Approval Files</h2></div>
          <AttachmentsPanel
            entityType={ITEM_PRICING_ENTITY_TYPES.priceBook}
            entityId={row.id}
            attachmentCategory={ITEM_PRICING_ATTACHMENT_CATEGORIES.approval}
            emptyMessage="No approval or guideline files attached yet."
            dialogTitle="Pricing Approval / Guideline File"
          />
        </section>

        <section className="record-section-card">
          <CommentsPanel entityType={ITEM_PRICING_ENTITY_TYPES.priceBook} entityId={row.id} />
        </section>

        <section className="record-section-card">
          <ActivityHistoryPanel entityType={ITEM_PRICING_ENTITY_TYPES.priceBook} entityId={row.id} defaultExpanded={false} />
        </section>
      </div>
    </main>
  );
}
