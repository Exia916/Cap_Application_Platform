"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AttachmentVisibility = "standard" | "os_secure";

type Attachment = {
  id: number;
  originalFileName: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedByName?: string | null;
  attachmentComment?: string | null;
  visibility?: AttachmentVisibility | null;
  canPreviewInline?: boolean;
};

type Props = {
  entityType: string;
  entityId: string;
};

type OpenWithState =
  | { open: false }
  | { open: true; attachment: Attachment };

type CommentDialogState =
  | { open: false }
  | {
      open: true;
      attachment: Attachment;
      value: string;
      visibility: AttachmentVisibility;
    };

function normalizeVisibility(v?: string | null): AttachmentVisibility {
  return v === "os_secure" ? "os_secure" : "standard";
}

function fmtFileSize(bytes?: number | null) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fmtDateOnly(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString();
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

function previewKind(att?: Attachment | null): "image" | "pdf" | "text" | "none" {
  if (!att) return "none";
  const mt = String(att.mimeType || "").toLowerCase();
  const ext = extOf(att.originalFileName);

  if (mt.startsWith("image/")) return "image";
  if (mt.includes("pdf") || ext === ".pdf") return "pdf";
  if (mt.startsWith("text/") || [".txt", ".csv", ".json", ".xml", ".log"].includes(ext)) {
    return "text";
  }
  return "none";
}

export default function AttachmentsPanel({ entityType, entityId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [supportsOsSecureFiles, setSupportsOsSecureFiles] = useState(false);
  const [canManageOsSecureFiles, setCanManageOsSecureFiles] = useState(false);
  const [uploadVisibility, setUploadVisibility] =
    useState<AttachmentVisibility>("standard");

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [savingComment, setSavingComment] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [commentDialog, setCommentDialog] = useState<CommentDialogState>({ open: false });
  const [openWith, setOpenWith] = useState<OpenWithState>({ open: false });
  const [fitToWindow, setFitToWindow] = useState(false);

  const [topSectionHeight, setTopSectionHeight] = useState(188);
  const [previewHeight, setPreviewHeight] = useState(220);
  const [resizeMode, setResizeMode] = useState<"split" | "preview" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const openWithRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);

  const selectedAttachment = useMemo(
    () => attachments.find((x) => x.id === selectedId) ?? null,
    [attachments, selectedId]
  );

  const selectedIsSecure = normalizeVisibility(selectedAttachment?.visibility) === "os_secure";

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!openWithRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!openWithRef.current.contains(e.target)) {
        setOpenWith({ open: false });
      }
    }

    if (openWith.open) {
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }
  }, [openWith]);

  useEffect(() => {
    if (!resizeMode) return;

    function onMove(e: MouseEvent) {
      const shell = shellRef.current;
      const previewWrap = previewWrapRef.current;
      if (!shell) return;

      const rect = shell.getBoundingClientRect();

      if (resizeMode === "split") {
        const next = e.clientY - rect.top - 40;
        const minHeight = 128;
        const maxHeight = Math.max(170, rect.height - 190);
        setTopSectionHeight(Math.max(minHeight, Math.min(maxHeight, next)));
        return;
      }

      if (resizeMode === "preview" && previewWrap) {
        const previewRect = previewWrap.getBoundingClientRect();
        const next = e.clientY - previewRect.top;
        const minHeight = 160;
        const maxHeight = Math.max(180, rect.height - 110);
        setPreviewHeight(Math.max(minHeight, Math.min(maxHeight, next)));
      }
    }

    function onUp() {
      setResizeMode(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizeMode]);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/platform/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        { cache: "no-store", credentials: "include" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to load attachments.");
      }

      const rows = Array.isArray((data as any)?.rows) ? (data as any).rows : [];

      setAttachments(rows);
      setSupportsOsSecureFiles(!!(data as any)?.supportsOsSecureFiles);
      setCanManageOsSecureFiles(!!(data as any)?.canManageOsSecureFiles);

      if (!(data as any)?.canManageOsSecureFiles) {
        setUploadVisibility("standard");
      }

      setSelectedId((current) => {
        if (!rows.length) return null;
        if (current && rows.some((x: Attachment) => x.id === current)) return current;
        return rows[0].id;
      });
    } catch (e: any) {
      setAttachments([]);
      setSelectedId(null);
      setSupportsOsSecureFiles(false);
      setCanManageOsSecureFiles(false);
      setUploadVisibility("standard");
      setError(e?.message || "Failed to load attachments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function uploadFiles(files: File[]) {
    if (!files.length || uploading) return;

    try {
      setUploading(true);
      setError(null);
      setSuccessMsg(null);

      let successCount = 0;
      const failures: string[] = [];

      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("entityType", entityType);
        form.append("entityId", entityId);
        form.append(
          "visibility",
          canManageOsSecureFiles ? uploadVisibility : "standard"
        );

        const res = await fetch("/api/platform/attachments", {
          method: "POST",
          body: form,
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          failures.push(`${file.name}: ${(data as any)?.error || "Upload failed."}`);
          continue;
        }

        successCount += 1;
      }

      if (successCount > 0) {
        setSuccessMsg(
          successCount === 1 ? "Uploaded 1 file." : `Uploaded ${successCount} files.`
        );
      }

      if (failures.length) {
        setError(failures.join(" "));
      }

      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to upload attachment.");
    } finally {
      setUploading(false);
    }
  }

  function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) void uploadFiles(files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) void uploadFiles(files);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else setDragActive(false);
  }

  async function removeSelected() {
    if (!selectedAttachment) return;
    if (!confirm(`Delete attachment "${selectedAttachment.originalFileName}"?`)) return;

    try {
      setRemovingId(selectedAttachment.id);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(`/api/platform/attachments/${selectedAttachment.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to delete attachment.");
      }

      setSuccessMsg(`Deleted "${selectedAttachment.originalFileName}".`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete attachment.");
    } finally {
      setRemovingId(null);
    }
  }

  async function openAttachment(attachment: Attachment, download = false) {
    const url = `/api/platform/attachments/${attachment.id}${download ? "?action=download" : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function openSelected(download = false) {
    if (!selectedAttachment) return;
    await openAttachment(selectedAttachment, download);
  }

  async function copyShareLink() {
    if (!selectedAttachment) return;

    if (normalizeVisibility(selectedAttachment.visibility) === "os_secure") {
      setError("OS Secure Files cannot be shared by link.");
      setOpenWith({ open: false });
      return;
    }

    try {
      setError(null);
      setSuccessMsg(null);

      const res = await fetch(
        `/api/platform/attachments/${selectedAttachment.id}?action=share`,
        { credentials: "include", cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !(data as any)?.url) {
        throw new Error((data as any)?.error || "Failed to generate share link.");
      }

      await navigator.clipboard.writeText((data as any).url);
      setSuccessMsg(`Share link copied for "${selectedAttachment.originalFileName}".`);
      setOpenWith({ open: false });
    } catch (e: any) {
      setError(e?.message || "Failed to copy share link.");
    }
  }

  function openCommentDialog() {
    if (!selectedAttachment) return;
    setCommentDialog({
      open: true,
      attachment: selectedAttachment,
      value: selectedAttachment.attachmentComment || "",
      visibility: normalizeVisibility(selectedAttachment.visibility),
    });
  }

  async function saveComment() {
    if (!commentDialog.open) return;

    try {
      setSavingComment(true);
      setError(null);
      setSuccessMsg(null);

      const body: {
        attachmentComment: string;
        visibility?: AttachmentVisibility;
      } = {
        attachmentComment: commentDialog.value,
      };

      if (canManageOsSecureFiles) {
        body.visibility = commentDialog.visibility;
      }

      const res = await fetch(`/api/platform/attachments/${commentDialog.attachment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to update attachment.");
      }

      setCommentDialog({ open: false });
      setSuccessMsg(`Updated "${commentDialog.attachment.originalFileName}".`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update attachment.");
    } finally {
      setSavingComment(false);
    }
  }

  const previewUrl = selectedAttachment
    ? `/api/platform/attachments/${selectedAttachment.id}`
    : "";

  const kind = previewKind(selectedAttachment);

  return (
    <div className="dw-attachments-wrap">
      <style>{`
        .dw-attachments-wrap {
          display: grid;
          gap: 10px;
          min-height: 0;
          height: 100%;
        }

        .dw-attach-panel {
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 0;
          padding: 8px;
          min-height: 0;
          height: 100%;
          display: grid;
        }

        .dw-attach-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 72px;
          gap: 8px;
          align-items: start;
          min-height: 0;
          height: 100%;
        }

        .dw-attach-main {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 6px;
          min-width: 0;
          min-height: 0;
          height: 100%;
        }

        .dw-attach-dropzone {
          border: 1px dashed var(--border-strong);
          background: var(--surface-subtle);
          padding: 8px 10px;
          font-size: 12px;
          color: var(--text-soft);
          min-height: 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .dw-attach-dropzone.active {
          background: var(--accent-soft);
          border-color: var(--brand-blue);
          color: var(--brand-blue);
        }

        .dw-attach-upload-mode {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          font-size: 12px;
          color: var(--text);
        }

        .dw-attach-upload-mode input {
          margin: 0;
        }

        .dw-attach-resize-shell {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          min-height: 0;
          height: 100%;
        }

        .dw-attach-top-wrap {
          min-height: 128px;
          max-height: 60vh;
          display: grid;
          min-width: 0;
        }

        .dw-attach-table-wrap {
          border: 1px solid var(--border-table-strong);
          background: #fff;
          overflow: auto;
          min-height: 0;
        }

        .dw-attach-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 12px;
        }

        .dw-attach-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: var(--surface);
          text-align: left;
          font-weight: 400;
          color: var(--text);
          border-bottom: 1px solid var(--border);
          border-right: 1px solid var(--border);
          padding: 4px 6px;
        }

        .dw-attach-table th:last-child {
          border-right: none;
        }

        .dw-attach-table td {
          border-bottom: 1px solid #ece7dd;
          padding: 3px 6px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: default;
        }

        .dw-attach-row {
          user-select: none;
        }

        .dw-attach-row:hover td {
          background: rgba(34, 68, 139, 0.04);
        }

        .dw-attach-row.dw-selected td {
          background: #0a67c7;
          color: #ffffff;
        }

        .dw-attach-filecell {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .dw-attach-icon {
          width: 16px;
          min-width: 16px;
          text-align: center;
          font-size: 14px;
          line-height: 1;
        }

        .dw-attach-filename {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dw-secure-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 6px;
          padding: 1px 6px;
          border: 1px solid var(--warning-border);
          background: var(--warning-bg);
          color: var(--warning-text);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.4;
          white-space: nowrap;
        }

        .dw-selected .dw-secure-badge {
          background: #ffffff;
          color: #8a5a12;
          border-color: #f4d39b;
        }

        .dw-attach-splitter,
        .dw-attach-preview-splitter {
          height: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: row-resize;
          user-select: none;
        }

        .dw-attach-splitter::before,
        .dw-attach-preview-splitter::before {
          content: "";
          display: block;
          width: 100%;
          height: 1px;
          background: var(--border-table-strong);
          box-shadow: 0 -1px 0 #fff, 0 1px 0 #fff;
        }

        .dw-attach-preview-wrap {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          gap: 4px;
          min-height: 0;
          height: 100%;
        }

        .dw-attach-fit-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text);
          user-select: none;
        }

        .dw-attach-preview {
          border: 1px solid var(--border-table-strong);
          background: #fff;
          min-height: 180px;
          overflow: auto;
          position: relative;
        }

        .dw-attach-preview iframe {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
        }

        .dw-attach-preview-image-center {
          min-width: 100%;
          min-height: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 8px;
        }

        .dw-attach-preview-image-fit {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          overflow: hidden;
        }

        .dw-attach-preview-image-fit img {
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          display: block;
          object-fit: contain;
        }

        .dw-attach-preview-image-center img {
          width: auto;
          height: auto;
          max-width: none;
          max-height: none;
          display: block;
          object-fit: none;
        }

        .dw-attach-preview-empty {
          width: 100%;
          min-height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 12px;
          color: var(--text-soft);
          font-size: 12px;
        }

        .dw-attach-actions {
          display: grid;
          gap: 8px;
          align-content: start;
        }

        .dw-attach-actions .btn {
          min-height: 24px;
          border-radius: 0;
          font-size: 12px;
          font-weight: 400;
          box-shadow: none;
          padding: 4px 6px;
        }

        .dw-attach-msg {
          font-size: 12px;
        }

        .dw-attach-openwith {
          position: relative;
        }

        .dw-attach-openwith-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 190px;
          background: #fff;
          border: 1px solid var(--border-table-strong);
          box-shadow: var(--shadow-md);
          z-index: 30;
          display: grid;
        }

        .dw-attach-openwith-menu button {
          appearance: none;
          border: 0;
          background: #fff;
          padding: 8px 10px;
          text-align: left;
          font-size: 12px;
          cursor: pointer;
        }

        .dw-attach-openwith-menu button:hover {
          background: var(--surface-muted);
        }

        .dw-attach-secure-note {
          padding: 8px 10px;
          font-size: 12px;
          color: var(--warning-text);
          background: var(--warning-bg);
          border-top: 1px solid var(--warning-border);
        }

        .dw-attach-dialog-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(17, 17, 17, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 60;
          padding: 20px;
        }

        .dw-attach-dialog {
          width: 100%;
          max-width: 420px;
          background: #fff;
          border: 1px solid var(--border-table-strong);
          box-shadow: var(--shadow-md);
        }

        .dw-attach-dialog-head {
          background: #0a67c7;
          color: #fff;
          font-size: 13px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dw-attach-dialog-body {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .dw-attach-dialog-foot {
          padding: 0 12px 12px;
          display: flex;
          justify-content: center;
          gap: 10px;
        }

        .dw-attach-dialog-foot .btn {
          min-width: 72px;
          border-radius: 0;
          min-height: 30px;
          box-shadow: none;
        }

        @media (max-width: 720px) {
          .dw-attach-dropzone {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      {error ? <div className="alert alert-danger dw-attach-msg">{error}</div> : null}
      {successMsg ? <div className="alert alert-success dw-attach-msg">{successMsg}</div> : null}

      <div className="dw-attach-panel">
        <div className="dw-attach-shell">
          <div className="dw-attach-main" ref={shellRef}>
            <div
              className={`dw-attach-dropzone${dragActive ? " active" : ""}`}
              onDrop={handleDrop}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
            >
              <span>
                {uploading
                  ? "Uploading attachments..."
                  : uploadVisibility === "os_secure" && canManageOsSecureFiles
                    ? "Drag and drop OS Secure Files here, or use Add. Max 100 MB. Executable and script files are blocked."
                    : "Drag and drop files here, or use Add. Max 100 MB. Executable and script files are blocked."}
              </span>

              {supportsOsSecureFiles && canManageOsSecureFiles ? (
                <label className="dw-attach-upload-mode" title="Only authorized roles can open OS Secure Files.">
                  <input
                    type="checkbox"
                    checked={uploadVisibility === "os_secure"}
                    onChange={(e) =>
                      setUploadVisibility(e.target.checked ? "os_secure" : "standard")
                    }
                  />
                  <span>Upload as OS Secure File</span>
                </label>
              ) : null}
            </div>

            <div className="dw-attach-resize-shell">
              <div
                className="dw-attach-top-wrap"
                style={{ height: `${topSectionHeight}px` }}
              >
                <div className="dw-attach-table-wrap">
                  <table className="dw-attach-table">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "30%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "13%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Comments</th>
                        <th>By</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="dw-attach-preview-empty">Loading attachments...</div>
                          </td>
                        </tr>
                      ) : attachments.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="dw-attach-preview-empty">No attachments yet.</div>
                          </td>
                        </tr>
                      ) : (
                        attachments.map((a) => {
                          const selected = a.id === selectedId;
                          const secure = normalizeVisibility(a.visibility) === "os_secure";

                          return (
                            <tr
                              key={a.id}
                              className={`dw-attach-row${selected ? " dw-selected" : ""}`}
                              onClick={() => {
                                setSelectedId(a.id);
                                setOpenWith({ open: false });
                              }}
                              onDoubleClick={() => {
                                setSelectedId(a.id);
                                void openAttachment(a, false);
                              }}
                            >
                              <td title={a.originalFileName}>
                                <div className="dw-attach-filecell">
                                  <span className="dw-attach-icon">
                                    {fileIcon(a.originalFileName, a.mimeType)}
                                  </span>
                                  <span className="dw-attach-filename">
                                    {a.originalFileName}
                                  </span>
                                  {secure ? (
                                    <span className="dw-secure-badge">🔒 OS Secure</span>
                                  ) : null}
                                </div>
                              </td>
                              <td title={a.attachmentComment || ""}>
                                {a.attachmentComment || ""}
                              </td>
                              <td title={a.uploadedByName || ""}>
                                {a.uploadedByName || ""}
                              </td>
                              <td title={fmtDateOnly(a.createdAt)}>
                                {fmtDateOnly(a.createdAt)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                className="dw-attach-splitter"
                onMouseDown={() => setResizeMode("split")}
                title="Resize list / preview"
              />

              <div className="dw-attach-preview-wrap" ref={previewWrapRef}>
                <label className="dw-attach-fit-row">
                  <input
                    type="checkbox"
                    checked={fitToWindow}
                    onChange={(e) => setFitToWindow(e.target.checked)}
                  />
                  <span>Fit To Window</span>
                  {selectedIsSecure ? <span className="dw-secure-badge">🔒 OS Secure</span> : null}
                </label>

                <div className="dw-attach-preview" style={{ height: `${previewHeight}px` }}>
                  {!selectedAttachment ? (
                    <div className="dw-attach-preview-empty">
                      Select an attachment to preview or open.
                    </div>
                  ) : kind === "image" ? (
                    fitToWindow ? (
                      <div className="dw-attach-preview-image-fit">
                        <img src={previewUrl} alt={selectedAttachment.originalFileName} />
                      </div>
                    ) : (
                      <div className="dw-attach-preview-image-center">
                        <img src={previewUrl} alt={selectedAttachment.originalFileName} />
                      </div>
                    )
                  ) : kind === "pdf" ? (
                    <iframe title={selectedAttachment.originalFileName} src={previewUrl} />
                  ) : kind === "text" ? (
                    <iframe title={selectedAttachment.originalFileName} src={previewUrl} />
                  ) : (
                    <div className="dw-attach-preview-empty">
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                          {selectedAttachment.originalFileName}
                        </div>
                        <div>
                          {selectedAttachment.mimeType || "File preview not available in browser."}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          {fmtFileSize(selectedAttachment.fileSizeBytes)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="dw-attach-preview-splitter"
                  onMouseDown={() => setResizeMode("preview")}
                  title="Resize preview"
                />
              </div>
            </div>
          </div>

          <div className="dw-attach-actions">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectFile}
              style={{ display: "none" }}
              multiple
            />

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Add
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void removeSelected()}
              disabled={!selectedAttachment || removingId === selectedAttachment?.id}
            >
              {removingId === selectedAttachment?.id ? "Removing..." : "Remove"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCommentDialog}
              disabled={!selectedAttachment || savingComment}
            >
              Comments
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void openSelected(false)}
              disabled={!selectedAttachment}
            >
              Open
            </button>

            <div className="dw-attach-openwith" ref={openWithRef}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!selectedAttachment) return;
                  setOpenWith((current) =>
                    current.open && current.attachment.id === selectedAttachment.id
                      ? { open: false }
                      : { open: true, attachment: selectedAttachment }
                  );
                }}
                disabled={!selectedAttachment}
              >
                Open With
              </button>

              {openWith.open ? (
                <div className="dw-attach-openwith-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenWith({ open: false });
                      void openSelected(false);
                    }}
                  >
                    Open in browser
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenWith({ open: false });
                      void openSelected(true);
                    }}
                  >
                    Download file
                  </button>

                  {selectedIsSecure ? (
                    <div className="dw-attach-secure-note">
                      OS Secure Files cannot be shared by link.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void copyShareLink();
                      }}
                    >
                      Copy share link
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {commentDialog.open ? (
        <div className="dw-attach-dialog-backdrop">
          <div className="dw-attach-dialog">
            <div className="dw-attach-dialog-head">
              <span>Design Request Attachment</span>
              <button
                type="button"
                onClick={() => setCommentDialog({ open: false })}
                style={{
                  appearance: "none",
                  border: 0,
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div className="dw-attach-dialog-body">
              <label className="field-label" style={{ marginBottom: 0 }}>
                Comments for this attachment:
              </label>
              <input
                className="input"
                value={commentDialog.value}
                onChange={(e) =>
                  setCommentDialog((current) =>
                    current.open ? { ...current, value: e.target.value } : current
                  )
                }
                autoFocus
              />

              {supportsOsSecureFiles && canManageOsSecureFiles ? (
                <label
                  className="muted-box"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    minHeight: 38,
                    padding: "8px 10px",
                    cursor: "pointer",
                    borderRadius: 0,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={commentDialog.visibility === "os_secure"}
                    onChange={(e) =>
                      setCommentDialog((current) =>
                        current.open
                          ? {
                              ...current,
                              visibility: e.target.checked ? "os_secure" : "standard",
                            }
                          : current
                      )
                    }
                  />
                  <span>OS Secure File</span>
                </label>
              ) : null}
            </div>

            <div className="dw-attach-dialog-foot">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveComment()}
                disabled={savingComment}
              >
                {savingComment ? "Saving..." : "OK"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCommentDialog({ open: false })}
                disabled={savingComment}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}