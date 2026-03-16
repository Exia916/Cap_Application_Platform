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
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function CommentsPanel({
  entityType,
  entityId,
  title = "Comments",
}: {
  entityType: string;
  entityId: string;
  title?: string;
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
        { cache: "no-store" }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (e: any) {
      setError(e?.message || "Failed to save comment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={card}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment…"
          rows={4}
          style={textArea}
          disabled={saving}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" style={btnPrimary} disabled={saving || !commentText.trim()}>
            {saving ? "Saving..." : "Add Comment"}
          </button>
        </div>
      </form>

      {loading ? <div style={mutedText}>Loading comments…</div> : null}
      {!loading && error ? <div style={errorBox}>{error}</div> : null}
      {!loading && !error && rows.length === 0 ? (
        <div style={mutedText}>No comments yet.</div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id} style={commentItem}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 700, color: "#111827" }}>
                  {row.createdByName || row.createdByUserId || "Unknown User"}
                </div>
                <div style={metaText}>{fmtTs(row.createdAt)}</div>
              </div>

              <div style={commentTextStyle}>{row.commentText}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const textArea: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  resize: "vertical",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: 12,
  fontSize: 14,
  fontFamily: "inherit",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 36,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const mutedText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const metaText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
};

const commentItem: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fafafa",
  padding: 12,
};

const commentTextStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 14,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#b91c1c",
};