// app/daily-production/[id]/page.tsx
"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type DailyLine = {
  id: string;
  detailNumber: number | null;
  embroideryLocation: string | null;
  stitches: number | null;
  pieces: number | null;
  jobberSamplesRan?: number | null;
  is3d: boolean;
  isKnit: boolean;
  detailComplete: boolean;
  notes: string | null;
};

type DailySubmission = {
  id: string;
  entryTs: string;
  name: string;
  employeeNumber: number;
  shift: string;
  machineNumber: number | null;
  salesOrder: number | null;
  annex: boolean;
  notes: string | null;
};

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

export default function DailyProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<DailySubmission | null>(null);
  const [lines, setLines] = useState<DailyLine[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/daily-production-submission?id=${encodeURIComponent(id)}`, {
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
        acc.stitches += Number(line.stitches || 0);
        acc.pieces += Number(line.pieces || 0);
        acc.samples += Number(line.jobberSamplesRan || 0);
        return acc;
      },
      { stitches: 0, pieces: 0, samples: 0 }
    );
  }, [lines]);

  if (loading) return <div className="p-6">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Daily Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <Link href="/daily-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Daily Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Not found.</div>
        <Link href="/daily-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Daily Production View</h1>
        <Link href="/daily-production" className="btn btn-secondary">Back</Link>
      </div>

      <div className="rounded border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Info label="Timestamp" value={fmtTs(submission.entryTs)} />
        <Info label="Name" value={submission.name} />
        <Info label="Employee #" value={submission.employeeNumber} />
        <Info label="Shift" value={submission.shift} />
        <Info label="Machine" value={submission.machineNumber} />
        <Info label="Sales Order" value={submission.salesOrder} />
        <Info label="Annex" value={submission.annex ? "Yes" : "No"} />
        <div className="md:col-span-3">
          <Info label="Header Notes" value={submission.notes || ""} />
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-base font-semibold">Lines</h2>
          <div className="text-sm text-gray-600">
            Total Pieces: <b>{totals.pieces}</b> · Total Stitches: <b>{totals.stitches}</b>
            {submission.annex ? <> · Samples Ran: <b>{totals.samples}</b></> : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[1000px]">
            <thead>
              <tr>
                <Th>Detail #</Th>
                <Th>Location</Th>
                <Th>Stitches</Th>
                <Th>Pieces</Th>
                {submission.annex ? <Th>Samples Ran</Th> : null}
                <Th>3D</Th>
                <Th>Knit</Th>
                <Th>Complete</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <Td>{line.detailNumber ?? ""}</Td>
                  <Td>{line.embroideryLocation ?? ""}</Td>
                  <Td>{line.stitches ?? ""}</Td>
                  <Td>{line.pieces ?? ""}</Td>
                  {submission.annex ? <Td>{line.jobberSamplesRan ?? ""}</Td> : null}
                  <Td>{line.is3d ? "Yes" : "No"}</Td>
                  <Td>{line.isKnit ? "Yes" : "No"}</Td>
                  <Td>{line.detailComplete ? "Yes" : "No"}</Td>
                  <Td>{line.notes ?? ""}</Td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <Td colSpan={submission.annex ? 9 : 8}>No lines found.</Td>
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
  return (
    <td colSpan={colSpan} className="border-b px-3 py-2 align-top">
      {children}
    </td>
  );
}