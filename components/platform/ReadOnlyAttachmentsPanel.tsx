"use client";

import { useEffect, useState } from "react";

type Attachment = {
  id: number;
  originalFileName: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedByName?: string | null;
  attachmentComment?: string | null;
};

type Props = {
  entityType: string;
  entityId: string;
};

function fmtFileSize(bytes?: number | null) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fmtDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

function extOf(name: string) {
  const idx = String(name || "").lastIndexOf(".");
  return idx >= 0 ? String(name).slice(idx).toLowerCase() : "";
}

function fileIcon(name: string, mimeType?: string | null) {
  const ext = extOf(name);
  const mt = String(mimeType || "").toLowerCase();

  if (mt.includes("pdf") || ext === ".pdf") return "📕";
  if (mt.startsWith("image/")) return "🖼️";
  if (mt.includes("excel") || [".xls", ".xlsx", ".csv"].includes(ext)) return "📗";
  if (mt.includes("word") || [".doc", ".docx", ".rtf"].includes(ext)) return "📘";
  if (mt.includes("zip") || [".zip", ".rar", ".7z"].includes(ext)) return "🗜️";
  if (mt.startsWith("text/") || [".txt", ".log", ".json", ".xml"].includes(ext)) return "📄";
  if ([".eml", ".msg"].includes(ext)) return "✉️";
  return "📎";
}

export default function ReadOnlyAttachmentsPanel({ entityType, entityId }: Props) {
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/platform/attachments?entityType=${encodeURIComponent(
          entityType
        )}&entityId=${encodeURIComponent(entityId)}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load supporting files.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to load supporting files.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  function openAttachment(id: number, download = false) {
    const url = `/api/platform/attachments/${id}${download ? "?action=download" : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <div className="text-soft">Loading supporting files…</div>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (rows.length === 0) {
    return <div className="text-soft">No supporting files attached yet.</div>;
  }

  return (
    <div className="table-scroll">
      <table className="table-clean">
        <thead>
          <tr>
            <th>File</th>
            <th>Comments</th>
            <th>Uploaded By</th>
            <th>Date</th>
            <th>Size</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span>{fileIcon(row.originalFileName, row.mimeType)}</span>
                  <span style={{ fontWeight: 700 }}>{row.originalFileName}</span>
                </span>
              </td>

              <td>{row.attachmentComment || ""}</td>
              <td>{row.uploadedByName || ""}</td>
              <td>{fmtDate(row.createdAt)}</td>
              <td>{fmtFileSize(row.fileSizeBytes)}</td>

              <td>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openAttachment(row.id, false)}
                  >
                    Open
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openAttachment(row.id, true)}
                  >
                    Download
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}