// app/daily-production/[id]/page.tsx
"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";

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
  salesOrder: string | number | null;
  salesOrderBase?: string | null;
  salesOrderDisplay?: string | null;
  annex: boolean;
  notes: string | null;
  isVoided?: boolean;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
};

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
};

const VOID_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function fmtTs(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function roleOf(me: MeResponse | null): string {
  return String(me?.role ?? "").trim().toUpperCase();
}

function canVoid(me: MeResponse | null): boolean {
  return VOID_ROLES.has(roleOf(me));
}

export default function DailyProductionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<DailySubmission | null>(null);
  const [lines, setLines] = useState<DailyLine[]>([]);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [meRes, submissionRes] = await Promise.all([
        fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(
          `/api/daily-production-submission?id=${encodeURIComponent(id)}&includeVoided=true`,
          {
            cache: "no-store",
            credentials: "include",
          }
        ),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json().catch(() => null);
        setMe(meData);
      }

      const data = await submissionRes.json().catch(() => ({}));

      if (!submissionRes.ok) {
        throw new Error(data?.error || "Failed to load submission");
      }

      setSubmission(data?.submission ?? null);
      setLines(Array.isArray(data?.lines) ? data.lines : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function onVoid() {
    if (!submission) return;

    const reason = window.prompt(
      "Enter a reason for voiding this embroidery submission:"
    );

    if (reason === null) return;

    const trimmedReason = reason.trim();

    const ok = window.confirm(
      trimmedReason
        ? `Void this embroidery submission?\n\nReason: ${trimmedReason}`
        : "Void this embroidery submission?"
    );

    if (!ok) return;

    try {
      setVoiding(true);
      setError(null);

      const res = await fetch(
        `/api/daily-production-submission/${encodeURIComponent(submission.id)}/void`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reason: trimmedReason || null,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to void submission.");
      }

      router.push("/daily-production");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to void submission.");
    } finally {
      setVoiding(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Daily Production View</h1>
        <div className="alert alert-danger">{error}</div>
        <Link href="/daily-production" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Daily Production View</h1>
        <div className="alert alert-danger">Not found.</div>
        <Link href="/daily-production" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }

  const isVoided = !!submission.isVoided;
  const showVoidButton = canVoid(me) && !isVoided;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Daily Production View</h1>
          {isVoided ? (
            <div className="mt-2">
              <span className="badge badge-danger">VOIDED</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/daily-production" className="btn btn-secondary">
            Back
          </Link>

          {!isVoided ? (
            <Link
              href={`/daily-production/${encodeURIComponent(submission.id)}/edit`}
              className="btn btn-primary"
            >
              Edit
            </Link>
          ) : null}

          {showVoidButton ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onVoid}
              disabled={voiding}
            >
              {voiding ? "Voiding..." : "Void Entry"}
            </button>
          ) : null}
        </div>
      </div>

      {isVoided ? (
        <div className="alert alert-danger">
          <strong>This submission has been voided.</strong>
          <div style={{ marginTop: 6 }}>
            {submission.voidedBy ? <>Voided By: {submission.voidedBy}</> : null}
            {submission.voidedAt ? <> · Voided At: {fmtTs(submission.voidedAt)}</> : null}
          </div>
          {submission.voidReason ? (
            <div style={{ marginTop: 6 }}>Reason: {submission.voidReason}</div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Info label="Timestamp" value={fmtTs(submission.entryTs)} />
        <Info label="Name" value={submission.name} />
        <Info label="Employee #" value={submission.employeeNumber} />
        <Info label="Shift" value={submission.shift} />
        <Info label="Machine" value={submission.machineNumber} />
        <Info
          label="Sales Order"
          value={
            submission.salesOrderDisplay ??
            submission.salesOrderBase ??
            submission.salesOrder
          }
        />
        <Info label="Annex" value={submission.annex ? "Yes" : "No"} />
        <Info label="Voided" value={isVoided ? "Yes" : "No"} />
        <div className="md:col-span-3">
          <Info label="Header Notes" value={submission.notes || ""} />
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-base font-semibold">Lines</h2>
          <div className="text-sm text-gray-600">
            Total Pieces: <b>{totals.pieces}</b> · Total Stitches:{" "}
            <b>{totals.stitches}</b>
            {submission.annex ? (
              <>
                {" "}
                · Samples Ran: <b>{totals.samples}</b>
              </>
            ) : null}
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

      <ActivityHistoryPanel
        entityType="embroidery_daily_submissions"
        entityId={submission.id}
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