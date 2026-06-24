"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CommentsPanel from "@/components/platform/CommentsPanel";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";
import WorkSessionEditForm from "@/components/platform/WorkSessionEditForm";

type WorkSession = {
  id: string;
  moduleKey: string;
  areaCode: string;
  workDate: string;
  shiftDate: string | null;
  shift: string | null;
  userId: string | null;
  username: string | null;
  employeeNumber: number | null;
  operatorName: string;
  timeIn: string;
  timeOut: string | null;
  isOpen: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

type WorkSessionArea = {
  id: string;
  moduleKey: string;
  areaCode: string;
  areaLabel: string;
  sortOrder: number;
  isActive: boolean;
};

type RelatedSubmissionRow = {
  id: string;
  moduleKey: "knit_production" | "knit_qc";
  label: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: string | null;
  area: string | null;
  lineCount: number;
  totalQuantity: number | null;
  totalOrderQuantity: number | null;
  totalInspected: number | null;
  totalRejected: number | null;
  notes: string | null;
  href: string;
};

type LegacyRelatedKnitSubmissionRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  knitArea: string | null;
  sessionId: string | null;
  notes: string | null;
  isVoided: boolean;
  lineCount: number;
  totalQuantity: number;
};

type MeResponse = {
  role?: string | null;
};

type ApiResp = {
  session?: WorkSession;
  areas?: WorkSessionArea[];
  relatedSubmissions?: RelatedSubmissionRow[];
  knitSubmissions?: LegacyRelatedKnitSubmissionRow[];
  canManage?: boolean;
  error?: string;
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
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

function durationText(timeIn?: string | null, timeOut?: string | null) {
  if (!timeIn) return "";
  const start = new Date(timeIn);
  const end = timeOut ? new Date(timeOut) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return "";
  }

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function yesNo(v: unknown) {
  return v ? "Yes" : "No";
}

function moduleLabel(moduleKey?: string | null) {
  switch (String(moduleKey ?? "")) {
    case "knit_production":
      return "Knit Production";
    case "knit_qc":
      return "Knit QC";
    default:
      return String(moduleKey ?? "");
  }
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
    <div className="record-meta-item">
      <div className="record-meta-label">{label}</div>
      <div
        className="record-meta-value"
        style={multiline ? { whiteSpace: "pre-wrap" } : undefined}
      >
        {value || ""}
      </div>
    </div>
  );
}

