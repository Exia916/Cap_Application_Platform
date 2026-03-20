"use client";

import { useEffect, useState } from "react";

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

export default function ActivityHistoryPanel({
  entityType,
  entityId,
  title = "Activity History",
  defaultExpanded = false,
}: {
  entityType: string;
  entityId: string;
  title?: string;
  defaultExpanded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityHistoryRow[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/platform/activity-history?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { cache: "no-store" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to load activity history");
      }

      setRows(Array.isArray((data as any)?.rows) ? (data as any).rows : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  return (
    <div className="card">
      <div style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {!loading && !error ? <span style={countBadge}>{rows.length}</span> : null}
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

const header: React.CSSProperties = {
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

const collapsedText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  marginTop: 12,
};

const mutedText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#b91c1c",
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