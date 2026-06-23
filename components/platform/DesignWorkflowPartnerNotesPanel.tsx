"use client";

import { useEffect, useState } from "react";

type PartnerNoteRow = {
  id: string;
  requestId: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  noteText: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

export default function DesignWorkflowPartnerNotesPanel({
  requestId,
}: {
  requestId: string;
}) {
  const [rows, setRows] = useState<PartnerNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!requestId) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/design-workflow/${encodeURIComponent(requestId)}/external-notes`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to load partner notes");
      }

      setRows(Array.isArray((data as any)?.rows) ? (data as any).rows : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load partner notes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [requestId]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-card-header">
        <div>
          <h2 style={{ marginBottom: 4 }}>Partner Notes</h2>
          <div className="text-soft">
            Notes added by external Workflow partners.
          </div>
        </div>

        {!loading && !error ? (
          <span className="badge badge-neutral">{rows.length}</span>
        ) : null}
      </div>

      {loading ? <div className="text-muted">Loading partner notes…</div> : null}

      {!loading && error ? (
        <div className="alert alert-danger">{error}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="text-muted">No partner notes yet.</div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "var(--surface-subtle)",
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge badge-neutral">{row.partnerName}</span>
                    <span style={{ fontWeight: 800, color: "var(--text)" }}>
                      {row.createdByName || row.createdByUserId || "External User"}
                    </span>
                  </div>
                </div>

                <div className="text-soft" style={{ fontSize: 12 }}>
                  {fmtTs(row.createdAt)}
                </div>
              </div>

              <div
                style={{
                  color: "var(--text)",
                  fontSize: 14,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: 1.45,
                }}
              >
                {row.noteText}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
