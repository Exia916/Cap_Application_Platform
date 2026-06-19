// app/quick-turn-quote-calculator/QuickTurnCustomerExportPrintClient.tsx

"use client";

import { useEffect, useState } from "react";
import type { QuickTurnCustomerExportDetail } from "./types";

function fmtDate(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value)))
    return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function fmtMoney(value?: number | string | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function feeDisplayName(value?: string | null) {
  return String(value || "One-time fee").trim() || "One-time fee";
}

function fmtQty(value?: number | string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value === null || value === undefined ? "" : String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function quantityBreakDisplay(breakRow: { minQuantity?: number | null; maxQuantity?: number | null; breakLabel?: string | null }) {
  if (breakRow.maxQuantity !== null && breakRow.maxQuantity !== undefined) {
    return fmtQty(breakRow.maxQuantity);
  }
  if (breakRow.minQuantity !== null && breakRow.minQuantity !== undefined) {
    return `${fmtQty(breakRow.minQuantity)}+`;
  }
  return String(breakRow.breakLabel || "");
}

function itemNameDisplay(item: { baseItemCode?: string | null; isCustomCap?: boolean; customCapDescription?: string | null }) {
  const code = String(item.baseItemCode || "").trim();
  if (item.isCustomCap || code.toUpperCase() === "CUSTOM CAP" || code.toUpperCase() === "CUSTOM_CAP") {
    return "Custom Cap";
  }
  return code || "Item";
}

function CapAmericaCustomerLogo() {
  return (
    <svg
      className="qt-customer-logo-svg"
      viewBox="0 0 360 104"
      role="img"
      aria-label="Cap America"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="88" y="4" width="84" height="16" fill="#d51f2b" />
      <rect x="180" y="4" width="84" height="16" fill="#293e7d" />
      <text
        x="180"
        y="72"
        textAnchor="middle"
        fontFamily="Times New Roman, Times, serif"
        fontSize="48"
        fontWeight="600"
        letterSpacing="2"
        fill="#111111"
      >
        CAP AMERICA
      </text>
      <line x1="48" y1="82" x2="312" y2="82" stroke="#111111" strokeWidth="3" />
    </svg>
  );
}

export default function QuickTurnCustomerExportPrintClient({
  id,
}: {
  id: string;
}) {
  const [row, setRow] = useState<QuickTurnCustomerExportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/quick-turn-quote-calculator/quotes/${encodeURIComponent(id)}/customer-export?includeVoided=true&logPreview=true`,
          { cache: "no-store", credentials: "include" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data?.error || "Failed to load customer quote.");
        setRow(data?.row ?? null);
      } catch (err: any) {
        setError(err?.message || "Failed to load customer quote.");
        setRow(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="card">Loading customer quote…</div>
      </main>
    );
  }

  if (error || !row) {
    return (
      <main className="page-shell">
        <div className="alert alert-danger">
          {error || "Customer quote not found."}
        </div>
      </main>
    );
  }

  const isDraft = row.quoteStatus === "DRAFT" && !row.isVoided;
  const isVoided = row.isVoided;

  return (
    <main className="qt-customer-print-shell">
      <style>{`
        .qt-customer-print-shell {
          max-width: 7.75in;
          margin: 0 auto;
          padding: 18px;
          color: #111;
          background: #fff;
          font-family: "Times New Roman", Times, serif;
          position: relative;
        }
        .qt-customer-print-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-bottom: 14px;
          font-family: Arial, sans-serif;
        }
        .qt-customer-print-shell,
        .qt-customer-print-shell * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        .qt-customer-page {
          border: 0;
          position: relative;
          background: #fff;
        }
        .qt-customer-watermark {
          position: fixed;
          top: 38%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-26deg);
          font: 700 86px Arial, sans-serif;
          color: rgba(180, 0, 0, 0.14);
          letter-spacing: 10px;
          pointer-events: none;
          z-index: 10;
        }
        .qt-customer-header {
          display: grid;
          grid-template-columns: 1.35in minmax(0, 1fr) 1.15in;
          gap: 18px;
          align-items: start;
          margin-bottom: 16px;
        }
        .qt-header-label {
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
        }
        .qt-header-value {
          font-size: 12px;
          line-height: 1.25;
          margin-bottom: 10px;
          white-space: pre-wrap;
        }
        .qt-logo-wrap {
          text-align: center;
          padding-top: 4px;
        }
        .qt-customer-logo-svg {
          width: 2.85in;
          max-width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        .qt-prepared-grid {
          display: grid;
          grid-template-columns: 1.4fr 0.85fr 0.85fr;
          gap: 18px;
          margin: 12px 0 14px;
        }
        .qt-options-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 12px;
        }
        .qt-options-table th, .qt-options-table td {
          border: 2px solid #111;
          padding: 6px;
          vertical-align: top;
        }
        .qt-options-table th {
          text-align: center;
          font-weight: 700;
        }
        .qt-option-cell {
          width: 18%;
          text-align: center;
          font-weight: 700;
          vertical-align: middle !important;
        }
        .qt-option-label {
          margin-bottom: 8px;
        }
        .qt-description-cell {
          width: 24%;
          white-space: pre-wrap;
        }
        .qt-item-name {
          font-weight: 700;
          margin-bottom: 6px;
        }
        .qt-item-description {
          white-space: pre-wrap;
        }
        .qt-break-line {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          border-bottom: 1px solid #111;
          font-weight: 700;
          text-align: center;
          padding: 2px 0;
        }
        .qt-break-line:last-child { border-bottom: 0; }
        .qt-photo {
          margin-top: 10px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 110px;
        }
        .qt-option-cell .qt-photo {
          margin-top: 8px;
          min-height: 0;
        }
        .qt-photo img {
          max-width: 1.55in;
          max-height: 1.15in;
          object-fit: contain;
        }
        .qt-factory {
          margin-top: 6px;
          text-align: center;
          font-size: 13px;
        }
        .qt-notes-cell {
          white-space: pre-wrap;
          line-height: 1.25;
        }
        .qt-note-block + .qt-note-block {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #777;
        }
        .qt-note-fee-title {
          font-weight: 700;
        }
        .qt-footer-band {
          height: 14px;
          background: #c9c9c9;
          margin-top: 0;
        }
        .qt-footer {
          padding: 8px 4px 0;
          font-size: 12px;
        }
        .qt-footer-title {
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .qt-footer-text {
          margin-left: 18px;
          white-space: pre-wrap;
        }
        .qt-setup-warning {
          border: 1px solid #c88;
          background: #fff4f4;
          padding: 10px;
          margin-bottom: 12px;
          font-family: Arial, sans-serif;
        }
        @media print {
          @page {
            size: letter portrait;
            margin: 0.3in;
          }
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > nav,
          nav {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden !important;
          }
          .qt-customer-print-shell,
          .qt-customer-print-shell * {
            visibility: visible !important;
          }
          .qt-customer-print-shell {
            position: absolute;
            top: 0;
            left: 0;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .qt-customer-print-actions {
            display: none !important;
          }
          .qt-customer-page {
            width: 100%;
          }
          .qt-customer-header {
            grid-template-columns: 1.25in minmax(0, 1fr) 1.05in;
            gap: 0.12in;
            margin-bottom: 0.12in;
          }
          .qt-customer-logo-svg {
            width: 2.65in;
          }
          .qt-prepared-grid {
            gap: 0.12in;
            margin: 0.08in 0 0.12in;
          }
          .qt-options-table {
            font-size: 10.5px;
          }
          .qt-options-table th,
          .qt-options-table td {
            padding: 4px;
          }
          .qt-option-cell {
            width: 15%;
          }
          .qt-description-cell {
            width: 22%;
          }
          .qt-photo {
            min-height: 0.8in;
            margin-top: 6px;
          }
          .qt-option-cell .qt-photo {
            min-height: 0;
            margin-top: 0.06in;
          }
          .qt-photo img {
            max-width: 1.25in;
            max-height: 0.95in;
          }
          .qt-options-table th,
          .qt-options-table td {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="qt-customer-print-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.close()}
        >
          Close
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </div>

      {isDraft ? <div className="qt-customer-watermark">DRAFT</div> : null}
      {isVoided ? <div className="qt-customer-watermark">VOIDED</div> : null}

      {!row.exists ? (
        <div className="qt-setup-warning">
          Customer quote setup has not been saved yet. Default values are being
          shown for preview only.
        </div>
      ) : null}

      <div className="qt-customer-page">
        <header className="qt-customer-header">
          <div>
            <div className="qt-header-label">Quote #</div>
            <div className="qt-header-value">
              {row.quoteName || row.quoteNumber}
              {row.workflowSalesOrderNumber
                ? `\n${row.workflowSalesOrderNumber}`
                : ""}
            </div>
          </div>

          <div className="qt-logo-wrap">
            <CapAmericaCustomerLogo />
          </div>

          <div>
            <div className="qt-header-label">Date</div>
            <div className="qt-header-value">{fmtDate(row.generatedAt)}</div>
            <div className="qt-header-label">Expiration Date</div>
            <div className="qt-header-value">{fmtDate(row.validUntil)}</div>
          </div>
        </header>

        <section className="qt-prepared-grid">
          <div>
            <div className="qt-header-label">Quote Prepared For</div>
            <div className="qt-header-value">
              {row.quotePreparedForDisplay || "—"}
            </div>
          </div>
          <div>
            <div className="qt-header-label">Program Logo</div>
            <div className="qt-header-value">{row.programLogoText || "—"}</div>
          </div>
          <div>
            <div className="qt-header-label">CAP America Program</div>
            <div className="qt-header-value">
              {row.capProgramName || "Quick Turn"}
            </div>
          </div>
        </section>

        <table className="qt-options-table">
          <thead>
            <tr>
              <th colSpan={2}>Description</th>
              <th>
                Qty
                <br />
                Net Price
              </th>
              <th>
                Sample
                <br />
                Production
              </th>
              <th>
                Production
                <br />
                Time
              </th>
              <th>FOB</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {row.items.map((item) => (
              <tr key={item.quoteItemId}>
                <td className="qt-option-cell">
                  <div className="qt-option-label">{item.optionLabel || "Option"}</div>
                  {item.imageAttachmentId ? (
                    <div className="qt-photo">
                      <img
                        src={`/api/platform/attachments/${item.imageAttachmentId}`}
                        alt={
                          item.imageAttachment?.originalFileName ||
                          item.optionLabel ||
                          "Quote item photo"
                        }
                      />
                    </div>
                  ) : null}
                  {item.factoryDisplay ? (
                    <div className="qt-factory">
                      Factory {item.factoryDisplay}
                    </div>
                  ) : null}
                </td>
                <td className="qt-description-cell">
                  <div className="qt-item-name">{itemNameDisplay(item)}</div>
                  <div className="qt-item-description">
                    {item.customerDescription ||
                      item.customCapDescription ||
                      item.baseItemDescription ||
                      ""}
                  </div>
                </td>
                <td>
                  {item.selectedBreaks.length ? (
                    item.selectedBreaks.map((breakRow) => (
                      <div className="qt-break-line" key={breakRow.resultId}>
                        <span>{quantityBreakDisplay(breakRow)}</span>
                        <span>{fmtMoney(breakRow.unitPrice)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="qt-break-line">
                      <span>—</span>
                      <span>—</span>
                    </div>
                  )}
                </td>
                <td>{row.sampleProductionDetails || "—"}</td>
                <td>{row.productionTimeDetails || "—"}</td>
                <td>{row.fob || "1 U.S. Final Destination"}</td>
                <td className="qt-notes-cell">
                  {item.customerNotes ? (
                    <div className="qt-note-block">{item.customerNotes}</div>
                  ) : null}
                  {item.oneTimeFees?.length ? (
                    <div className="qt-note-block">
                      {item.oneTimeFees.map((fee) => (
                        <div key={fee.id}>
                          <span className="qt-note-fee-title">
                            {fmtMoney(fee.amount)}
                          </span>{" "}
                          {feeDisplayName(fee.feeName)}
                          {fee.notes ? ` — ${fee.notes}` : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="qt-footer-band" />
        <footer className="qt-footer">
          <div className="qt-footer-title">Customer Service Contact:</div>
          <div className="qt-footer-text">
            {row.customerServiceContact || "—"}
          </div>
          <div className="qt-footer-title">Additional Information:</div>
          <div className="qt-footer-text">
            {row.additionalInformation || ""}
          </div>
        </footer>
      </div>
    </main>
  );
}
