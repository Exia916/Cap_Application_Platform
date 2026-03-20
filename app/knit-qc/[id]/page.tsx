"use client";

// View page for a Knit QC submission. This page provides a unified
// record view similar to knit production: submission details, line
// details, comments, attachments and activity history. Actions such
// as editing and voiding are exposed for managers and higher roles.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import CommentsPanel from "@/components/platform/CommentsPanel";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";

type MeResponse = {
  role?: string | null;
  error?: string;
};

type KnitQcSubmission = {
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
  notes: string | null;
  isVoided?: boolean | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type KnitQcLine = {
  id: string;
  submissionId?: string | null;
  detailNumber: number | null;
  logo: string | null;
  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  rejectReasonId: string | null;
  qcEmployeeNumber: number | null;
  notes: string | null;
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
          <div className="record-kicker">Knit QC</div>
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
            <a href="#details" className="record-sidebar-link">
              Details
            </a>
            <a href="#lines" className="record-sidebar-link">
              Line Details
            </a>
            <a href="#comments" className="record-sidebar-link">
              Comments
            </a>
            <a href="#attachments" className="record-sidebar-link">
              Attachments
            </a>
            <a href="#history" className="record-sidebar-link">
              Activity History
            </a>
          </nav>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Actions</div>
          <div className="record-sidebar-actions">
            <Link href="/knit-qc" className="btn btn-secondary">
              Back to Knit QC
            </Link>
            {!isVoided ? (
              <Link href={`/knit-qc/${id}/edit`} className="btn btn-primary">
                Edit Submission
              </Link>
            ) : null}
            {canVoid && !isVoided ? (
              <button
                type="button"
                onClick={onVoid}
                disabled={voiding}
                className="btn btn-danger"
              >
                {voiding ? "Voiding…" : "Void Submission"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function ViewKnitQcPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<KnitQcSubmission | null>(null);
  const [lines, setLines] = useState<KnitQcLine[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reasons, setReasons] = useState<{ id: string; label: string }[]>([]);
  const [employees, setEmployees] = useState<
    { employeeNumber: number | null; displayName: string | null }[]
  >([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const resReasons = await fetch("/api/knit-qc-reject-reasons", {
          cache: "no-store",
          credentials: "include",
        });
        const dataReasons = await resReasons.json().catch(() => ({}));
        if (alive && resReasons.ok && Array.isArray((dataReasons as any)?.reasons)) {
          setReasons((dataReasons as any).reasons as any);
        }

        const resUsers = await fetch("/api/knit-qc-users", {
          cache: "no-store",
          credentials: "include",
        });
        const dataUsers = await resUsers.json().catch(() => ({}));
        if (alive && resUsers.ok && Array.isArray((dataUsers as any)?.users)) {
          setEmployees((dataUsers as any).users as any);
        }
      } catch {
        // ignore lookup errors; fields will display ids instead
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [submissionRes, meRes] = await Promise.all([
          fetch(
            `/api/knit-qc-submission?id=${encodeURIComponent(id)}&includeVoided=true`,
            { cache: "no-store", credentials: "include" }
          ),
          fetch("/api/me", { cache: "no-store", credentials: "include" }),
        ]);

        const submissionData = await submissionRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({}));

        if (!submissionRes.ok) {
          throw new Error((submissionData as any)?.error || "Failed to load knit QC submission");
        }

        if (!alive) return;

        setSubmission((submissionData as any)?.submission ?? null);
        setLines(Array.isArray((submissionData as any)?.lines) ? (submissionData as any).lines : []);
        setMe(meRes.ok ? (meData as MeResponse) : null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load knit QC submission");
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
    if (!submission) return `Knit QC Submission #${id}`;
    return submission.salesOrder
      ? `Knit QC • SO ${submission.salesOrder}`
      : `Knit QC Submission #${id}`;
  }, [id, submission]);

  const role = String(me?.role ?? "").trim().toUpperCase();
  const canVoid = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";

  function getReasonLabel(reasonId: string | null): string {
    if (!reasonId) return "";
    const found = reasons.find((r) => String(r.id) === String(reasonId));
    return found ? found.label : String(reasonId);
  }

  function getEmployeeDisplay(num: number | null): string {
    if (num == null) return "";
    const found = employees.find((e) => e.employeeNumber === num);
    if (found) {
      const name = (found.displayName || "").trim();
      return name ? `${name} (#${found.employeeNumber})` : `#${found.employeeNumber}`;
    }
    return `#${num}`;
  }

  async function handleVoid() {
    if (!submission?.id || voiding) return;

    const reason =
      window.prompt(
        "Enter a reason for voiding this knit QC submission (optional):",
        ""
      ) ?? "";

    const confirmed = window.confirm(
      "Void this knit QC submission?\n\nIt will be hidden from standard lists, search, dashboards, and reports, but kept in the database."
    );
    if (!confirmed) return;

    setVoiding(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/knit-qc-submission/${encodeURIComponent(submission.id)}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reason }),
        }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((data as any)?.error || "Failed to void knit QC submission.");
        return;
      }

      router.push("/knit-qc");
      router.refresh();
    } catch {
      setError("Failed to void knit QC submission.");
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
            <h1 className="record-title">Knit QC View</h1>
          </div>
        </div>
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          {error}
        </div>
        <div className="record-actions">
          <Link href="/knit-qc" className="btn btn-secondary">
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
            <h1 className="record-title">Knit QC View</h1>
          </div>
        </div>
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          Not found.
        </div>
        <div className="record-actions">
          <Link href="/knit-qc" className="btn btn-secondary">
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
          <Link href="/knit-qc" className="btn btn-secondary">
            Back
          </Link>
          {!submission.isVoided ? (
            <Link href={`/knit-qc/${id}/edit`} className="btn btn-primary">
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {submission.isVoided ? (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          This knit QC submission has been voided.
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
                <Info
                  label="Sales Order"
                  value={submission.salesOrder ?? submission.salesOrderDisplay ?? ""}
                />
                <Info label="Sales Order Base" value={submission.salesOrderBase ?? ""} />
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
                          <th>Logo</th>
                          <th>Order Qty</th>
                          <th>Inspected Qty</th>
                          <th>Rejected Qty</th>
                          <th>Reject Reason</th>
                          <th>QC Employee</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id}>
                            <td>{line.detailNumber ?? ""}</td>
                            <td>{line.logo ?? ""}</td>
                            <td>{line.orderQuantity ?? ""}</td>
                            <td>{line.inspectedQuantity ?? ""}</td>
                            <td>{line.rejectedQuantity ?? ""}</td>
                            <td>{getReasonLabel(line.rejectReasonId ?? "")}</td>
                            <td>{getEmployeeDisplay(line.qcEmployeeNumber ?? null)}</td>
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
              entityType="knit_qc_submissions"
              entityId={String(submission.id)}
              title="Comments"
            />
          </section>

          <section id="attachments" className="record-section">
            <AttachmentsPanel
              entityType="knit_qc_submissions"
              entityId={String(submission.id)}
            />
          </section>

          <section id="history" className="record-section">
            <ActivityHistoryPanel
              entityType="knit_qc_submissions"
              entityId={String(submission.id)}
              title="Activity History"
              defaultExpanded={false}
            />
          </section>
        </main>
      </div>
    </div>
  );
}