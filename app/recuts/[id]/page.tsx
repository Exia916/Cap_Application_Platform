"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type RecutRow = {
  id: string;
  recutId: number | null;
  requestedAt: string | null;
  requestedDate: string | null;
  requestedByName: string | null;
  requestedByEmployeeNumber: number | null;
  requestedDepartment: string | null;
  salesOrder: string | null;
  detailNumber: number | null;
  designName: string | null;
  recutReason: string | null;
  capStyle: string | null;
  pieces: number | null;
  operator: string | null;
  deliverTo: string | null;
  supervisorApproved: boolean | null;
  warehousePrinted: boolean | null;
  event: boolean | null;
  doNotPull: boolean | null;
  notes: string | null;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function yesNo(v: boolean | null | undefined) {
  if (v == null) return "";
  return v ? "Yes" : "No";
}

export default function RecutViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<RecutRow | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/recuts/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load recut request");

        if (!alive) return;
        setRow(data?.entry ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load recut request");
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
        <h1 style={{ marginBottom: 12 }}>Recut Request View</h1>
        <div style={errorBox}>{error}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/recuts" style={btnSecondary}>Back</Link>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ marginBottom: 12 }}>Recut Request View</h1>
        <div style={errorBox}>Not found.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/recuts" style={btnSecondary}>Back</Link>
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
        <h1 style={{ margin: 0 }}>Recut Request #{row.recutId ?? row.id}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/recuts" style={btnSecondary}>Back</Link>
          <Link href={`/recuts/${id}/edit`} style={btnPrimary}>Edit</Link>
        </div>
      </div>

      <div style={card}>
        <div style={grid}>
          <Info label="Requested At" value={fmtTs(row.requestedAt)} />
          <Info label="Requested Date" value={row.requestedDate} />
          <Info label="Requested By" value={row.requestedByName} />
          <Info label="Employee #" value={row.requestedByEmployeeNumber} />
          <Info label="Department" value={row.requestedDepartment} />
          <Info label="Sales Order" value={row.salesOrder} />
          <Info label="Detail #" value={row.detailNumber} />
          <Info label="Design Name" value={row.designName} />
          <Info label="Recut Reason" value={row.recutReason} />
          <Info label="Cap Style" value={row.capStyle} />
          <Info label="Pieces" value={row.pieces} />
          <Info label="Operator" value={row.operator} />
          <Info label="Deliver To" value={row.deliverTo} />
          <Info label="Supervisor Approved" value={yesNo(row.supervisorApproved)} />
          <Info label="Warehouse Printed" value={yesNo(row.warehousePrinted)} />
          <Info label="Event" value={yesNo(row.event)} />
          <Info label="Do Not Pull" value={yesNo(row.doNotPull)} />
          <div style={{ gridColumn: "1 / -1" }}>
            <Info label="Notes" value={row.notes} />
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