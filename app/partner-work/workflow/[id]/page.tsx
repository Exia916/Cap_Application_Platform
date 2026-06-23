"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";

type PartnerInfo = {
  id: string;
  code: string;
  name: string;
  type: string;
  role: string;
};

type Capabilities = {
  canAssignSelf: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canNote: boolean;
  canComplete: boolean;
};

type ExternalWorkflowRecord = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;
  dateRequestCreated: string | null;
  dueDate: string | null;
  customerName: string | null;
  customerCode: string | null;
  binCode: string | null;
  digitizerUserId: string | null;
  digitizerName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  statusCode: string;
  statusLabel: string;
  instructions: string | null;
  additionalInstructions: string | null;
  colorwaysText: string | null;
  tapeNumber: string | null;
  rush: boolean;
  styleCode: string | null;
  sampleSoNumber: string | null;
  stitchCount: number | null;
  artProof: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  externalAssignmentField: "designer" | "digitizer";
  externalVisibilityMode: string;
  externalCompleteToStatusCode: string | null;
};

type AssignableUser = {
  id: string;
  username: string | null;
  displayName: string;
  email: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
  externalRole: string;
};

type ExternalAttachmentRow = {
  id: number;
  originalFileName: string;
  attachmentCategory: string;
  attachmentComment: string | null;
  visibility: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedByName: string | null;
  createdAt: string;
  canPreviewInline?: boolean;
  openUrl?: string;
  downloadUrl?: string;
};

