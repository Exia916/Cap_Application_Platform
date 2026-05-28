"use client";

import { useEffect, useState } from "react";

type CommentRow = {
  id: number;
  entityType: string;
  entityId: string;
  commentText: string;
  createdByUserId: string | null;
  createdByName: string | null;
  employeeNumber: number | null;
  createdAt: string;
  updatedAt: string;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

export default function CommentsPanel({
  entityType,
  entityId,
  title = "Comments",
  subtitle,
  onCommentAdded,
}: {
  entityType: string;
  entityId: string;
  title?: string;
  subtitle?: string;
  onCommentAdded?: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/platform/comments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to load comments");
      }

      setRows(Array.isArray((data as any)?.rows) ? (data as any).rows : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load comments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const text = commentText.trim();
    if (!text) return;

    try {
      setSaving(true);
      setError(null);

      const res = await fetch("/api/platform/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entityType,
          entityId,
          commentText: text,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to save comment");
      }

      setCommentText("");
      await load();
      await onCommentAdded?.();
    } catch (e: any) {
      setError(e?.message || "Failed to save comment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="section-card-header">
        <div>
          <h2 style={{ marginBottom: 4 }}>{title}</h2>
          {subtitle ? <div className="text-soft">{subtitle}</div> : null}
        </div>

        {!loading && !error ? (
          <span className="badge badge-neutral">
            {rows.length}
          </span>
        ) : null}
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment…"
          rows={4}
          className="input"
          style={{
            minHeight: 110,
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.45,
          }}
          disabled={saving}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !commentText.trim()}
          >
            {saving ? "Saving..." : "Add Comment"}
          </button>
        </div>
      </form>

      {loading ? <div className="text-muted">Loading comments…</div> : null}

      {!loading && error ? (
        <div className="alert alert-danger">{error}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="text-muted">No comments yet.</div>
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
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 800, color: "var(--text)" }}>
                    {row.createdByName || row.createdByUserId || "Unknown User"}
                  </div>
                  {row.employeeNumber ? (
                    <div className="text-soft" style={{ fontSize: 12 }}>
                      Employee #{row.employeeNumber}
                    </div>
                  ) : null}
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
                {row.commentText}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}