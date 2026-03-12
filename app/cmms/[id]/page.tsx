"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type WorkOrderRow = {
  workOrderId: number | string;
  requestedAt: string | null;
  requestedByName: string | null;
  requestedByUserId: string | null;
  operatorInitials: string | null;
  issueDialogue: string | null;
  resolution: string | null;
  downTimeRecorded: string | null;

  department: string | null;
  asset: string | null;
  priority: string | null;
  commonIssue: string | null;

  workOrderType: string | null;
  tech: string | null;
  status: string | null;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function CMMSWorkOrderViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<WorkOrderRow | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/cmms/work-orders/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load work order");

        if (!alive) return;
        setRow(data ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load work order");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>CMMS Work Order View</h1>
        <div style={errorBox}>{error}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/cmms" style={btnSecondary}>Back</Link>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>CMMS Work Order View</h1>
        <div style={errorBox}>Not found.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/cmms" style={btnSecondary}>Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>CMMS Work Order #{row.workOrderId}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/cmms" style={btnSecondary}>Back</Link>
          <Link href={`/cmms/${id}/edit`} style={btnPrimary}>Edit</Link>
        </div>
      </div>

      <div style={card}>
        <div style={grid}>
          <Info label="Requested At" value={fmtTs(row.requestedAt)} />
          <Info label="Requested By" value={row.requestedByName} />
          <Info label="Requested By User" value={row.requestedByUserId} />
          <Info label="Operator Initials" value={row.operatorInitials} />

          <Info label="Department" value={row.department} />
          <Info label="Asset" value={row.asset} />
          <Info label="Priority" value={row.priority} />
          <Info label="Common Issue" value={row.commonIssue} />

          <Info label="Status" value={row.status} />
          <Info label="Tech" value={row.tech} />
          <Info label="Work Order Type" value={row.workOrderType} />
          <Info label="Down Time Recorded" value={row.downTimeRecorded} />

          <div style={{ gridColumn: "1 / -1" }}>
            <Info label="Issue Dialogue" value={row.issueDialogue} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Info label="Resolution" value={row.resolution} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value ?? ""}</div>
    </div>
  );
}

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

const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#b91c1c",
};