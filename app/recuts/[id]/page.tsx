"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CommentsPanel from "@/components/platform/CommentsPanel";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";

type RecutRow = {
  id: string;
  recutId: number | null;
  requestedAt: string | null;
  requestedDate: string | null;
  requestedTime?: string | null;
  requestedByUserId?: string | null;
  requestedByUsername?: string | null;
  requestedByName: string | null;
  requestedByEmployeeNumber: number | null;
  requestedDepartment: string | null;
  salesOrder: string | null;
  salesOrderBase?: string | null;
  salesOrderDisplay?: string | null;
  detailNumber: number | null;
  designName: string | null;
  recutReason: string | null;
  capStyle: string | null;
  pieces: number | null;
  operator: string | null;
  deliverTo: string | null;
  supervisorApproved: boolean | null;
  supervisorApprovedAt?: string | null;
  supervisorApprovedBy?: string | null;
  warehousePrinted: boolean | null;
  warehousePrintedAt?: string | null;
  warehousePrintedBy?: string | null;
  event: boolean | null;
  doNotPull: boolean | null;
  doNotPullAt?: string | null;
  doNotPullBy?: string | null;
  notes: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ActivityHistoryRow = {
  id: number;
  entityType: string;
  entityId: string;
  eventType: string;
  fieldName: string | null;
  previousValue: unknown | null;
  newValue: unknown | null;
  message: string | null;
  module: string | null;
  userId: string | null;
  userName: string | null;
  employeeNumber: number | null;
  salesOrder: number | null;
  detailNumber: number | null;
  createdAt: string;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function fmtDate(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 8);
}

function fmtValue(v: unknown) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function yesNo(v: boolean | null | undefined) {
  if (v == null) return "";
  return v ? "Yes" : "No";
}

function pillClassForBoolean(v: boolean | null | undefined, trueKind: "success" | "warning" | "danger" | "info" = "success") {
  if (v == null) return "record-pill record-pill-neutral";
  if (!v) return "record-pill record-pill-neutral";
  return `record-pill record-pill-${trueKind}`;
}

function ActivityHistorySection({ entityId }: { entityId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityHistoryRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/platform/activity-history?entityType=${encodeURIComponent("recut_requests")}&entityId=${encodeURIComponent(entityId)}`,
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any)?.error || "Failed to load activity history");
        }

        if (!alive) return;
        setRows(Array.isArray((data as any)?.rows) ? (data as any).rows : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load activity history");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [entityId]);

  return (
    <div className="record-section-card">
      <div className="record-section-header">
        <div className="record-badge-row">
          <h2 className="record-section-title">Activity History</h2>
          {!loading && !error ? <span className="record-count-badge">{rows.length}</span> : null}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {!expanded ? (
        <div className="record-collapsible-summary">
          {loading
            ? "Loading activity history…"
            : error
              ? "Unable to load activity history."
              : rows.length === 0
                ? "No activity history yet."
                : "Expand to view activity history."}
        </div>
      ) : null}

      {expanded ? (
        <div className="record-history-list">
          {loading ? <div className="text-muted">Loading activity history…</div> : null}
          {!loading && error ? <div className="alert alert-danger">{error}</div> : null}
          {!loading && !error && rows.length === 0 ? (
            <div className="text-muted">No activity history yet.</div>
          ) : null}

          {!loading && !error && rows.length > 0
            ? rows.map((row) => (
                <div key={row.id} className="record-history-item">
                  <div className="record-history-head">
                    <div>
                      <div className="record-history-title">{row.message || row.eventType}</div>
                      <div className="record-history-meta">
                        <span><strong>By:</strong> {row.userName || row.userId || "System"}</span>
                        <span><strong>When:</strong> {fmtTs(row.createdAt)}</span>
                        <span><strong>Event:</strong> {row.eventType}</span>
                        {row.fieldName ? <span><strong>Field:</strong> {row.fieldName}</span> : null}
                      </div>
                    </div>
                  </div>

                  {row.previousValue != null || row.newValue != null ? (
                    <div className="record-history-change-grid">
                      {row.previousValue != null ? (
                        <div className="record-history-change-box">
                          <div className="record-history-change-label">Previous</div>
                          <div className="record-history-change-value">{fmtValue(row.previousValue)}</div>
                        </div>
                      ) : null}

                      {row.newValue != null ? (
                        <div className="record-history-change-box">
                          <div className="record-history-change-label">New</div>
                          <div className="record-history-change-value">{fmtValue(row.newValue)}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

function SidebarNav({
  id,
  recutId,
  supervisorApproved,
  warehousePrinted,
  doNotPull,
}: {
  id: string;
  recutId: number | null;
  supervisorApproved: boolean | null;
  warehousePrinted: boolean | null;
  doNotPull: boolean | null;
}) {
  return (
    <aside className="record-sidebar">
      <div className="record-sidebar-card">
        <div className="record-sidebar-head">
          <div className="record-kicker">Recut Request</div>
          <div className="record-id">#{recutId ?? id}</div>

          <div className="record-badge-row">
            <span className={pillClassForBoolean(supervisorApproved, "success")}>
              Supervisor {supervisorApproved ? "Approved" : "Pending"}
            </span>
            <span className={pillClassForBoolean(warehousePrinted, "info")}>
              Warehouse {warehousePrinted ? "Printed" : "Not Printed"}
            </span>
            <span className={pillClassForBoolean(doNotPull, "danger")}>
              {doNotPull ? "Do Not Pull" : "Pull Allowed"}
            </span>
          </div>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Navigate</div>
          <nav className="record-sidebar-nav">
            <a href="#details" className="record-sidebar-link">Details</a>
            <a href="#workflow" className="record-sidebar-link">Workflow</a>
            <a href="#comments" className="record-sidebar-link">Comments</a>
            <a href="#attachments" className="record-sidebar-link">Attachments</a>
            <a href="#history" className="record-sidebar-link">Activity History</a>
          </nav>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Actions</div>
          <div className="record-sidebar-actions">
            <Link href="/recuts" className="btn btn-secondary">
              Back to Recuts
            </Link>
            <Link href={`/recuts/${id}/edit`} className="btn btn-primary">
              Edit Request
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Info({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "record-meta-item record-meta-item-full" : "record-meta-item"}>
      <div className="record-meta-label">{label}</div>
      <div className={`record-meta-value${multiline ? " record-meta-value-pre" : ""}`}>
        {value ?? ""}
      </div>
    </div>
  );
}

export default function RecutViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<RecutRow | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/recuts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any)?.error || "Failed to load recut request");
        }

        if (!alive) return;
        setRow((data as any)?.entry ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load recut request");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const title = useMemo(() => `Recut Request #${row?.recutId ?? id}`, [id, row?.recutId]);

  if (loading) {
    return (
      <div className="record-shell">
        <div className="text-muted">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="record-shell">
        <div className="record-header">
          <div className="record-header-main">
            <h1 className="record-title">Recut Request View</h1>
          </div>
        </div>

        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          {error}
        </div>

        <div className="record-actions">
          <Link href="/recuts" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="record-shell">
        <div className="record-header">
          <div className="record-header-main">
            <h1 className="record-title">Recut Request View</h1>
          </div>
        </div>

        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          Not found.
        </div>

        <div className="record-actions">
          <Link href="/recuts" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="record-shell">
      <div className="record-header">
        <div className="record-header-main">
          <h1 className="record-title">{title}</h1>
          <p className="record-subtitle">
            Unified record view for details, collaboration, files, and audit history.
          </p>
        </div>

        <div className="record-actions">
          <Link href="/recuts" className="btn btn-secondary">
            Back
          </Link>
          <Link href={`/recuts/${id}/edit`} className="btn btn-primary">
            Edit
          </Link>
        </div>
      </div>

      <div className="record-layout">
        <SidebarNav
          id={id}
          recutId={row.recutId}
          supervisorApproved={row.supervisorApproved}
          warehousePrinted={row.warehousePrinted}
          doNotPull={row.doNotPull}
        />

        <main className="record-content">
          <section id="details" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <h2 className="record-section-title">Request Details</h2>
              </div>

              <div className="record-meta-grid">
                <Info label="Requested At" value={fmtTs(row.requestedAt)} />
                <Info label="Requested Date" value={fmtDate(row.requestedDate)} />
                <Info label="Requested Time" value={fmtTime(row.requestedTime)} />
                <Info label="Requested By" value={row.requestedByName} />
                <Info label="Employee #" value={row.requestedByEmployeeNumber} />
                <Info label="Department" value={row.requestedDepartment} />
                <Info label="Sales Order" value={row.salesOrder} />
                <Info label="Detail #" value={row.detailNumber} />
                <Info label="Design Name" value={row.designName} />
                <Info label="Recut Reason" value={row.recutReason} />
                <Info label="Cap Style" value={row.capStyle} />
                <Info label="Pieces" value={row.pieces} />
                <Info label="Operator" value={row.operator} />
                <Info label="Deliver To" value={row.deliverTo} />
                <Info label="Event" value={yesNo(row.event)} />
                <Info label="Do Not Pull" value={yesNo(row.doNotPull)} />
                <Info label="Notes" value={row.notes} multiline />
              </div>
            </div>
          </section>

          <section id="workflow" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <h2 className="record-section-title">Workflow Status</h2>
              </div>

              <div className="record-summary-list">
                <div className="record-summary-row">
                  <div className="record-summary-label">Supervisor Approval</div>
                  <div className="record-badge-row">
                    <span className={pillClassForBoolean(row.supervisorApproved, "success")}>
                      {row.supervisorApproved ? "Approved" : "Pending"}
                    </span>
                    {row.supervisorApprovedAt ? (
                      <span className="record-summary-value">
                        {fmtTs(row.supervisorApprovedAt)}
                        {row.supervisorApprovedBy ? ` • ${row.supervisorApprovedBy}` : ""}
                      </span>
                    ) : (
                      <span className="record-summary-value">Not yet approved</span>
                    )}
                  </div>
                </div>

                <div className="record-summary-row">
                  <div className="record-summary-label">Warehouse Printed</div>
                  <div className="record-badge-row">
                    <span className={pillClassForBoolean(row.warehousePrinted, "info")}>
                      {row.warehousePrinted ? "Printed" : "Not Printed"}
                    </span>
                    {row.warehousePrintedAt ? (
                      <span className="record-summary-value">
                        {fmtTs(row.warehousePrintedAt)}
                        {row.warehousePrintedBy ? ` • ${row.warehousePrintedBy}` : ""}
                      </span>
                    ) : (
                      <span className="record-summary-value">Not yet printed</span>
                    )}
                  </div>
                </div>

                <div className="record-summary-row">
                  <div className="record-summary-label">Pull Status</div>
                  <div className="record-badge-row">
                    <span className={pillClassForBoolean(row.doNotPull, "danger")}>
                      {row.doNotPull ? "Do Not Pull" : "Pull Allowed"}
                    </span>
                    {row.doNotPullAt ? (
                      <span className="record-summary-value">
                        {fmtTs(row.doNotPullAt)}
                        {row.doNotPullBy ? ` • ${row.doNotPullBy}` : ""}
                      </span>
                    ) : (
                      <span className="record-summary-value">
                        {row.doNotPull ? "Marked do not pull" : "No do-not-pull flag"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="comments" className="record-section">
            <CommentsPanel
              entityType="recut_requests"
              entityId={String(row.id)}
              title="Comments"
            />
          </section>

          <section id="attachments" className="record-section">
            <AttachmentsPanel
              entityType="recut_requests"
              entityId={String(row.id)}
            />
          </section>

          <section id="history" className="record-section">
            <ActivityHistorySection entityId={String(row.id)} />
          </section>
        </main>
      </div>
    </div>
  );
}