type ExternalNoteRow = {
  id: string;
  noteText: string;
  createdByName: string | null;
  createdAt: string;
  partnerName: string | null;
};

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${yyyy}-${mm}-${dd}`;
}

function fmtDateOnly(value?: string | null): string {
  if (!value) return "—";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : ymdChicago(d);
}

function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function display(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "—";
}

function formatBytes(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assignmentLabel(record: ExternalWorkflowRecord): string {
  return record.externalAssignmentField === "digitizer" ? "Digitizer" : "Designer";
}

function assignmentUserId(record: ExternalWorkflowRecord): string {
  return record.externalAssignmentField === "digitizer"
    ? record.digitizerUserId ?? ""
    : record.designerUserId ?? "";
}

function assignmentName(record: ExternalWorkflowRecord): string {
  return record.externalAssignmentField === "digitizer"
    ? record.digitizerName ?? "Unassigned"
    : record.designerName ?? "Unassigned";
}

function statusBadge(record: ExternalWorkflowRecord) {
  const code = String(record.statusCode || "").toUpperCase();
  let cls = "badge badge-neutral";

  if (code === "INSTOCK_CONCEPTS" || code === "SIGN_IN_PROGRESS") {
    cls = "badge badge-brand-blue";
  } else if (code === "A" || code === "RA") {
    cls = "badge badge-warning";
  }

  return <span className={cls}>{record.statusLabel || record.statusCode}</span>;
}

function metaItem(label: string, value: ReactNode) {
  return (
    <div className="record-meta-item">
      <div className="record-meta-label">{label}</div>
      <div className="record-meta-value">{value}</div>
    </div>
  );
}

export default function PartnerWorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");

  const [record, setRecord] = useState<ExternalWorkflowRecord | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const [attachments, setAttachments] = useState<ExternalAttachmentRow[]>([]);
  const [notes, setNotes] = useState<ExternalNoteRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadComment, setUploadComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const assignmentField = record?.externalAssignmentField ?? "designer";
  const assignmentRoute =
    assignmentField === "digitizer" ? "assign-digitizer" : "assign-designer";
  const assignmentBodyKey =
    assignmentField === "digitizer" ? "digitizerUserId" : "designerUserId";
  const completeRoute =
    assignmentField === "digitizer" ? "complete-digitizing" : "complete-design";

  const canAssign = !!record && !!capabilities?.canAssignSelf && !completed;
  const canUpload = !!record && !!capabilities?.canUpload && !completed;
  const canDownload = !!record && !!capabilities?.canDownload;
  const canNote = !!record && !!capabilities?.canNote && !completed;
  const canComplete =
    !!record &&
    !!capabilities?.canComplete &&
    !!assignmentUserId(record) &&
    !!record.externalCompleteToStatusCode &&
    !completed;

  async function loadRecord() {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/partner-work/workflow/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load Workflow record.");
      }

      setRecord(data?.record ?? null);
      setPartner(data?.partner ?? null);
      setCapabilities(data?.capabilities ?? null);
      setSelectedUserId(data?.record ? assignmentUserId(data.record) : "");
    } catch (err: any) {
      setError(err?.message || "Failed to load Workflow record.");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignableUsers(field: "designer" | "digitizer") {
    try {
      const res = await fetch(
        `/api/partner-work/workflow/assignable-users?field=${encodeURIComponent(field)}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load partner users.");
      }

      setAssignableUsers(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setAssignableUsers([]);
      setError(err?.message || "Failed to load partner users.");
    }
  }

  async function loadAttachments() {
    if (!id || !capabilities?.canDownload) return;

    try {
      const res = await fetch(
        `/api/partner-work/workflow/${encodeURIComponent(id)}/attachments`,
        { cache: "no-store", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load files.");
      setAttachments(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load files.");
      setAttachments([]);
    }
  }

  async function loadNotes() {
    if (!id || !capabilities?.canNote) return;

    try {
      const res = await fetch(
        `/api/partner-work/workflow/${encodeURIComponent(id)}/notes`,
        { cache: "no-store", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load partner notes.");
      setNotes(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load partner notes.");
      setNotes([]);
    }
  }

  useEffect(() => {
    loadRecord();
  }, [id]);

  useEffect(() => {
    if (record && capabilities?.canAssignSelf) {
      loadAssignableUsers(record.externalAssignmentField);
    }
  }, [record?.id, record?.externalAssignmentField, capabilities?.canAssignSelf]);

  useEffect(() => {
    if (record && capabilities?.canDownload) {
      loadAttachments();
    }
    if (record && capabilities?.canNote) {
      loadNotes();
    }
  }, [record?.id, capabilities?.canDownload, capabilities?.canNote]);

  const selectedUser = useMemo(() => {
    return assignableUsers.find((user) => user.id === selectedUserId) ?? null;
  }, [assignableUsers, selectedUserId]);

  async function assignUser() {
    if (!record || !selectedUserId) return;

    try {
      setAssigning(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(
        `/api/partner-work/workflow/${encodeURIComponent(record.id)}/${assignmentRoute}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ [assignmentBodyKey]: selectedUserId }),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to assign ${assignmentLabel(record).toLowerCase()}.`);
      }

      setRecord(data?.record ?? record);
      setSelectedUserId(data?.record ? assignmentUserId(data.record) : selectedUserId);
      setSuccess(`${assignmentLabel(record)} updated.`);
    } catch (err: any) {
      setError(err?.message || `Failed to assign ${assignmentLabel(record).toLowerCase()}.`);
    } finally {
      setAssigning(false);
    }
  }

  async function uploadAttachment() {
    if (!record || !uploadFile) return;

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);

      const form = new FormData();
      form.set("file", uploadFile);
      form.set("attachmentCategory", "general");
      if (uploadComment.trim()) form.set("attachmentComment", uploadComment.trim());

      const res = await fetch(
        `/api/partner-work/workflow/${encodeURIComponent(record.id)}/attachments`,
        {
          method: "POST",
          credentials: "include",
          body: form,
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to upload file.");
      }

      setUploadFile(null);
      setUploadComment("");
      setSuccess("File uploaded.");
      await loadAttachments();
    } catch (err: any) {
      setError(err?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function addNote() {
    if (!record || !noteText.trim()) return;

    try {
      setSavingNote(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(
        `/api/partner-work/workflow/${encodeURIComponent(record.id)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ noteText }),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to add note.");
      }

      setNoteText("");
      setSuccess("Partner note added.");
      await loadNotes();
    } catch (err: any) {
      setError(err?.message || "Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function completeWork() {
    if (!record) return;

    try {
      setCompleting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(
        `/api/partner-work/workflow/${encodeURIComponent(record.id)}/${completeRoute}`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to complete work.");
      }

      setCompleted(true);
      setSuccess(
        `Completed. Status moved to ${data?.result?.newStatusLabel || record.externalCompleteToStatusCode}. This record will no longer appear in your active queue.`,
      );
    } catch (err: any) {
      setError(err?.message || "Failed to complete work.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <main className="record-shell">
        <div className="card">Loading partner Workflow record…</div>
      </main>
    );
  }

  if (error && !record) {
    return (
      <main className="record-shell">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Partner Workflow</h1>
            <p className="page-subtitle">The requested record could not be loaded.</p>
          </div>
          <Link href="/partner-work/workflow" className="btn btn-secondary">
            Back to Queue
          </Link>
        </div>
        <div className="alert alert-danger">{error}</div>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="record-shell">
        <div className="card">No record found.</div>
      </main>
    );
  }

  return (
    <main className="record-shell">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Workflow Request {record.requestNumber}</h1>
          <p className="page-subtitle">
            {partner?.name ? `${partner.name} partner view` : "External partner view"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/partner-work/workflow" className="btn btn-secondary">
            Back to Queue
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Workflow Summary</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {statusBadge(record)}
            {record.rush ? <span className="badge badge-warning">Rush</span> : null}
            {completed ? <span className="badge badge-success">Completed</span> : null}
          </div>
        </div>

        <div className="record-meta-grid">
          {metaItem("Request #", display(record.requestNumber))}
          {metaItem("Status", record.statusLabel)}
          {metaItem("Due Date", fmtDateOnly(record.dueDate))}
          {metaItem("Date Requested", fmtDateOnly(record.dateRequestCreated))}
          {metaItem("Tape #", display(record.tapeNumber))}
          {metaItem("Tape Name", display(record.tapeName))}
          {metaItem("Customer", display(record.customerName))}
          {metaItem("Style", display(record.styleCode))}
          {metaItem("Sales Order", display(record.salesOrderDisplay))}
          {metaItem("PO #", display(record.poNumber))}
          {metaItem("Sample SO #", display(record.sampleSoNumber))}
          {metaItem("Stitch Count", record.stitchCount == null ? "—" : record.stitchCount)}
        </div>
      </section>

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Status / Assignment</h2>
        </div>

        <div className="record-meta-grid">
          {metaItem("Current Status", statusBadge(record))}
          {metaItem(assignmentLabel(record), assignmentName(record))}
        </div>

        {canAssign ? (
          <div className="card" style={{ marginTop: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="record-meta-label">Select {assignmentLabel(record)}</span>
              <select
                className="select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={assigning}
              >
                <option value="">Select {assignmentLabel(record)}</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                    {user.employeeNumber ? ` (${user.employeeNumber})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={assignUser}
                disabled={assigning || !selectedUserId || selectedUserId === assignmentUserId(record)}
              >
                {assigning ? "Saving…" : `Save ${assignmentLabel(record)}`}
              </button>
              {selectedUser ? (
                <span className="text-soft" style={{ alignSelf: "center" }}>
                  Selected: {selectedUser.displayName}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-soft" style={{ marginTop: 12 }}>
            Assignment is not available for this partner account or this record.
          </p>
        )}
      </section>

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Relevant Workflow Details</h2>
        </div>

        <div className="record-meta-grid">
          {metaItem("Bin #", display(record.binCode))}
          {metaItem("Customer Code", display(record.customerCode))}
          {metaItem("ART PROOF", record.artProof ? "Yes" : "No")}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div>
            <div className="record-meta-label">Instructions</div>
            <div className="record-meta-value" style={{ whiteSpace: "pre-wrap" }}>
              {display(record.instructions)}
            </div>
          </div>
          <div>
            <div className="record-meta-label">Additional Instructions</div>
            <div className="record-meta-value" style={{ whiteSpace: "pre-wrap" }}>
              {display(record.additionalInstructions)}
            </div>
          </div>
          <div>
            <div className="record-meta-label">Colorways</div>
            <div className="record-meta-value" style={{ whiteSpace: "pre-wrap" }}>
              {display(record.colorwaysText)}
            </div>
          </div>
        </div>
      </section>

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Files</h2>
          <span className="record-pill record-pill-neutral">OS Secure files hidden</span>
        </div>

        {canDownload ? (
          <div style={{ display: "grid", gap: 10 }}>
            {attachments.length === 0 ? (
              <p className="text-soft" style={{ margin: 0 }}>No external-safe files are available.</p>
            ) : (
              <div className="card" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8 }}>File</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Uploaded By</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Size</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Uploaded</th>
                      <th style={{ textAlign: "right", padding: 8 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachments.map((file) => (
                      <tr key={file.id}>
                        <td style={{ padding: 8 }}>
                          <div style={{ fontWeight: 700 }}>{file.originalFileName}</div>
                          {file.attachmentComment ? (
                            <div className="text-soft">{file.attachmentComment}</div>
                          ) : null}
                        </td>
                        <td style={{ padding: 8 }}>{display(file.uploadedByName)}</td>
                        <td style={{ padding: 8 }}>{formatBytes(file.fileSizeBytes)}</td>
                        <td style={{ padding: 8 }}>{fmtDateTime(file.createdAt)}</td>
                        <td style={{ padding: 8, textAlign: "right", whiteSpace: "nowrap" }}>
                          <a
                            className="btn btn-secondary btn-sm"
                            href={file.openUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>{" "}
                          <a
                            className="btn btn-secondary btn-sm"
                            href={file.downloadUrl}
                          >
                            Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-soft" style={{ margin: 0 }}>File download access is not enabled.</p>
        )}

        {canUpload ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="record-meta-label" style={{ marginBottom: 8 }}>Upload Completed Files</div>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                className="input"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
              <textarea
                className="textarea"
                rows={3}
                value={uploadComment}
                onChange={(e) => setUploadComment(e.target.value)}
                placeholder="Optional file note"
                disabled={uploading}
              />
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={uploadAttachment}
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? "Uploading…" : "Upload File"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Partner Notes</h2>
        </div>

        {canNote ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="card">
              <textarea
                className="textarea"
                rows={4}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note for the internal CAP team"
                disabled={savingNote}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addNote}
                  disabled={savingNote || !noteText.trim()}
                >
                  {savingNote ? "Saving…" : "Add Note"}
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <p className="text-soft" style={{ margin: 0 }}>No partner notes yet.</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>{display(note.createdByName || note.partnerName)}</strong>
                    <span className="text-soft">{fmtDateTime(note.createdAt)}</span>
                  </div>
                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{note.noteText}</div>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-soft" style={{ margin: 0 }}>Partner notes are not enabled.</p>
        )}
      </section>

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Complete Work</h2>
        </div>

        <p className="text-soft" style={{ marginTop: 0 }}>
          Completing this record will move the internal Workflow status to {" "}
          <strong>{record.externalCompleteToStatusCode || "the configured internal review status"}</strong>
          and remove it from your active partner queue.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={completeWork}
          disabled={!canComplete || completing}
        >
          {completing ? "Completing…" : `Complete ${assignmentField === "digitizer" ? "Digitizing" : "Design"}`}
        </button>

        {!assignmentUserId(record) ? (
          <p className="text-soft" style={{ marginBottom: 0 }}>
            Assign a {assignmentLabel(record).toLowerCase()} before completing this record.
          </p>
        ) : null}
      </section>
    </main>
  );
}
