// app/quick-turn-quote-calculator/SavedQuickTurnQuotePrintClient.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SavedQuickTurnQuoteDetail } from "./types";
import { SavedQuickTurnQuoteResults, SavedQuoteMeta } from "./QuickTurnQuoteResults";
import { fmtDateOnly } from "./format";

export default function SavedQuickTurnQuotePrintClient({ id }: { id: string }) {
  const [row, setRow] = useState<SavedQuickTurnQuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}?includeVoided=true`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load saved Quick Turn quote.");
        }

        setRow(data?.row ?? null);
      } catch (err: any) {
        setError(err?.message || "Failed to load saved Quick Turn quote.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <main className="record-shell">
        <div className="card">Loading print preview…</div>
      </main>
    );
  }

  if (error || !row) {
    return (
      <main className="record-shell">
        <div className="alert alert-danger">{error || "Saved Quick Turn quote not found."}</div>
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
            {row.quoteName} · Generated quote output · Valid through {fmtDateOnly(row.validUntil)}
          </p>
          <div className="record-badge-row">
            <span className="record-pill record-pill-info">{row.programName} / {row.factoryName}</span>
            {row.isVoided ? <span className="record-pill record-pill-danger">Voided</span> : null}
          </div>
        </div>

        <div className="record-actions no-print">
          <Link href={`/quick-turn-quote-calculator/saved/${encodeURIComponent(row.id)}`} className="btn btn-secondary">
            Back
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

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
