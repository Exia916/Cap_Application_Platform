"use client";

import { useEffect, useRef, useState } from "react";

type Attachment = {
  id: number;
  originalFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
  createdByName: string | null;
};

type Props = {
  entityType: string;
  entityId: string;
};

export default function AttachmentsPanel({ entityType, entityId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(
      `/api/platform/attachments?entityType=${entityType}&entityId=${entityId}`
    );
    const data = await res.json();
    setAttachments(data.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setFile(e.target.files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  }

  async function upload() {
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    form.append("entityType", entityType);
    form.append("entityId", entityId);

    const res = await fetch("/api/platform/attachments", {
      method: "POST",
      body: form,
    });

    if (res.ok) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      load();
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this attachment?")) return;

    await fetch(`/api/platform/attachments/${id}`, {
      method: "DELETE",
    });

    load();
  }

  return (
    <div className="card">
      <h3>Attachments</h3>

      {/* DROP ZONE */}
      <div
        onDrop={handleDrop}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        style={{
          border: "2px dashed var(--border-strong)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
          background: dragActive ? "var(--accent-soft)" : "var(--surface-subtle)",
          textAlign: "center",
        }}
      >
        <p style={{ marginBottom: 10 }}>
          Drag & Drop files here or select a file
        </p>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleSelectFile}
          style={{ display: "none" }}
        />

        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Select File
        </button>

        <button
          className="btn btn-primary"
          style={{ marginLeft: 10 }}
          disabled={!file}
          onClick={upload}
        >
          Upload
        </button>

        <div className="field-help">
          Allowed: PDF, images, TXT, CSV, DOC/DOCX, XLS/XLSX. Max 15 MB.
        </div>

        {file && (
          <div style={{ marginTop: 10 }}>
            Selected: <b>{file.name}</b>
          </div>
        )}
      </div>

      {/* LIST */}
      {attachments.length === 0 && (
        <div className="text-soft">No attachments yet.</div>
      )}

      {attachments.map((a) => (
        <div
          key={a.id}
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "6px 0",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <a href={`/api/platform/attachments/${a.id}`} target="_blank">
              {a.originalFileName}
            </a>
          </div>

          <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
