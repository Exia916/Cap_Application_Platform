// app/qc-daily-production/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type QCSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: number | null;
  notes: string | null;
};

type QCLine = {
  id: string;
  detailNumber: number | null;
  flatOr3d: string | null;
  orderQuantity: number | null;
  inspectedQuantity: number | null;
  rejectedQuantity: number | null;
  quantityShipped: number | null;
  notes: string | null;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

import { use } from "react";

export default function QCDailyProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<QCSubmission | null>(null);
  const [lines, setLines] = useState<QCLine[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/qc-daily-production-submission?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load submission");

        if (!alive) return;
        setSubmission(data?.submission ?? null);
        setLines(Array.isArray(data?.lines) ? data.lines : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load submission");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        acc.orderQty += Number(line.orderQuantity || 0);
        acc.inspected += Number(line.inspectedQuantity || 0);
        acc.rejected += Number(line.rejectedQuantity || 0);
        acc.shipped += Number(line.quantityShipped || 0);
        return acc;
      },
      { orderQty: 0, inspected: 0, rejected: 0, shipped: 0 }
    );
  }, [lines]);

  if (loading) return <div className="p-6">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">QC Daily Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <Link href="/qc-daily-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">QC Daily Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Not found.</div>
        <Link href="/qc-daily-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">QC Daily Production View</h1>
        <Link href="/qc-daily-production" className="btn btn-secondary">Back</Link>
      </div>

      <div className="rounded border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Info label="Timestamp" value={fmtTs(submission.entryTs)} />
        <Info label="Entry Date" value={submission.entryDate} />
        <Info label="Name" value={submission.name} />
        <Info label="Employee #" value={submission.employeeNumber} />
        <Info label="Sales Order" value={submission.salesOrder} />
        <div className="md:col-span-3">
          <Info label="Header Notes" value={submission.notes || ""} />
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-base font-semibold">Lines</h2>
          <div className="text-sm text-gray-600">
            Order Qty: <b>{totals.orderQty}</b> · Inspected: <b>{totals.inspected}</b> · Rejected: <b>{totals.rejected}</b> · Shipped: <b>{totals.shipped}</b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[1000px]">
            <thead>
              <tr>
                <Th>Detail #</Th>
                <Th>Flat / 3D</Th>
                <Th>Order Qty</Th>
                <Th>Inspected Qty</Th>
                <Th>Rejected Qty</Th>
                <Th>Qty Shipped</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <Td>{line.detailNumber ?? ""}</Td>
                  <Td>{line.flatOr3d ?? ""}</Td>
                  <Td>{line.orderQuantity ?? ""}</Td>
                  <Td>{line.inspectedQuantity ?? ""}</Td>
                  <Td>{line.rejectedQuantity ?? ""}</Td>
                  <Td>{line.quantityShipped ?? ""}</Td>
                  <Td>{line.notes ?? ""}</Td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <Td colSpan={7}>No lines found.</Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm">{value ?? ""}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left border-b bg-gray-50 px-3 py-2 whitespace-nowrap">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b px-3 py-2 align-top">{children}</td>;
}