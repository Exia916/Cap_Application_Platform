// app/laser-production/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LaserRow = {
  id: string;
  entry_date: string;
  sales_order: string | number | null;
  leather_style_color: string | null;
  pieces_cut: number | null;
  notes: string | null;
};

import { use } from "react";

export default function LaserProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<LaserRow | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/laser-production-entry?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to load entry");

        if (!alive) return;
        setRow(data?.row ?? null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load entry");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Laser Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        <Link href="/laser-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Laser Production View</h1>
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">Not found.</div>
        <Link href="/laser-production" className="btn btn-secondary">Back</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Laser Production View</h1>
        <Link href="/laser-production" className="btn btn-secondary">Back</Link>
      </div>

      <div className="rounded border p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="Entry Date" value={row.entry_date} />
        <Info label="Sales Order" value={row.sales_order} />
        <Info label="Leather Style / Color" value={row.leather_style_color} />
        <Info label="Pieces Cut" value={row.pieces_cut} />
        <div className="md:col-span-2">
          <Info label="Notes" value={row.notes || ""} />
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