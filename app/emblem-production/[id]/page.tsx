// app/emblem-production/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EmblemHeader = {
  id: string;
  entry_date: string;
  sales_order: string | number | null;
  name?: string | null;
  employee_number?: number | null;
  notes?: string | null;
};

type EmblemLine = {
  id?: string;
  detail_number: number | null;
  emblem_type: string | null;
  logo_name: string | null;
  pieces: number | null;
  line_notes: string | null;
};

import { use } from "react";

export default function EmblemProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [header, setHeader] = useState<EmblemHeader | null>(null);
  const [lines, setLines] = useState<EmblemLine[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/emblem-production-submissions?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load submission");

        if (!alive) return;
        setHeader(data?.header ?? null);
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

  const totalPieces = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.pieces || 0), 0),
    [lines]
  );

  if (loading) return <div className="p-6">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Emblem Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <Link href="/emblem-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  if (!header) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Emblem Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Not found.</div>
        <Link href="/emblem-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Emblem Production View</h1>
        <Link href="/emblem-production" className="btn btn-secondary">Back</Link>
      </div>

      <div className="rounded border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Info label="Entry Date" value={header.entry_date} />
        <Info label="Sales Order" value={header.sales_order} />
        <Info label="Total Pieces" value={totalPieces} />
        <div className="md:col-span-3">
          <Info label="Header Notes" value={header.notes || ""} />
        </div>
      </div>

      <div className="rounded border p-4">
        <h2 className="text-base font-semibold mb-4">Lines</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[900px]">
            <thead>
              <tr>
                <Th>Detail #</Th>
                <Th>Emblem Type</Th>
                <Th>Logo Name</Th>
                <Th>Pieces</Th>
                <Th>Line Notes</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.id ?? idx}>
                  <Td>{line.detail_number ?? ""}</Td>
                  <Td>{line.emblem_type ?? ""}</Td>
                  <Td>{line.logo_name ?? ""}</Td>
                  <Td>{line.pieces ?? ""}</Td>
                  <Td>{line.line_notes ?? ""}</Td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <Td colSpan={5}>No lines found.</Td>
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