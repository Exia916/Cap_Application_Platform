"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CommentsPanel from "@/components/platform/CommentsPanel";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";

type WorkOrderRow = {
  workOrderId: number | string;
  requestedAt: string | null;
  requestedByName: string | null;
  requestedByUserId: string | null;
  operatorInitials: string | null;
  issueDialogue: string | null;
  resolution: string | null;
  downTimeRecorded: string | null;
  department: string | null;
  asset: string | null;
  priority: string | null;
  commonIssue: string | null;
  workOrderType: string | null;
  tech: string | null;
  status: string | null;
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

function normStatus(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

function statusPillStyle(statusRaw: unknown): React.CSSProperties {
  const s = normStatus(statusRaw);

  let bg = "rgba(148, 163, 184, 0.25)";
  let border = "rgba(148, 163, 184, 0.55)";
  let fg = "rgb(51, 65, 85)";

  if (s === "resolved") {
    bg = "rgba(34, 197, 94, 0.18)";
    border = "rgba(34, 197, 94, 0.55)";
    fg = "rgb(20, 83, 45)";
  } else if (s === "open") {
    bg = "rgba(239, 68, 68, 0.18)";
    border = "rgba(239, 68, 68, 0.55)";
    fg = "rgb(127, 29, 29)";
  } else if (s === "parts on order") {
    bg = "rgba(249, 115, 22, 0.18)";
    border = "rgba(249, 115, 22, 0.55)";
    fg = "rgb(124, 45, 18)";
  } else if (s === "in process") {
    bg = "rgba(234, 179, 8, 0.20)";
    border = "rgba(234, 179, 8, 0.60)";
    fg = "rgb(113, 63, 18)";
  } else if (s === "waiting on tech support") {
    bg = "rgba(59, 130, 246, 0.18)";
    border = "rgba(59, 130, 246, 0.55)";
    fg = "rgb(30, 58, 138)";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color: fg,
    fontWeight: 700,
    fontSize: 12,
    lineHeight: "18px",
    whiteSpace: "nowrap",
  };
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
          `/api/platform/activity-history?entityType=${encodeURIComponent("cmms_work_order")}&entityId=${encodeURIComponent(entityId)}`,
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as any)?.error || "Failed to load activity history");

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
    <div style={card}>
      <div style={collapsibleHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Activity History</h2>
          {!loading && !error ? <span style={countBadge}>{rows.length}</span> : null}
        </div>

        <button
          type="button"
          style={toggleBtn}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {!expanded ? (
        <div style={collapsedText}>
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
        <div style={{ marginTop: 14 }}>
          {loading ? <div style={mutedText}>Loading activity history…</div> : null}
          {!loading && error ? <div style={errorBox}>{error}</div> : null}
          {!loading && !error && rows.length === 0 ? (
            <div style={mutedText}>No activity history yet.</div>
          ) : null}

          {!loading && !error && rows.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((row) => (
                <div key={row.id} style={historyItem}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>
                        {row.message || row.eventType}
                      </div>
                      <div style={historyMeta}>
                        <span><strong>By:</strong> {row.userName || row.userId || "System"}</span>
                        <span><strong>When:</strong> {fmtTs(row.createdAt)}</span>
                        <span><strong>Event:</strong> {row.eventType}</span>
                        {row.fieldName ? (
                          <span><strong>Field:</strong> {row.fieldName}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {row.previousValue != null || row.newValue != null ? (
                    <div style={historyChangeWrap}>
                      {row.previousValue != null ? (
                        <div style={historyChangeBox}>
                          <div style={historyChangeLabel}>Previous</div>
                          <div style={historyChangeValue}>{fmtValue(row.previousValue)}</div>
                        </div>
                      ) : null}

                      {row.newValue != null ? (
                        <div style={historyChangeBox}>
                          <div style={historyChangeLabel}>New</div>
                          <div style={historyChangeValue}>{fmtValue(row.newValue)}</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SidebarNav({
  workOrderId,
  status,
}: {
  workOrderId: string;
  status: string | null;
}) {
  return (
    <aside style={sidebarWrap}>
      <div style={sidebarCard}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={sidebarLabel}>Work Order</div>
          <div style={sidebarTitle}>#{workOrderId}</div>
          <div>
            <span style={statusPillStyle(status)}>{status || ""}</span>
          </div>
        </div>

        <div style={sidebarSection}>
          <div style={sidebarSectionTitle}>Navigate</div>
          <nav style={{ display: "grid", gap: 8 }}>
            <a href="#details" style={sidebarLink}>Details</a>
            <a href="#comments" style={sidebarLink}>Comments</a>
            <a href="#attachments" style={sidebarLink}>Attachments</a>
            <a href="#history" style={sidebarLink}>Activity History</a>
          </nav>
        </div>

        <div style={sidebarSection}>
          <div style={sidebarSectionTitle}>Actions</div>
          <div style={{ display: "grid", gap: 8 }}>
            <Link href="/cmms" style={btnSecondaryBlock}>
              Back to CMMS
            </Link>
            <Link href={`/cmms/${workOrderId}/edit`} style={btnPrimaryBlock}>
              Edit Work Order
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function CMMSWorkOrderViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<WorkOrderRow | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/cmms/work-orders/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load work order");

        if (!alive) return;
        setRow(data ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load work order");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const title = useMemo(() => `CMMS Work Order #${id}`, [id]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>{title}</h1>
        <div style={errorBox}>{error}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/cmms" style={btnSecondary}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>{title}</h1>
        <div style={errorBox}>Not found.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/cmms" style={btnSecondary}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShell}>
      <div style={pageHeader}>
        <div style={{ display: "grid", gap: 8 }}>
          <h1 style={{ margin: 0 }}>CMMS Work Order #{row.workOrderId}</h1>
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            Unified record view for details, collaboration, files, and audit history
          </div>
        </div>
      </div>

      <div style={layoutGrid}>
        <SidebarNav
          workOrderId={String(row.workOrderId)}
          status={row.status}
        />

        <main style={contentWrap}>
          <section id="details" style={sectionBlock}>
            <div style={card}>
              <div style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Work Order Details</h2>
              </div>

              <div style={grid}>
                <Info label="Requested At" value={fmtTs(row.requestedAt)} />
                <Info label="Requested By" value={row.requestedByName} />
                <Info label="Requested By User" value={row.requestedByUserId} />
                <Info label="Operator Name" value={row.operatorInitials} />
                <Info label="Department" value={row.department} />
                <Info label="Asset" value={row.asset} />
                <Info label="Priority" value={row.priority} />
                <Info label="Common Issue" value={row.commonIssue} />
                <Info
                  label="Status"
                  value={
                    row.status ? (
                      <span style={statusPillStyle(row.status)}>{row.status}</span>
                    ) : (
                      ""
                    )
                  }
                />
                <Info label="Tech" value={row.tech} />
                <Info label="Work Order Type" value={row.workOrderType} />
                <Info label="Down Time Recorded" value={row.downTimeRecorded} />

                <div style={{ gridColumn: "1 / -1" }}>
                  <Info label="Issue Dialogue" value={row.issueDialogue} multiline />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Info label="Resolution" value={row.resolution} multiline />
                </div>
              </div>
            </div>
          </section>

          <section id="comments" style={sectionBlock}>
            <CommentsPanel
              entityType="cmms_work_order"
              entityId={String(row.workOrderId)}
              title="Comments"
            />
          </section>

          <section id="attachments" style={sectionBlock}>
            <AttachmentsPanel
              entityType="cmms_work_order"
              entityId={String(row.workOrderId)}
              title="Attachments"
            />
          </section>

          <section id="history" style={sectionBlock}>
            <ActivityHistorySection entityId={String(row.workOrderId)} />
          </section>
        </main>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: any;
  multiline?: boolean;
}) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div
        style={{
          ...valueStyle,
          whiteSpace: multiline ? "pre-wrap" : "normal",
          wordBreak: "break-word",
          minHeight: multiline ? 24 : undefined,
        }}
      >
        {value ?? ""}
      </div>
    </div>
  );
}

const pageShell: React.CSSProperties = {
  padding: 16,
  maxWidth: 1400,
  margin: "0 auto",
};

const pageHeader: React.CSSProperties = {
  marginBottom: 16,
};

const layoutGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "280px minmax(0, 1fr)",
  gap: 20,
  alignItems: "start",
};

const sidebarWrap: React.CSSProperties = {
  position: "sticky",
  top: 16,
  alignSelf: "start",
};

const sidebarCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 18,
};

const sidebarLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const sidebarTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#111827",
};

const sidebarSection: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const sidebarSectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const sidebarLink: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
};

const contentWrap: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 16,
};

const sectionBlock: React.CSSProperties = {
  scrollMarginTop: 20,
};

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const collapsibleHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const countBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 28,
  height: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#111827",
  fontSize: 12,
  fontWeight: 800,
};

const toggleBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const collapsedText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  marginTop: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 4,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 13,
};

const btnPrimaryBlock: React.CSSProperties = {
  ...btnPrimary,
  width: "100%",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 13,
};

const btnSecondaryBlock: React.CSSProperties = {
  ...btnSecondary,
  width: "100%",
};

const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#b91c1c",
};

const mutedText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const historyItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fafafa",
  padding: 12,
};

const historyMeta: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  fontSize: 12,
  color: "#6b7280",
};

const historyChangeWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
  marginTop: 10,
};

const historyChangeBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 10,
  padding: 10,
};

const historyChangeLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 6,
};

const historyChangeValue: React.CSSProperties = {
  fontSize: 13,
  color: "#111827",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};