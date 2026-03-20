"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CommentsPanel from "@/components/platform/CommentsPanel";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";

type MeResponse = {
  role?: string | null;
  error?: string;
};

type KnitProductionSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase?: string | null;
  salesOrderDisplay?: string | null;
  knitArea: string | null;
  notes: string | null;
  isVoided?: boolean | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type KnitProductionLine = {
  id: string;
  submissionId?: string | null;
  detailNumber: number | null;
  itemStyle: string | null;
  logo: string | null;
  quantity: number | null;
  notes: string | null;
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
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString();
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

function pillClassForBoolean(
  v: boolean | null | undefined,
  trueKind: "success" | "warning" | "danger" | "info" = "success"
) {
  if (v == null) return "record-pill record-pill-neutral";
  if (!v) return "record-pill record-pill-neutral";
  return `record-pill record-pill-${trueKind}`;
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
          `/api/platform/activity-history?entityType=${encodeURIComponent("knit_production_submissions")}&entityId=${encodeURIComponent(entityId)}`,
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
  stockOrder,
  salesOrder,
  lineCount,
  isVoided,
  canVoid,
  voiding,
  onVoid,
}: {
  id: string;
  stockOrder: boolean;
  salesOrder: string | null;
  lineCount: number;
  isVoided: boolean | null | undefined;
  canVoid: boolean;
  voiding: boolean;
  onVoid: () => void;
}) {
  return (
    <aside className="record-sidebar">
      <div className="record-sidebar-card">
        <div className="record-sidebar-head">
          <div className="record-kicker">Knit Production</div>
          <div className="record-id">#{id}</div>

          <div className="record-badge-row">
            <span className={pillClassForBoolean(stockOrder, "info")}>
              {stockOrder ? "Stock Order" : "Sales Order"}
            </span>
            <span className="record-pill record-pill-neutral">
              {salesOrder || "No SO"}
            </span>
            <span className="record-pill record-pill-neutral">
              {lineCount} {lineCount === 1 ? "Line" : "Lines"}
            </span>
            <span className={pillClassForBoolean(isVoided, "danger")}>
              {isVoided ? "Voided" : "Active"}
            </span>
          </div>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Navigate</div>
          <nav className="record-sidebar-nav">
            <a href="#details" className="record-sidebar-link">Details</a>
            <a href="#lines" className="record-sidebar-link">Line Details</a>
            <a href="#comments" className="record-sidebar-link">Comments</a>
            <a href="#attachments" className="record-sidebar-link">Attachments</a>
            <a href="#history" className="record-sidebar-link">Activity History</a>
          </nav>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Actions</div>
          <div className="record-sidebar-actions">
            <Link href="/knit-production" className="btn btn-secondary">
              Back to Knit Production
            </Link>

            {!isVoided ? (
              <Link href={`/knit-production/${id}/edit`} className="btn btn-primary">
                Edit Submission
              </Link>
            ) : null}

            {canVoid && !isVoided ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={onVoid}
                disabled={voiding}
              >
                {voiding ? "Voiding..." : "Void Entry"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function KnitProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<KnitProductionSubmission | null>(null);
  const [lines, setLines] = useState<KnitProductionLine[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [submissionRes, meRes] = await Promise.all([
          fetch(
            `/api/knit-production-submission?id=${encodeURIComponent(id)}&includeVoided=true`,
            { cache: "no-store", credentials: "include" }
          ),
          fetch("/api/me", { cache: "no-store", credentials: "include" }),
        ]);

        const data = await submissionRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({}));

        if (!submissionRes.ok) {
          throw new Error((data as any)?.error || "Failed to load knit production submission");
        }

        if (!alive) return;
        setSubmission((data as any)?.submission ?? null);
        setLines(Array.isArray((data as any)?.lines) ? (data as any).lines : []);
        setMe(meRes.ok ? (meData as MeResponse) : null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load knit production submission");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const title = useMemo(() => {
    if (!submission) return `Knit Production Submission #${id}`;
    return submission.salesOrder
      ? `Knit Production • SO ${submission.salesOrder}`
      : `Knit Production Submission #${id}`;
  }, [id, submission]);

  const role = String(me?.role ?? "").trim().toUpperCase();
  const canVoid = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";

  async function handleVoid() {
    if (!submission?.id || voiding) return;

    const reason = window.prompt(
      "Enter a reason for voiding this knit production submission (optional):",
      ""
    ) ?? "";

    const confirmed = window.confirm(
      "Void this knit production submission?\n\nIt will be hidden from standard lists, search, dashboards, and reports, but kept in the database."
    );

    if (!confirmed) return;

    setVoiding(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/knit-production-submission/${encodeURIComponent(submission.id)}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reason }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((data as any)?.error || "Failed to void knit production submission.");
        return;
      }

      router.push("/knit-production");
      router.refresh();
    } catch {
      setError("Failed to void knit production submission.");
    } finally {
      setVoiding(false);
    }
  }

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
            <h1 className="record-title">Knit Production View</h1>
          </div>
        </div>

        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          {error}
        </div>

        <div className="record-actions">
          <Link href="/knit-production" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="record-shell">
        <div className="record-header">
          <div className="record-header-main">
            <h1 className="record-title">Knit Production View</h1>
          </div>
        </div>

        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          Not found.
        </div>

        <div className="record-actions">
          <Link href="/knit-production" className="btn btn-secondary">
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
          <Link href="/knit-production" className="btn btn-secondary">
            Back
          </Link>
          {!submission.isVoided ? (
            <Link href={`/knit-production/${id}/edit`} className="btn btn-primary">
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {submission.isVoided ? (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          This knit production submission has been voided.
          {submission.voidedAt ? ` Voided ${fmtTs(submission.voidedAt)}` : ""}
          {submission.voidedBy ? ` by ${submission.voidedBy}.` : "."}
          {submission.voidReason ? ` Reason: ${submission.voidReason}` : ""}
        </div>
      ) : null}

      <div className="record-layout">
        <SidebarNav
          id={id}
          stockOrder={!!submission.stockOrder}
          salesOrder={submission.salesOrder ?? submission.salesOrderDisplay ?? null}
          lineCount={lines.length}
          isVoided={submission.isVoided}
          canVoid={canVoid}
          voiding={voiding}
          onVoid={handleVoid}
        />

        <main className="record-content">
          <section id="details" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <h2 className="record-section-title">Submission Details</h2>
              </div>

              <div className="record-meta-grid">
                <Info label="Name" value={submission.name} />
                <Info label="Employee #" value={submission.employeeNumber} />
                <Info label="Entry Timestamp" value={fmtTs(submission.entryTs)} />
                <Info label="Entry Date" value={fmtDate(submission.entryDate)} />
                <Info label="Shift" value={submission.shift ?? ""} />
                <Info label="Stock Order" value={yesNo(submission.stockOrder)} />
                <Info label="Sales Order" value={submission.salesOrder ?? submission.salesOrderDisplay ?? ""} />
                <Info label="Sales Order Base" value={submission.salesOrderBase ?? ""} />
                <Info label="Knit Area" value={submission.knitArea ?? ""} />
                <Info label="Voided" value={yesNo(submission.isVoided)} />
                <Info label="Void Reason" value={submission.voidReason ?? ""} multiline />
                <Info label="Created At" value={fmtTs(submission.createdAt)} />
                <Info label="Updated At" value={fmtTs(submission.updatedAt)} />
                <Info label="Header Notes" value={submission.notes ?? ""} multiline />
              </div>
            </div>
          </section>

          <section id="lines" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <div className="record-badge-row">
                  <h2 className="record-section-title">Line Details</h2>
                  <span className="record-count-badge">{lines.length}</span>
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="text-muted">No line details found.</div>
              ) : (
                <div className="table-card">
                  <div className="table-scroll">
                    <table className="table-clean">
                      <thead>
                        <tr>
                          <th>Detail #</th>
                          <th>Item Style</th>
                          <th>Logo</th>
                          <th>Quantity</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id}>
                            <td>{line.detailNumber ?? ""}</td>
                            <td>{line.itemStyle ?? ""}</td>
                            <td>{line.logo ?? ""}</td>
                            <td>{line.quantity ?? ""}</td>
                            <td style={{ whiteSpace: "pre-wrap" }}>{line.notes ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="comments" className="record-section">
            <CommentsPanel
              entityType="knit_production_submissions"
              entityId={String(submission.id)}
              title="Comments"
            />
          </section>

          <section id="attachments" className="record-section">
            <AttachmentsPanel
              entityType="knit_production_submissions"
              entityId={String(submission.id)}
            />
          </section>

          <section id="history" className="record-section">
            <ActivityHistorySection entityId={String(submission.id)} />
          </section>
        </main>
      </div>
    </div>
  );
}