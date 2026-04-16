"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type RequestRecord = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;
  dateRequestCreated: string;
  dueDate: string | null;
  customerName: string | null;
  customerCode: string | null;
  binCode: string | null;
  createdByName: string | null;
  digitizerName: string | null;
  designerName: string | null;
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
  createdAt: string;
  updatedAt: string;
};

type StatusHistoryRow = {
  id: number;
  changedAt: string;
  changedByName: string | null;
  changedByUserId: string | null;
  statusLabel: string;
};

type CommentRow = {
  id: number;
  commentText: string;
  createdByName: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

type ActivityRow = {
  id: number;
  eventType: string;
  message: string | null;
  userName: string | null;
  userId: string | null;
  createdAt: string;
};

type AttachmentRow = {
  id: number;
  originalFileName: string;
};

function fmt(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function DesignWorkflowPreviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<RequestRecord | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const id = params?.id;
  const shouldPrint = searchParams.get("print") === "1";

  useEffect(() => {
    if (!id) return;

    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [recordRes, statusRes, commentsRes, activityRes, attachmentsRes] =
          await Promise.all([
            fetch(`/api/design-workflow/${encodeURIComponent(id)}`, {
              cache: "no-store",
              credentials: "include",
            }),
            fetch(`/api/design-workflow/${encodeURIComponent(id)}/status-history`, {
              cache: "no-store",
              credentials: "include",
            }),
            fetch(
              `/api/platform/comments?entityType=${encodeURIComponent("design_workflow")}&entityId=${encodeURIComponent(id)}`,
              { cache: "no-store", credentials: "include" }
            ),
            fetch(
              `/api/platform/activity-history?entityType=${encodeURIComponent("design_workflow")}&entityId=${encodeURIComponent(id)}`,
              { cache: "no-store", credentials: "include" }
            ),
            fetch(
              `/api/platform/attachments?entityType=${encodeURIComponent("design_workflow")}&entityId=${encodeURIComponent(id)}`,
              { cache: "no-store", credentials: "include" }
            ),
          ]);

        const recordData = await recordRes.json().catch(() => ({}));
        const statusData = await statusRes.json().catch(() => []);
        const commentsData = await commentsRes.json().catch(() => ({}));
        const activityData = await activityRes.json().catch(() => ({}));
        const attachmentsData = await attachmentsRes.json().catch(() => ({}));

        if (!recordRes.ok) {
          throw new Error((recordData as any)?.error || "Failed to load preview.");
        }

        if (!alive) return;

        setRecord(recordData as RequestRecord);
        setStatusHistory(Array.isArray(statusData) ? statusData : []);
        setComments(Array.isArray((commentsData as any)?.rows) ? (commentsData as any).rows : []);
        setActivity(Array.isArray((activityData as any)?.rows) ? (activityData as any).rows : []);
        setAttachments(
          Array.isArray((attachmentsData as any)?.rows)
            ? (attachmentsData as any).rows
            : Array.isArray(attachmentsData)
              ? (attachmentsData as any)
              : []
        );
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message || "Failed to load preview.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!shouldPrint || loading || error || !record) return;

    const t = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(t);
  }, [shouldPrint, loading, error, record]);

  if (loading) {
    return <div style={wrap}>Loading preview…</div>;
  }

  if (error || !record) {
    return <div style={wrap}>{error || "Preview not found."}</div>;
  }

  return (
    <div style={wrap}>
      <style>{`
        @media print {
          body {
            background: #fff !important;
          }
        }
      `}</style>

      <div style={header}>
        <h1 style={{ margin: 0 }}>Design Request Preview</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" onClick={() => window.close()}>
            Close
          </button>
        </div>
      </div>

      <Section title="General">
        <Grid>
          <KV label="Request #" value={record.requestNumber} />
          <KV label="Sales Order #" value={record.salesOrderDisplay || record.salesOrderNumber || ""} />
          <KV label="PO #" value={record.poNumber || ""} />
          <KV label="Tape Name" value={record.tapeName || ""} />
          <KV label="Date Request Created" value={fmt(record.dateRequestCreated)} />
          <KV label="Due Date" value={record.dueDate || ""} />
          <KV label="Customer" value={record.customerName || ""} />
          <KV label="Bin #" value={record.binCode || ""} />
          <KV label="Created By" value={record.createdByName || ""} />
          <KV label="Digitizer" value={record.digitizerName || ""} />
          <KV label="Designer" value={record.designerName || ""} />
          <KV label="Request Status" value={record.statusLabel || ""} />
          <KV label="Tape Number" value={record.tapeNumber || ""} />
          <KV label="Rush" value={record.rush ? "Yes" : "No"} />
          <KV label="Style" value={record.styleCode || ""} />
          <KV label="Sample SO Number" value={record.sampleSoNumber || ""} />
          <KV label="Stitch Count" value={record.stitchCount != null ? String(record.stitchCount) : ""} />
          <KV label="ART PROOF" value={record.artProof ? "Yes" : "No"} />
          <KV label="Created" value={fmt(record.createdAt)} />
          <KV label="Updated" value={fmt(record.updatedAt)} />
        </Grid>

        <div style={{ marginTop: 14 }}>
          <div style={subhead}>Instructions</div>
          <div style={box}>{record.instructions || ""}</div>
        </div>
      </Section>

      <Section title="Additional Instructions">
        <div style={box}>{record.additionalInstructions || ""}</div>
      </Section>

      <Section title="Colorways">
        <div style={box}>{record.colorwaysText || ""}</div>
      </Section>

      <Section title="Attachments">
        {attachments.length === 0 ? (
          <div style={muted}>No attachments.</div>
        ) : (
          <ul>
            {attachments.map((a) => (
              <li key={a.id}>{a.originalFileName}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Status History">
        {statusHistory.length === 0 ? (
          <div style={muted}>No status history yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>User</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              {statusHistory.map((row) => (
                <tr key={row.id}>
                  <td>{fmt(row.changedAt)}</td>
                  <td>{row.changedByName || row.changedByUserId || ""}</td>
                  <td>{row.statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Comments">
        {comments.length === 0 ? (
          <div style={muted}>No comments yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {comments.map((c) => (
              <div key={c.id} style={item}>
                <div style={{ fontWeight: 700 }}>
                  {c.createdByName || c.createdByUserId || "Unknown"}
                </div>
                <div style={muted}>{fmt(c.createdAt)}</div>
                <div>{c.commentText}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Activity History">
        {activity.length === 0 ? (
          <div style={muted}>No activity history yet.</div>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>User</th>
                <th>Event</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td>{fmt(a.createdAt)}</td>
                  <td>{a.userName || a.userId || ""}</td>
                  <td>{a.eventType}</td>
                  <td>{a.message || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={section}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={grid}>{children}</div>;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={kv}>
      <div style={kvLabel}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  background: "#fff",
  color: "#111",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 24,
};

const section: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 16,
  marginBottom: 18,
  background: "#fff",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
  gap: 12,
};

const kv: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  paddingBottom: 8,
};

const kvLabel: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 12,
  color: "#555",
  marginBottom: 4,
};

const subhead: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 6,
};

const box: React.CSSProperties = {
  minHeight: 40,
  whiteSpace: "pre-wrap",
};

const muted: React.CSSProperties = {
  color: "#666",
};

const item: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 8,
  padding: 10,
  background: "#fafafa",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};