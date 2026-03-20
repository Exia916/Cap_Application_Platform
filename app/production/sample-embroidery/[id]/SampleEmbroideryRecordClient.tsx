"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CommentsPanel from "@/components/platform/CommentsPanel";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";

type SampleEmbroideryRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number | null;
  salesOrder: string | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
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

function SidebarNav({ id }: { id: string }) {
  return (
    <aside style={sidebarWrap}>
      <div style={sidebarCard}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={sidebarLabel}>Sample Embroidery Entry</div>
          <div style={sidebarTitle}>#{id.slice(0, 8)}</div>
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
            <Link href="/production/sample-embroidery" style={btnSecondaryBlock}>
              Back to List
            </Link>
            <Link href={`/production/sample-embroidery/${id}/edit`} style={btnPrimaryBlock}>
              Edit Entry
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function SampleEmbroideryRecordClient({ id }: { id: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<SampleEmbroideryRow | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/production/sample-embroidery/entry?id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as any)?.error || "Failed to load entry");
        }

        if (!alive) return;
        setRow((data as any)?.row ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load entry");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>Sample Embroidery Entry</h1>
        <div style={errorBox}>{error}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/production/sample-embroidery" style={btnSecondary}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>Sample Embroidery Entry</h1>
        <div style={errorBox}>Not found.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/production/sample-embroidery" style={btnSecondary}>
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
          <h1 style={{ margin: 0 }}>Sample Embroidery Entry</h1>
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            Unified record view for details, collaboration, files, and audit history
          </div>
        </div>
      </div>

      <div style={layoutGrid}>
        <SidebarNav id={id} />

        <main style={contentWrap}>
          <section id="details" style={sectionBlock}>
            <div style={card}>
              <div style={{ marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Entry Details</h2>
              </div>

              <div style={grid}>
                <Info label="Name" value={row.name} />
                <Info label="Employee Number" value={row.employeeNumber} />
                <Info label="Entry Date" value={row.entryDate} />
                <Info label="Entry Time" value={fmtTs(row.entryTs)} />
                <Info label="Sales Order" value={row.salesOrder} />
                <Info label="Number of Details" value={row.detailCount} />
                <Info label="Quantity" value={row.quantity} />
                <Info label="Created At" value={fmtTs(row.createdAt)} />
                <Info label="Updated At" value={fmtTs(row.updatedAt)} />

                <div style={{ gridColumn: "1 / -1" }}>
                  <Info label="Notes" value={row.notes || "—"} multiline />
                </div>
              </div>
            </div>
          </section>

          <section id="comments" style={sectionBlock}>
            <CommentsPanel
              entityType="sample_embroidery_entry"
              entityId={String(row.id)}
              title="Comments"
            />
          </section>

          <section id="attachments" style={sectionBlock}>
            <AttachmentsPanel
              entityType="sample_embroidery_entry"
              entityId={String(row.id)}
            />
          </section>

          <section id="history" style={sectionBlock}>
            <ActivityHistoryPanel
              entityType="sample_embroidery_entry"
              entityId={String(row.id)}
              title="Activity History"
            />
          </section>
        </main>
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