function SidebarNav({
  session,
  relatedCount,
  canManage,
}: {
  session: WorkSession;
  relatedCount: number;
  canManage: boolean;
}) {
  return (
    <aside className="record-sidebar">
      <div className="record-sidebar-card">
        <div className="record-sidebar-head">
          <div className="record-kicker">Work Session</div>
          <div className="record-id">#{session.id}</div>

          <div className="record-badge-row">
            <span className={session.isOpen ? "badge badge-success" : "badge badge-neutral"}>
              {session.isOpen ? "Open" : "Closed"}
            </span>
            <span className="badge badge-neutral">{moduleLabel(session.moduleKey)}</span>
            <span className="badge badge-neutral">{session.areaCode}</span>
            <span className="badge badge-neutral">
              {relatedCount} Related {relatedCount === 1 ? "Record" : "Records"}
            </span>
          </div>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Navigate</div>
          <nav className="record-sidebar-nav">
            <a href="#details" className="record-sidebar-link">Details</a>
            <a href="#edit" className="record-sidebar-link">Edit Session</a>
            <a href="#related" className="record-sidebar-link">Related Records</a>
            <a href="#comments" className="record-sidebar-link">Comments</a>
            <a href="#attachments" className="record-sidebar-link">Attachments</a>
            <a href="#history" className="record-sidebar-link">Activity History</a>
          </nav>
        </div>

        <div className="record-sidebar-section">
          <div className="record-sidebar-section-title">Actions</div>
          <div className="record-sidebar-actions">
            <Link href="/platform/work-sessions" className="btn btn-secondary">
              Back to Work Sessions
            </Link>
            {canManage ? (
              <a href="#edit" className="btn btn-primary">
                Edit Session
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function WorkSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [areas, setAreas] = useState<WorkSessionArea[]>([]);
  const [relatedSubmissions, setRelatedSubmissions] = useState<RelatedSubmissionRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [sessionRes, meRes] = await Promise.all([
          fetch(`/api/platform/work-sessions/${encodeURIComponent(id)}?includeVoided=true`, {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/me", { cache: "no-store", credentials: "include" }),
        ]);

        const data = (await sessionRes.json().catch(() => ({}))) as ApiResp;
        const meData = await meRes.json().catch(() => ({}));

        if (!alive) return;

        if (!sessionRes.ok || !data.session) {
          throw new Error(data?.error || "Failed to load work session.");
        }

        const relatedRows = Array.isArray(data.relatedSubmissions)
          ? data.relatedSubmissions
          : Array.isArray(data.knitSubmissions)
            ? data.knitSubmissions.map((row) => ({
                id: String(row.id),
                moduleKey: "knit_production" as const,
                label: "Knit Production",
                entryTs: row.entryTs,
                entryDate: row.entryDate,
                name: row.name,
                employeeNumber: row.employeeNumber,
                salesOrder: row.salesOrder ?? row.salesOrderDisplay ?? null,
                area: row.knitArea ?? null,
                lineCount: Number(row.lineCount ?? 0),
                totalQuantity: Number(row.totalQuantity ?? 0),
                totalOrderQuantity: null,
                totalInspected: null,
                totalRejected: null,
                notes: row.notes ?? null,
                href: `/knit-production/${row.id}`,
              }))
            : [];

        setSession(data.session);
        setAreas(Array.isArray(data.areas) ? data.areas : []);
        setRelatedSubmissions(relatedRows);
        setCanManage(!!data.canManage);
        setMe(meData);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "Failed to load work session.");
        setSession(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const areaLabel = useMemo(() => {
    if (!session) return "";
    return areas.find((a) => a.areaCode === session.areaCode)?.areaLabel || session.areaCode;
  }, [areas, session]);

  if (loading) {
    return (
      <div className="record-shell">
        <div className="card">
          <div className="text-muted">Loading work session…</div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="record-shell">
        <div className="record-header">
          <div className="record-header-main">
            <h1 className="record-title">Work Session</h1>
            <p className="record-subtitle">Unable to load session details.</p>
          </div>

          <div className="record-actions">
            <Link href="/platform/work-sessions" className="btn btn-secondary">
              Back
            </Link>
          </div>
        </div>

        <div className="alert alert-danger">{error || "Work session not found."}</div>
      </div>
    );
  }

  return (
    <div className="record-shell">
      <div className="record-header">
        <div className="record-header-main">
          <h1 className="record-title">Work Session</h1>
          <p className="record-subtitle">
            Unified session view for details, related production/QC records, collaboration, files, and audit history.
          </p>
        </div>

        <div className="record-actions">
          <Link href="/platform/work-sessions" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </div>

      {session.isVoided ? (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          This work session has been voided.
          {session.voidedAt ? ` Voided ${fmtTs(session.voidedAt)}` : ""}
          {session.voidedBy ? ` by ${session.voidedBy}.` : "."}
          {session.voidReason ? ` Reason: ${session.voidReason}` : ""}
        </div>
      ) : null}

      <div className="record-layout">
        <SidebarNav
          session={session}
          relatedCount={relatedSubmissions.length}
          canManage={canManage}
        />

        <main className="record-content">
          <section id="details" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <h2 className="record-section-title">Session Details</h2>
              </div>

              <div className="record-meta-grid">
                <Info label="Module" value={moduleLabel(session.moduleKey)} />
                <Info label="Module Key" value={session.moduleKey} />
                <Info label="Area" value={areaLabel} />
                <Info label="Operator" value={session.operatorName} />
                <Info label="Employee #" value={session.employeeNumber} />
                <Info label="Username" value={session.username ?? ""} />
                <Info label="Work Date" value={fmtDate(session.workDate)} />
                <Info label="Shift Date" value={fmtDate(session.shiftDate)} />
                <Info label="Shift" value={session.shift ?? ""} />
                <Info label="Time In" value={fmtTs(session.timeIn)} />
                <Info label="Time Out" value={fmtTs(session.timeOut)} />
                <Info label="Duration" value={durationText(session.timeIn, session.timeOut)} />
                <Info label="Open" value={yesNo(session.isOpen)} />
                <Info label="Voided" value={yesNo(session.isVoided)} />
                <Info label="Created At" value={fmtTs(session.createdAt)} />
                <Info label="Created By" value={session.createdBy ?? ""} />
                <Info label="Updated At" value={fmtTs(session.updatedAt)} />
                <Info label="Updated By" value={session.updatedBy ?? ""} />
                <Info label="Notes" value={session.notes ?? ""} multiline />
              </div>
            </div>
          </section>

          <section id="edit" className="record-section">
            <WorkSessionEditForm
              session={session}
              areas={areas}
              canManage={canManage}
              onSaved={(next) => {
                setSession(next);
                router.refresh();
              }}
            />
          </section>

          <section id="related" className="record-section">
            <div className="record-section-card">
              <div className="record-section-header">
                <div className="record-badge-row">
                  <h2 className="record-section-title">Related Records</h2>
                  <span className="record-count-badge">{relatedSubmissions.length}</span>
                </div>
              </div>

              {relatedSubmissions.length === 0 ? (
                <div className="text-muted">No related records found for this session.</div>
              ) : (
                <div className="table-card">
                  <div className="table-scroll">
                    <table className="table-clean">
                      <thead>
                        <tr>
                          <th>Module</th>
                          <th>Entry Time</th>
                          <th>Sales Order</th>
                          <th>Area</th>
                          <th>Lines</th>
                          <th>Total Qty</th>
                          <th>Inspected</th>
                          <th>Rejected</th>
                          <th>Notes</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatedSubmissions.map((row) => (
                          <tr key={`${row.moduleKey}-${row.id}`}>
                            <td>{row.label}</td>
                            <td>{fmtTs(row.entryTs)}</td>
                            <td>{row.salesOrder ?? ""}</td>
                            <td>{row.area ?? ""}</td>
                            <td>{row.lineCount}</td>
                            <td>
                              {row.moduleKey === "knit_qc"
                                ? row.totalOrderQuantity ?? ""
                                : row.totalQuantity ?? ""}
                            </td>
                            <td>{row.totalInspected ?? ""}</td>
                            <td>{row.totalRejected ?? ""}</td>
                            <td style={{ whiteSpace: "pre-wrap" }}>{row.notes ?? ""}</td>
                            <td>
                              <Link href={row.href} className="btn btn-secondary btn-sm">
                                View
                              </Link>
                            </td>
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
              entityType="production_work_sessions"
              entityId={String(session.id)}
              title="Comments"
            />
          </section>

          <section id="attachments" className="record-section">
            <AttachmentsPanel
              entityType="production_work_sessions"
              entityId={String(session.id)}
            />
          </section>

          <section id="history" className="record-section">
            <ActivityHistoryPanel
              entityType="production_work_sessions"
              entityId={String(session.id)}
              title="Activity History"
              defaultExpanded={false}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
