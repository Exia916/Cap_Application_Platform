"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AttachmentsPanel from "@/components/platform/AttachmentsPanel";
import CommentsPanel from "@/components/platform/CommentsPanel";
import ActivityHistoryPanel from "@/components/platform/ActivityHistoryPanel";
import {
  INBOUND_SHIPMENT_ATTACHMENT_CATEGORY_GENERAL,
  INBOUND_SHIPMENT_ATTACHMENT_CATEGORY_PURCHASE_ORDER,
  INBOUND_SHIPMENT_ENTITY_TYPE,
} from "@/lib/inboundShipments/constants";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
};

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

  forwarderId?: number | null;
  forwarderCode?: string | null;
  forwarderLabel?: string | null;
  forwarder: string | null;

  shipmentTypeId?: number | null;
  shipmentTypeCode?: string | null;
  shipmentTypeLabel?: string | null;
  shipmentType: string | null;

  containerDestination: string | null;
  etd: string | null;
  eta: string | null;
  cartonCount: number | null;
  tariffPercentage?: number | string | null;
  estimatedCostPerPiece?: number | string | null;
  estimatedCostPerDozen?: number | string | null;
  totalCost?: number | string | null;
  totalQuantity?: number | string | null;
  actualCostPerPiece?: number | string | null;
  actualCostPerDozen?: number | string | null;
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
    lineDestination?: string | null;
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

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      });
}

