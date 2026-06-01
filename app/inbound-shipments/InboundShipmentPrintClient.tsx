"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

type ShipmentDetail = {
  id: string;
  inboundShipmentNumber: string;

  statusId: number;
  statusCode: string;
  statusLabel: string;
  status: string;

  mblNumber: string | null;
  hblNumber: string | null;
  containerNumber: string | null;
  sealNumber: string | null;
  port: string | null;
  carrier: string | null;
  forwarder: string | null;
  shipmentType: string | null;
  containerDestination: string | null;
  etd: string | null;
  eta: string | null;
  cartonCount: number | null;
  notes: string | null;

  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;

  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;

  lines: Array<{
    id: string;
    poNumber: string | null;
    customerId: string | null;
    customerName: string | null;
    logo: string | null;
    tracking: string | null;
    lineDestination: string | null;
    quantity: number | null;
    cartonCount: number | null;
    notes: string | null;
  }>;

  invoices: Array<{
    id: string;
    invoiceNumber: string | null;
    invoiceTypeId: number | null;
    invoiceTypeCode: string | null;
    invoiceTypeLabel: string | null;
    invoiceType: string | null;
    invoiceDate: string | null;
    amount: number | null;
    notes: string | null;
  }>;
};

function fmtDateOnly(v?: string | null): string {
  if (!v) return "";
  const s = String(v);

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

function fmtDateTime(v?: string | null): string {
  if (!v) return "";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);

  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMoney(v?: number | null): string {
  if (v == null || !Number.isFinite(Number(v))) return "";

  return Number(v).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function display(v: ReactNode) {
  if (v === null || v === undefined || v === "") return "—";
  return v;
}

function PrintField({
  label,
  value,
  full,
  pre,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
  pre?: boolean;
}) {
  return (
    <div className={full ? "print-field print-field-full" : "print-field"}>
      <div className="print-field-label">{label}</div>
      <div className={pre ? "print-field-value print-field-pre" : "print-field-value"}>
        {display(value)}
      </div>
    </div>
  );
}

function StatusPill({ row }: { row: ShipmentDetail }) {
  const code = String(row.statusCode || "").toUpperCase();

  let className = "print-status-pill";

  if (code === "CUSTOMS_HOLD") className += " print-status-danger";
  else if (code === "DELIVERED" || code === "RECEIVED_CLOSED") {
    className += " print-status-success";
  } else if (code === "ARRIVED_AT_PORT" || code === "CUSTOMS_CLEARED") {
    className += " print-status-warning";
  } else {
    className += " print-status-info";
  }

  return <span className={className}>{row.statusLabel || row.status || "—"}</span>;
}

export default function InboundShipmentPrintClient({ id }: { id: string }) {
  const [row, setRow] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const printedAt = useMemo(() => fmtDateTime(new Date().toISOString()), []);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/inbound-shipments/${encodeURIComponent(id)}?includeVoided=true`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load inbound shipment.");
      }

      setRow(data?.row ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load inbound shipment.");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="card">
          <div className="text-muted">Loading print preview…</div>
        </div>
      </main>
    );
  }

  if (error || !row) {
    return (
      <main className="page-shell">
        <div className="alert alert-danger">
          {error || "Inbound shipment not found."}
        </div>

        <div style={{ marginTop: 12 }}>
          <Link href="/inbound-shipments" className="btn btn-secondary">
            Back to Inbound Shipments
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="print-page-wrap">
      <style>{`
        .print-page-wrap {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .print-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .print-action-left,
        .print-action-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .print-page {
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow-sm);
          padding: 28px;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          border-bottom: 2px solid #111111;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }

        .print-title-block {
          display: grid;
          gap: 4px;
        }

        .print-kicker {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #555555;
        }

        .print-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
          color: #111111;
        }

        .print-subtitle {
          color: #555555;
          font-size: 13px;
        }

        .print-header-meta {
          text-align: right;
          display: grid;
          gap: 6px;
          min-width: 220px;
        }

        .print-header-meta-line {
          font-size: 12px;
          color: #333333;
        }

        .print-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .print-status-pill,
        .print-void-pill {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid #999999;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.2;
          white-space: nowrap;
        }

        .print-status-info {
          background: rgba(34, 68, 139, 0.08);
          border-color: rgba(34, 68, 139, 0.25);
          color: #22448b;
        }

        .print-status-success {
          background: #eef8f4;
          border-color: #b9ddd0;
          color: #0f5132;
        }

        .print-status-warning {
          background: #fff7e8;
          border-color: #f4d39b;
          color: #8a5a12;
        }

        .print-status-danger,
        .print-void-pill {
          background: #fdf0f0;
          border-color: #efc4c6;
          color: #8f1d22;
        }

        .print-section {
          break-inside: avoid;
          page-break-inside: avoid;
          margin-top: 18px;
        }

        .print-section-title {
          margin: 0 0 10px;
          font-size: 16px;
          color: #111111;
          border-bottom: 1px solid #d8d1c3;
          padding-bottom: 6px;
        }

        .print-field-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px 14px;
        }

        .print-field {
          min-width: 0;
        }

        .print-field-full {
          grid-column: 1 / -1;
        }

        .print-field-label {
          font-size: 10px;
          font-weight: 800;
          color: #555555;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }

        .print-field-value {
          font-size: 13px;
          color: #111111;
          min-height: 18px;
          word-break: break-word;
        }

        .print-field-pre {
          white-space: pre-wrap;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
        }

        .print-table th {
          background: #f5f1e5;
          color: #111111;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid #cfc6b6;
          padding: 6px;
          text-align: left;
          vertical-align: top;
        }

        .print-table td {
          border: 1px solid #d8d1c3;
          padding: 6px;
          vertical-align: top;
          color: #111111;
          word-break: break-word;
        }

        .print-empty {
          border: 1px solid #d8d1c3;
          background: #fbfaf7;
          padding: 10px;
          color: #555555;
          font-size: 12px;
        }

        .print-footer {
          margin-top: 20px;
          border-top: 1px solid #d8d1c3;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #555555;
          font-size: 11px;
        }

        @media print {
          @page {
            size: landscape;
            margin: 0.35in;
          }

          html,
          body {
            background: #ffffff !important;
          }

          nav,
          .print-actions {
            display: none !important;
          }

          .print-page-wrap {
            max-width: none;
            padding: 0;
          }

          .print-page {
            border: 0;
            border-radius: 0;
            box-shadow: none;
            padding: 0;
          }

          .print-header {
            margin-bottom: 12px;
            padding-bottom: 10px;
          }

          .print-section {
            margin-top: 12px;
          }

          .print-field-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px 12px;
          }

          .print-table {
            font-size: 10px;
          }

          .print-table th,
          .print-table td {
            padding: 4px;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        @media screen and (max-width: 900px) {
          .print-header {
            flex-direction: column;
          }

          .print-header-meta {
            text-align: left;
          }

          .print-field-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media screen and (max-width: 640px) {
          .print-field-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="print-actions">
        <div className="print-action-left">
          <Link
            href={`/inbound-shipments/${encodeURIComponent(row.id)}`}
            className="btn btn-secondary"
          >
            Back to Record
          </Link>

          <Link href="/inbound-shipments" className="btn btn-secondary">
            Back to List
          </Link>
        </div>

        <div className="print-action-right">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <article className="print-page">
        <header className="print-header">
          <div className="print-title-block">
            <div className="print-kicker">Logistics / Inbound Shipments</div>
            <h1 className="print-title">{row.inboundShipmentNumber}</h1>

            <div className="print-subtitle">
              {row.containerNumber ? `CNTR # ${row.containerNumber}` : "No container number"}
              {row.eta ? ` · ETA ${fmtDateOnly(row.eta)}` : ""}
              {row.containerDestination ? ` · ${row.containerDestination}` : ""}
            </div>

            <div className="print-status-row">
              <StatusPill row={row} />
              {row.isVoided ? <span className="print-void-pill">Voided</span> : null}
            </div>
          </div>

          <div className="print-header-meta">
            <div className="print-header-meta-line">
              <strong>Printed:</strong> {printedAt}
            </div>
            <div className="print-header-meta-line">
              <strong>Created:</strong> {fmtDateTime(row.createdAt)}
            </div>
            <div className="print-header-meta-line">
              <strong>Created By:</strong> {row.createdBy || "—"}
            </div>
            <div className="print-header-meta-line">
              <strong>Updated:</strong> {fmtDateTime(row.updatedAt)}
            </div>
          </div>
        </header>

        {row.isVoided ? (
          <section className="print-section">
            <h2 className="print-section-title">Void Information</h2>
            <div className="print-field-grid">
              <PrintField label="Voided At" value={fmtDateTime(row.voidedAt)} />
              <PrintField label="Voided By" value={row.voidedBy} />
              <PrintField label="Void Reason" value={row.voidReason} full pre />
            </div>
          </section>
        ) : null}

        <section className="print-section">
          <h2 className="print-section-title">Submission Details</h2>

          <div className="print-field-grid">
            <PrintField label="Inbound Shipment #" value={row.inboundShipmentNumber} />
            <PrintField label="Status" value={row.statusLabel || row.status} />
            <PrintField label="CNTR #" value={row.containerNumber} />
            <PrintField label="Seal #" value={row.sealNumber} />

            <PrintField label="MBL #" value={row.mblNumber} />
            <PrintField label="HBL #" value={row.hblNumber} />
            <PrintField label="Port" value={row.port} />
            <PrintField label="Carrier" value={row.carrier} />

            <PrintField label="Forwarder" value={row.forwarder} />
            <PrintField label="Shipment Type" value={row.shipmentType} />
            <PrintField label="Container Destination" value={row.containerDestination} />
            <PrintField label="Carton Count" value={row.cartonCount} />

            <PrintField label="ETD" value={fmtDateOnly(row.etd)} />
            <PrintField label="ETA" value={fmtDateOnly(row.eta)} />
            <PrintField label="Updated By" value={row.updatedBy} />
            <PrintField label="Updated At" value={fmtDateTime(row.updatedAt)} />

            <PrintField label="Notes" value={row.notes} full pre />
          </div>
        </section>

        <section className="print-section">
          <h2 className="print-section-title">Invoice Details</h2>

          {row.invoices.length === 0 ? (
            <div className="print-empty">No invoice rows entered.</div>
          ) : (
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Invoice #</th>
                  <th style={{ width: "22%" }}>Invoice Type</th>
                  <th style={{ width: "14%" }}>Invoice Date</th>
                  <th style={{ width: "14%" }}>Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {row.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{display(invoice.invoiceNumber)}</td>
                    <td>
                      {display(invoice.invoiceTypeLabel || invoice.invoiceType)}
                    </td>
                    <td>{display(fmtDateOnly(invoice.invoiceDate))}</td>
                    <td>{display(fmtMoney(invoice.amount))}</td>
                    <td>{display(invoice.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="print-section">
          <h2 className="print-section-title">Line Details</h2>

          {row.lines.length === 0 ? (
            <div className="print-empty">No line rows entered.</div>
          ) : (
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "10%" }}>PO #</th>
                  <th style={{ width: "20%" }}>Customer</th>
                  <th style={{ width: "13%" }}>Logo</th>
                  <th style={{ width: "13%" }}>Tracking</th>
                  <th style={{ width: "15%" }}>Line Destination</th>
                  <th style={{ width: "8%" }}>Quantity</th>
                  <th style={{ width: "9%" }}>Carton Count</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {row.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{display(line.poNumber)}</td>
                    <td>{display(line.customerName)}</td>
                    <td>{display(line.logo)}</td>
                    <td>{display(line.tracking)}</td>
                    <td>{display(line.lineDestination)}</td>
                    <td>{display(line.quantity)}</td>
                    <td>{display(line.cartonCount)}</td>
                    <td>{display(line.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="print-section">
          <h2 className="print-section-title">CAP Reference</h2>

          <div className="print-field-grid">
            <PrintField
              label="Supporting Documents"
              value="Attachments, comments, and activity history are available on the CAP record."
              full
            />
          </div>
        </section>

        <footer className="print-footer">
          <div>CAP | Cap Application Platform</div>
          <div>Record ID: {row.id}</div>
        </footer>
      </article>
    </main>
  );
}