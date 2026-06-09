"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type LookupOption = {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type ShipmentRow = {
  id: string;
  inboundShipmentNumber: string;

  statusId: number;
  statusCode: string;
  statusLabel: string;
  status: string;

  containerNumber: string | null;
  mblNumber: string | null;
  hblNumber: string | null;
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

  lineCount: number;
  invoiceCount: number;

  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

type Filters = {
  status: string;
  containerNumber: string;
  mblNumber: string;
  hblNumber: string;
  port: string;
  carrier: string;
  forwarder: string;
  shipmentType: string;
  containerDestination: string;
  customer: string;
  poNumber: string;
};

const DEFAULT_FILTERS: Filters = {
  status: "",
  containerNumber: "",
  mblNumber: "",
  hblNumber: "",
  port: "",
  carrier: "",
  forwarder: "",
  shipmentType: "",
  containerDestination: "",
  customer: "",
  poNumber: "",
};

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${yyyy}-${mm}-${dd}`;
}

function fmtDateOnly(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : ymdChicago(d);
}

function fmtPercent(v?: number | string | null): string {
  if (v == null || v === "") return "";

  const n = Number(v);
  if (!Number.isFinite(n)) return "";

  return `${n.toFixed(2)}%`;
}

function statusBadge(row: ShipmentRow) {
  const code = String(row.statusCode || "").toUpperCase();

  let cls = "badge badge-neutral";

  if (code === "CUSTOMS_HOLD") cls = "badge badge-danger";
  else if (code === "RECEIVED_CLOSED" || code === "DELIVERED") cls = "badge badge-success";
  else if (code === "ARRIVED_AT_PORT" || code === "CUSTOMS_CLEARED") cls = "badge badge-warning";
  else if (code === "IN_TRANSIT" || code === "AWAITING_DEPARTURE") cls = "badge badge-brand-blue";

  return <span className={cls}>{row.statusLabel || row.status || ""}</span>;
}

function forwarderDisplay(row: ShipmentRow) {
  return row.forwarderLabel || row.forwarder || "";
}

function shipmentTypeDisplay(row: ShipmentRow) {
  return row.shipmentTypeLabel || row.shipmentType || "";
}

export default function InboundShipmentsPage() {
  const router = useRouter();

  const [statusOptions, setStatusOptions] = useState<LookupOption[]>([]);
  const [forwarderOptions, setForwarderOptions] = useState<LookupOption[]>([]);
  const [shipmentTypeOptions, setShipmentTypeOptions] = useState<LookupOption[]>([]);

  const [etaFrom, setEtaFrom] = useState("");
  const [etaTo, setEtaTo] = useState("");
  const [etdFrom, setEtdFrom] = useState("");
  const [etdTo, setEtdTo] = useState("");

  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [sortBy, setSortBy] = useState("eta");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offset = pageIndex * pageSize;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedFilters, etaFrom, etaTo, etdFrom, etdTo, sortBy, sortDir, pageSize]);

  useEffect(() => {
    async function loadLookups() {
      try {
        setLookupLoading(true);

        const [statusRes, forwarderRes, shipmentTypeRes] = await Promise.all([
          fetch("/api/inbound-shipments/lookups/statuses", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/inbound-shipments/lookups/forwarders", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/inbound-shipments/lookups/shipment-types", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const statusData = await statusRes.json().catch(() => ({}));
        const forwarderData = await forwarderRes.json().catch(() => ({}));
        const shipmentTypeData = await shipmentTypeRes.json().catch(() => ({}));

        if (statusRes.ok) {
          setStatusOptions(Array.isArray(statusData?.rows) ? statusData.rows : []);
        }

        if (forwarderRes.ok) {
          setForwarderOptions(
            Array.isArray(forwarderData?.rows) ? forwarderData.rows : []
          );
        }

        if (shipmentTypeRes.ok) {
          setShipmentTypeOptions(
            Array.isArray(shipmentTypeData?.rows) ? shipmentTypeData.rows : []
          );
        }
      } finally {
        setLookupLoading(false);
      }
    }

    loadLookups();
  }, []);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);

    if (debouncedFilters.status) sp.set("status", debouncedFilters.status);
    if (debouncedFilters.containerNumber.trim()) {
      sp.set("containerNumber", debouncedFilters.containerNumber.trim());
    }
    if (debouncedFilters.mblNumber.trim()) sp.set("mblNumber", debouncedFilters.mblNumber.trim());
    if (debouncedFilters.hblNumber.trim()) sp.set("hblNumber", debouncedFilters.hblNumber.trim());
    if (debouncedFilters.port.trim()) sp.set("port", debouncedFilters.port.trim());
    if (debouncedFilters.carrier.trim()) sp.set("carrier", debouncedFilters.carrier.trim());

    if (debouncedFilters.forwarder.trim()) {
      sp.set("forwarder", debouncedFilters.forwarder.trim());
    }

    if (debouncedFilters.shipmentType.trim()) {
      sp.set("shipmentType", debouncedFilters.shipmentType.trim());
    }

    if (debouncedFilters.containerDestination.trim()) {
      sp.set("containerDestination", debouncedFilters.containerDestination.trim());
    }
    if (debouncedFilters.customer.trim()) sp.set("customer", debouncedFilters.customer.trim());
    if (debouncedFilters.poNumber.trim()) sp.set("poNumber", debouncedFilters.poNumber.trim());

    if (etaFrom) sp.set("etaFrom", etaFrom);
    if (etaTo) sp.set("etaTo", etaTo);
    if (etdFrom) sp.set("etdFrom", etdFrom);
    if (etdTo) sp.set("etdTo", etdTo);

    return sp.toString();
  }, [
    debouncedFilters,
    etaFrom,
    etaTo,
    etdFrom,
    etdTo,
    pageSize,
    offset,
    sortBy,
    sortDir,
  ]);

  async function loadRows(qs: string) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/inbound-shipments?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load inbound shipments.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number.isFinite(data?.total) ? Number(data.total) : 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load inbound shipments.");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows(queryString);
  }, [queryString]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setEtaFrom("");
    setEtaTo("");
    setEtdFrom("");
    setEtdTo("");
    setSortBy("eta");
    setSortDir("asc");
    setPageIndex(0);
  }

  const columns: Column<ShipmentRow>[] = useMemo(
    () => [
      {
        key: "inboundShipmentNumber",
        header: "Inbound Shipment #",
        sortable: true,
        render: (r) => r.inboundShipmentNumber,
        getSearchText: (r) => r.inboundShipmentNumber,
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.status}
            disabled={lookupLoading}
            onChange={(e) => onFilterChange("status", e.target.value)}
          >
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => statusBadge(r),
        getSearchText: (r) => r.statusLabel || r.status || "",
      },
      {
        key: "containerNumber",
        header: "CNTR #",
        sortable: true,
        filterable: true,
        placeholder: "CNTR #",
        render: (r) => r.containerNumber ?? "",
        getSearchText: (r) => r.containerNumber ?? "",
      },
      {
        key: "mblNumber",
        header: "MBL #",
        sortable: true,
        filterable: true,
        placeholder: "MBL #",
        render: (r) => r.mblNumber ?? "",
        getSearchText: (r) => r.mblNumber ?? "",
      },
      {
        key: "hblNumber",
        header: "HBL #",
        sortable: true,
        filterable: true,
        placeholder: "HBL #",
        render: (r) => r.hblNumber ?? "",
        getSearchText: (r) => r.hblNumber ?? "",
      },
      {
        key: "port",
        header: "Port",
        sortable: true,
        filterable: true,
        placeholder: "Port",
        render: (r) => r.port ?? "",
        getSearchText: (r) => r.port ?? "",
      },
      {
        key: "carrier",
        header: "Carrier",
        sortable: true,
        filterable: true,
        placeholder: "Carrier",
        render: (r) => r.carrier ?? "",
        getSearchText: (r) => r.carrier ?? "",
      },
      {
        key: "forwarder",
        header: "Forwarder",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.forwarder}
            disabled={lookupLoading}
            onChange={(e) => onFilterChange("forwarder", e.target.value)}
          >
            <option value="">All</option>
            {forwarderOptions.map((opt) => (
              <option key={opt.id} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => forwarderDisplay(r),
        getSearchText: (r) => forwarderDisplay(r),
      },
      {
        key: "shipmentType",
        header: "Shipment Type",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.shipmentType}
            disabled={lookupLoading}
            onChange={(e) => onFilterChange("shipmentType", e.target.value)}
          >
            <option value="">All</option>
            {shipmentTypeOptions.map((opt) => (
              <option key={opt.id} value={opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        ),
        render: (r) => shipmentTypeDisplay(r),
        getSearchText: (r) => shipmentTypeDisplay(r),
      },
      {
        key: "containerDestination",
        header: "Container Destination",
        sortable: true,
        filterable: true,
        placeholder: "Destination",
        render: (r) => r.containerDestination ?? "",
        getSearchText: (r) => r.containerDestination ?? "",
      },
      {
        key: "etd",
        header: "ETD",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="input"
              type="date"
              value={etdFrom}
              onChange={(e) => setEtdFrom(e.target.value)}
              title="ETD from"
              style={{ minWidth: 128 }}
            />
            <span className="text-soft">–</span>
            <input
              className="input"
              type="date"
              value={etdTo}
              onChange={(e) => setEtdTo(e.target.value)}
              title="ETD to"
              style={{ minWidth: 128 }}
            />
          </div>
        ),
        render: (r) => fmtDateOnly(r.etd),
        getSearchText: (r) => fmtDateOnly(r.etd),
      },
      {
        key: "eta",
        header: "ETA",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="input"
              type="date"
              value={etaFrom}
              onChange={(e) => setEtaFrom(e.target.value)}
              title="ETA from"
              style={{ minWidth: 128 }}
            />
            <span className="text-soft">–</span>
            <input
              className="input"
              type="date"
              value={etaTo}
              onChange={(e) => setEtaTo(e.target.value)}
              title="ETA to"
              style={{ minWidth: 128 }}
            />
          </div>
        ),
        render: (r) => fmtDateOnly(r.eta),
        getSearchText: (r) => fmtDateOnly(r.eta),
      },
      {
        key: "cartonCount",
        header: "Carton Count",
        sortable: true,
        render: (r) => r.cartonCount ?? "",
        getSearchText: (r) => String(r.cartonCount ?? ""),
      },
      {
        key: "tariffPercentage",
        header: "Tariff %",
        sortable: true,
        render: (r) => fmtPercent(r.tariffPercentage),
        getSearchText: (r) => fmtPercent(r.tariffPercentage),
      },
      {
        key: "lineCount",
        header: "Lines",
        sortable: true,
        render: (r) => r.lineCount ?? 0,
        getSearchText: (r) => String(r.lineCount ?? 0),
      },
      {
        key: "invoiceCount",
        header: "Invoices",
        sortable: true,
        render: (r) => r.invoiceCount ?? 0,
        getSearchText: (r) => String(r.invoiceCount ?? 0),
      },
      {
        key: "customer",
        header: "Customer",
        filterable: true,
        placeholder: "Customer",
        render: () => "",
        getSearchText: () => "",
      },
      {
        key: "poNumber",
        header: "PO #",
        filterable: true,
        placeholder: "PO #",
        render: () => "",
        getSearchText: () => "",
      },
      {
        key: "actions",
        header: "Actions",
        render: (r) => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href={`/inbound-shipments/${encodeURIComponent(r.id)}`}
              className="btn btn-secondary btn-sm"
            >
              View
            </Link>
            {!r.isVoided ? (
              <Link
                href={`/inbound-shipments/${encodeURIComponent(r.id)}/edit`}
                className="btn btn-secondary btn-sm"
              >
                Edit
              </Link>
            ) : null}
          </div>
        ),
      },
    ],
    [
      etaFrom,
      etaTo,
      etdFrom,
      etdTo,
      filters.status,
      filters.forwarder,
      filters.shipmentType,
      forwarderOptions,
      lookupLoading,
      shipmentTypeOptions,
      statusOptions,
    ]
  );

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Inbound Shipments</h1>
          <p className="page-subtitle">
            Track inbound containers, POs, invoices, destinations, tariffs, and shipment documents.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
          <Link href="/inbound-shipments/new" className="btn btn-primary">
            New Inbound Shipment
          </Link>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        sortBy={sortBy}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        filters={filters}
        onFilterChange={onFilterChange}
        totalCount={totalCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={setPageSize}
        rowKey={(r) => r.id}
        emptyText="No inbound shipments found."
        enableGlobalSearch
        globalSearchPlaceholder="Search current page…"
        enableCsvExport
        csvFilename="inbound_shipments.csv"
        rowToCsv={(r) => ({
          "Inbound Shipment #": r.inboundShipmentNumber,
          Status: r.statusLabel,
          "CNTR #": r.containerNumber,
          "MBL #": r.mblNumber,
          "HBL #": r.hblNumber,
          Port: r.port,
          Carrier: r.carrier,
          Forwarder: forwarderDisplay(r),
          "Shipment Type": shipmentTypeDisplay(r),
          "Container Destination": r.containerDestination,
          ETD: fmtDateOnly(r.etd),
          ETA: fmtDateOnly(r.eta),
          "Carton Count": r.cartonCount,
          "Tariff %": fmtPercent(r.tariffPercentage),
          Lines: r.lineCount,
          Invoices: r.invoiceCount,
        })}
        rowClickable
        onRowDoubleClick={(r) => {
          router.push(`/inbound-shipments/${encodeURIComponent(r.id)}`);
        }}
      />
    </main>
  );
}