// app/quick-turn-quote-calculator/SavedQuickTurnQuoteClient.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SavedQuickTurnQuoteDetail } from "./types";
import { SavedQuickTurnQuoteResults, SavedQuoteMeta } from "./QuickTurnQuoteResults";
import { fmtDateOnly } from "./format";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  department?: string | null;
};

function normalizeToken(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export default function SavedQuickTurnQuoteClient({ id }: { id: string }) {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [row, setRow] = useState<SavedQuickTurnQuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = normalizeToken(me?.role) === "ADMIN" || normalizeToken(me?.username) === "ADMIN";

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [meRes, quoteRes] = await Promise.all([
        fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}?includeVoided=true`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (meRes.ok) {
        setMe(await meRes.json().catch(() => null));
      }

      const data = await quoteRes.json().catch(() => ({}));
      if (!quoteRes.ok) {
        throw new Error(data?.error || "Failed to load saved Quick Turn quote.");
      }

      setRow(data?.row ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load saved Quick Turn quote.");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function onVoid() {
    if (!row || row.isVoided) return;

    const reason = window.prompt("Enter a reason for voiding this saved Quick Turn quote:");
    if (reason === null) return;

    if (!window.confirm("Void this saved Quick Turn quote? This will remove it from normal saved quote lists.")) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(row.id)}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to void saved Quick Turn quote.");
      }

      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to void saved Quick Turn quote.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onUnvoid() {
    if (!row || !row.isVoided) return;
    if (!window.confirm("Restore this voided saved Quick Turn quote?")) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(row.id)}/unvoid`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to unvoid saved Quick Turn quote.");
      }

      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to unvoid saved Quick Turn quote.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="record-shell">
        <div className="card">Loading saved Quick Turn quote…</div>
      </main>
    );
  }

  if (error && !row) {
    return (
      <main className="record-shell">
        <div className="alert alert-danger">{error}</div>
        <div style={{ marginTop: 12 }}>
          <Link href="/quick-turn-quote-calculator/saved" className="btn btn-secondary">
            Back to Saved Quotes
          </Link>
        </div>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="record-shell">
        <div className="alert alert-warning">Saved Quick Turn quote not found.</div>
        <div style={{ marginTop: 12 }}>
          <Link href="/quick-turn-quote-calculator/saved" className="btn btn-secondary">
            Back to Saved Quotes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="record-shell">
      <div className="record-header">
        <div className="record-header-main">
          <div className="record-kicker">Overseas / Quick Turn Quote Calculator</div>
          <h1 className="record-title">{row.quoteNumber}</h1>
          <p className="record-subtitle">
            {row.quoteName} · Valid through {fmtDateOnly(row.validUntil)}
          </p>
          <div className="record-badge-row">
            <span className="record-pill record-pill-info">{row.programName} / {row.factoryName}</span>
            {row.isVoided ? <span className="record-pill record-pill-danger">Voided</span> : null}
          </div>
        </div>

        <div className="record-actions">
          <Link href="/quick-turn-quote-calculator/saved" className="btn btn-secondary">
            Back
          </Link>
          <Link href="/quick-turn-quote-calculator" className="btn btn-secondary">
            New Quote
          </Link>
          <Link
            href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(row.id)}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Print / Preview
          </Link>
          {!row.isVoided ? (
            <button type="button" className="btn btn-danger" disabled={actionLoading} onClick={onVoid}>
              Void
            </button>
          ) : null}
          {row.isVoided && isAdmin ? (
            <button type="button" className="btn btn-secondary" disabled={actionLoading} onClick={onUnvoid}>
              Unvoid
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {row.isVoided ? (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          This saved Quick Turn quote is voided.
          {row.voidReason ? ` Reason: ${row.voidReason}` : ""}
        </div>
      ) : null}

      <section className="record-section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Quote Details</h2>
        </div>
        <SavedQuoteMeta row={row} />
      </section>

      <SavedQuickTurnQuoteResults row={row} />
    </main>
  );
}