function fmtMoney(v?: number | string | null): string {
  if (v == null || !Number.isFinite(Number(v))) return "";

  return Number(v).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtCost(v?: number | string | null): string {
  if (v == null || v === "" || !Number.isFinite(Number(v))) return "";

  return Number(v).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function fmtNumber(v?: number | string | null): string {
  if (v == null || v === "" || !Number.isFinite(Number(v))) return "";

  return Number(v).toLocaleString();
}

function fmtPercent(v?: number | string | null): string {
  if (v == null || v === "") return "";

  const n = Number(v);
  if (!Number.isFinite(n)) return "";

  return `${n.toFixed(2)}%`;
}

function statusBadge(row: ShipmentDetail) {
  const code = String(row.statusCode || "").toUpperCase();

  let cls = "record-pill record-pill-neutral";

  if (code === "CUSTOMS_HOLD") {
    cls = "record-pill record-pill-danger";
  } else if (code === "RECEIVED_CLOSED" || code === "DELIVERED") {
    cls = "record-pill record-pill-success";
  } else if (code === "ARRIVED_AT_PORT" || code === "CUSTOMS_CLEARED") {
    cls = "record-pill record-pill-warning";
  } else if (code === "IN_TRANSIT" || code === "AWAITING_DEPARTURE") {
    cls = "record-pill record-pill-info";
  }

  return <span className={cls}>{row.statusLabel || row.status || ""}</span>;
}

function MetaItem({
  label,
  value,
  full,
  pre,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
  pre?: boolean;
}) {
  return (
    <div className={full ? "record-meta-item record-meta-item-full" : "record-meta-item"}>
      <div className="record-meta-label">{label}</div>
      <div className={pre ? "record-meta-value record-meta-value-pre" : "record-meta-value"}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function InboundShipmentRecordClient({ id }: { id: string }) {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [row, setRow] = useState<ShipmentDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = String(me?.role || "").trim().toUpperCase();
  const isAdmin = role === "ADMIN";

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [meRes, shipmentRes] = await Promise.all([
        fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        }),
        fetch(`/api/inbound-shipments/${encodeURIComponent(id)}?includeVoided=true`, {
          cache: "no-store",
          credentials: "include",
        }),
      ]);

      if (meRes.ok) {
        const meData = await meRes.json().catch(() => null);
        setMe(meData);
      }

      const data = await shipmentRes.json().catch(() => ({}));

      if (!shipmentRes.ok) {
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

  async function onVoid() {
    if (!row || row.isVoided) return;

    const reason = window.prompt("Enter a reason for voiding this inbound shipment:");
    if (reason === null) return;

    if (!window.confirm("Void this inbound shipment? This will remove it from normal lists.")) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/inbound-shipments/${encodeURIComponent(row.id)}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim() || null }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to void inbound shipment.");
      }

      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to void inbound shipment.");
    } finally {
      setActionLoading(false);
    }
  }

  async function onUnvoid() {
    if (!row || !row.isVoided) return;

    if (!window.confirm("Restore this voided inbound shipment?")) return;

    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/inbound-shipments/${encodeURIComponent(row.id)}/unvoid`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to unvoid inbound shipment.");
      }

      await load();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to unvoid inbound shipment.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="record-shell">
        <div className="card">
          <div className="text-muted">Loading inbound shipment…</div>
        </div>
      </main>
    );
  }

  if (error && !row) {
    return (
      <main className="record-shell">
        <div className="alert alert-danger">{error}</div>

        <div style={{ marginTop: 12 }}>
          <Link href="/inbound-shipments" className="btn btn-secondary">
            Back to Inbound Shipments
          </Link>
        </div>
      </main>
    );
  }

  if (!row) {
    return (
      <main className="record-shell">
        <div className="alert alert-warning">Inbound shipment not found.</div>

        <div style={{ marginTop: 12 }}>
          <Link href="/inbound-shipments" className="btn btn-secondary">
            Back to Inbound Shipments
          </Link>
        </div>
      </main>
    );
  }

  const forwarderDisplay = row.forwarderLabel || row.forwarder;
  const shipmentTypeDisplay = row.shipmentTypeLabel || row.shipmentType;

  return (
    <main className="record-shell">
      <div className="record-header">
        <div className="record-header-main">
          <div className="record-kicker">Logistics / Inbound Shipments</div>
          <h1 className="record-title">{row.inboundShipmentNumber}</h1>

          <p className="record-subtitle">
            {row.containerNumber ? `CNTR # ${row.containerNumber}` : "No container number yet"}
            {row.eta ? ` · ETA ${fmtDateOnly(row.eta)}` : ""}
          </p>

          <div className="record-badge-row">
            {statusBadge(row)}
            {row.isVoided ? <span className="record-pill record-pill-danger">Voided</span> : null}
          </div>
        </div>

        <div className="record-actions">
          <Link href="/inbound-shipments" className="btn btn-secondary">
            Back
          </Link>

          <Link
            href={`/inbound-shipments/${encodeURIComponent(row.id)}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Print / Preview
          </Link>

          {!row.isVoided ? (
            <Link
              href={`/inbound-shipments/${encodeURIComponent(row.id)}/edit`}
              className="btn btn-primary"
            >
              Edit
            </Link>
          ) : null}

          {!row.isVoided ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={actionLoading}
              onClick={onVoid}
            >
              Void
            </button>
          ) : null}

          {row.isVoided && isAdmin ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={actionLoading}
              onClick={onUnvoid}
            >
              Unvoid
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {row.isVoided ? (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          This inbound shipment is voided.
          {row.voidReason ? ` Reason: ${row.voidReason}` : ""}
        </div>
      ) : null}

      <div className="record-content">
        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Submission Details</h2>
          </div>

          <div className="record-meta-grid">
            <MetaItem label="Inbound Shipment #" value={row.inboundShipmentNumber} />
            <MetaItem label="Status" value={row.statusLabel} />
            <MetaItem label="CNTR #" value={row.containerNumber} />
            <MetaItem label="Seal #" value={row.sealNumber} />
            <MetaItem label="MBL #" value={row.mblNumber} />
            <MetaItem label="HBL #" value={row.hblNumber} />
            <MetaItem label="Port" value={row.port} />
            <MetaItem label="Carrier" value={row.carrier} />
            <MetaItem label="Forwarder" value={forwarderDisplay} />
            <MetaItem label="Shipment Type" value={shipmentTypeDisplay} />
            <MetaItem label="Container Destination" value={row.containerDestination} />
            <MetaItem label="Tariff %" value={fmtPercent(row.tariffPercentage)} />
            <MetaItem label="ETD" value={fmtDateOnly(row.etd)} />
            <MetaItem label="ETA" value={fmtDateOnly(row.eta)} />
            <MetaItem label="Carton Count" value={fmtNumber(row.cartonCount)} />
            <MetaItem label="Total Quantity" value={fmtNumber(row.totalQuantity)} />
            <MetaItem label="Total Cost" value={fmtMoney(row.totalCost)} />
            <MetaItem
              label="Estimated Cost Per Piece"
              value={fmtCost(row.estimatedCostPerPiece)}
            />
            <MetaItem
              label="Estimated Cost Per Dozen"
              value={fmtCost(row.estimatedCostPerDozen)}
            />
            <MetaItem
              label="Actual Cost Per Piece"
              value={fmtCost(row.actualCostPerPiece)}
            />
            <MetaItem
              label="Actual Cost Per Dozen"
              value={fmtCost(row.actualCostPerDozen)}
            />
            <MetaItem label="Created" value={fmtDateTime(row.createdAt)} />
            <MetaItem label="Created By" value={row.createdBy} />
            <MetaItem label="Updated" value={fmtDateTime(row.updatedAt)} />
            <MetaItem label="Updated By" value={row.updatedBy} />
            <MetaItem label="Notes" value={row.notes} full pre />
          </div>
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Invoice Details</h2>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: "auto",
                flexWrap: "wrap",
              }}
            >
              <span className="record-pill record-pill-neutral">
                Total Cost: {fmtMoney(row.totalCost) || "—"}
              </span>
              <span className="record-count-badge">{row.invoices.length}</span>
            </div>
          </div>

          {row.invoices.length === 0 ? (
            <div className="muted-box">No invoice rows entered.</div>
          ) : (
            <div className="table-card">
              <div className="table-scroll">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Invoice Type</th>
                      <th>Invoice Date</th>
                      <th>Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber || "—"}</td>
                        <td>{invoice.invoiceTypeLabel || invoice.invoiceType || "—"}</td>
                        <td>{fmtDateOnly(invoice.invoiceDate) || "—"}</td>
                        <td>{fmtMoney(invoice.amount) || "—"}</td>
                        <td>{invoice.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Line Details</h2>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: "auto",
                flexWrap: "wrap",
              }}
            >
              <span className="record-pill record-pill-neutral">
                Total Quantity: {fmtNumber(row.totalQuantity) || "—"}
              </span>
              <span className="record-count-badge">{row.lines.length}</span>
            </div>
          </div>

          {row.lines.length === 0 ? (
            <div className="muted-box">No line rows entered.</div>
          ) : (
            <div className="table-card">
              <div className="table-scroll">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>PO #</th>
                      <th>Customer</th>
                      <th>Logo</th>
                      <th>Tracking</th>
                      <th>Quantity</th>
                      <th>Carton Count</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.poNumber || "—"}</td>
                        <td>{line.customerName || "—"}</td>
                        <td>{line.logo || "—"}</td>
                        <td>{line.tracking || "—"}</td>
                        <td>{line.quantity ?? "—"}</td>
                        <td>{line.cartonCount ?? "—"}</td>
                        <td>{line.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Shipment Attachments</h2>
          </div>

          <AttachmentsPanel
            entityType={INBOUND_SHIPMENT_ENTITY_TYPE}
            entityId={row.id}
            attachmentCategory={INBOUND_SHIPMENT_ATTACHMENT_CATEGORY_GENERAL}
            emptyMessage="No shipment attachments yet."
            dialogTitle="Shipment Attachment"
          />
        </section>

        <section className="record-section-card">
          <div className="record-section-header">
            <h2 className="record-section-title">Purchase Order Attachments</h2>
          </div>

          <AttachmentsPanel
            entityType={INBOUND_SHIPMENT_ENTITY_TYPE}
            entityId={row.id}
            attachmentCategory={INBOUND_SHIPMENT_ATTACHMENT_CATEGORY_PURCHASE_ORDER}
            emptyMessage="No purchase order attachments yet."
            dialogTitle="Purchase Order Attachment"
          />
        </section>

        <section className="record-section-card">
          <CommentsPanel entityType={INBOUND_SHIPMENT_ENTITY_TYPE} entityId={row.id} />
        </section>

        <section className="record-section-card">
          <ActivityHistoryPanel
            entityType={INBOUND_SHIPMENT_ENTITY_TYPE}
            entityId={row.id}
            defaultExpanded={false}
          />
        </section>
      </div>
    </main>
  );
}
