"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";

type MeResponse = {
  role?: string | null;
};

type QCSubmission = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  salesOrder: string | null;
  salesOrderBase?: string | null;
  salesOrderDisplay?: string | null;
  notes: string | null;
  isVoided?: boolean | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
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

function yesNo(v: boolean | null | undefined) {
  if (v == null) return "";
  return v ? "Yes" : "No";
}

export default function QCDailyProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<QCSubmission | null>(null);
  const [lines, setLines] = useState<QCLine[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [submissionRes, meRes] = await Promise.all([
          fetch(
            `/api/qc-daily-production-submission?id=${encodeURIComponent(
              id
            )}&includeVoided=true`,
            {
              cache: "no-store",
              credentials: "include",
            }
          ),
          fetch("/api/me", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const submissionData = await submissionRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({}));

        if (!submissionRes.ok) {
          throw new Error(submissionData?.error || "Failed to load submission");
        }

        if (!alive) return;

        setSubmission(submissionData?.submission ?? null);
        setLines(
          Array.isArray(submissionData?.lines) ? submissionData.lines : []
        );
        setMe(meRes.ok ? meData : null);
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

  const role = String(me?.role ?? "").trim().toUpperCase();
  const canVoid =
    role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR";

  async function handleVoid() {
    if (!submission?.id || voiding) return;

    const reason =
      window.prompt(
        "Enter a reason for voiding this QC submission (optional):",
        ""
      ) ?? "";

    const confirmed = window.confirm(
      "Void this QC submission?\n\nIt will be hidden from standard lists and reports by default, but kept in the database for audit history."
    );

    if (!confirmed) return;

    setVoiding(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/qc-daily-production-submission/${encodeURIComponent(
          submission.id
        )}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reason }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Failed to void QC submission.");
        return;
      }

      router.push("/qc-daily-production");
      router.refresh();
    } catch {
      setError("Failed to void QC submission.");
    } finally {
      setVoiding(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">QC Daily Production View</h1>
        <div className="alert alert-danger">{error}</div>
        <Link href="/qc-daily-production" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">QC Daily Production View</h1>
        <div className="alert alert-danger">Not found.</div>
        <Link href="/qc-daily-production" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">QC Daily Production View</h1>

        <div className="flex flex-wrap gap-2">
          <Link href="/qc-daily-production" className="btn btn-secondary">
            Back
          </Link>

          {!submission.isVoided ? (
            <Link
              href={`/qc-daily-production/${submission.id}/edit`}
              className="btn btn-primary"
            >
              Edit
            </Link>
          ) : null}

          {canVoid && !submission.isVoided ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={voiding}
              onClick={handleVoid}
            >
              {voiding ? "Voiding..." : "Void Submission"}
            </button>
          ) : null}
        </div>
      </div>

      {submission.isVoided ? (
        <div className="alert alert-danger">
          This QC submission has been voided.
          {submission.voidedAt ? ` Voided ${fmtTs(submission.voidedAt)}` : ""}
          {submission.voidedBy ? ` by ${submission.voidedBy}.` : "."}
          {submission.voidReason ? ` Reason: ${submission.voidReason}` : ""}
        </div>
      ) : null}

      <div className="rounded border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Info label="Timestamp" value={fmtTs(submission.entryTs)} />
        <Info label="Entry Date" value={submission.entryDate} />
        <Info label="Name" value={submission.name} />
        <Info label="Employee #" value={submission.employeeNumber} />
        <Info
          label="Sales Order"
          value={submission.salesOrder ?? submission.salesOrderDisplay ?? ""}
        />
        <Info label="Voided" value={yesNo(submission.isVoided)} />

        {submission.isVoided ? (
          <>
            <Info label="Voided At" value={fmtTs(submission.voidedAt)} />
            <Info label="Voided By" value={submission.voidedBy ?? ""} />
            <div className="md:col-span-3">
              <Info label="Void Reason" value={submission.voidReason ?? ""} />
            </div>
          </>
        ) : null}

        <div className="md:col-span-3">
          <Info label="Header Notes" value={submission.notes || ""} />
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-base font-semibold">Lines</h2>
          <div className="text-sm text-gray-600">
            Order Qty: <b>{totals.orderQty}</b> · Inspected:{" "}
            <b>{totals.inspected}</b> · Rejected: <b>{totals.rejected}</b> ·
            Shipped: <b>{totals.shipped}</b>
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

      <ActivityHistoryPanel
        entityType="qc_daily_submissions"
        entityId={String(submission.id)}
        title="Activity History"
        defaultExpanded={false}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-sm">{value ?? ""}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left border-b bg-gray-50 px-3 py-2 whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className="border-b px-3 py-2 align-top">
      {children}
    </td>
  );
}