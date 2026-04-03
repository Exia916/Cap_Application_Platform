"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type Row = {
  id: string;
  recutId: number;
  requestedDate: string;
  requestedTime: string;
  requestedByName: string;
  requestedDepartment: string;
  salesOrder: string;
  designName: string;
  recutReason: string;
  detailNumber: number;
  capStyle: string;
  pieces: number;
  operator: string;
  deliverTo: string;
  notes: string | null;
  event: boolean;
  doNotPull: boolean;
  supervisorApproved: boolean;
  warehousePrinted: boolean;
  warehousePrintedAt: string | null;
  warehousePrintedBy: string | null;
};

type ApiResp =
  | {
      rows: Row[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { error: string };

function boolText(v: boolean) {
  return v ? "Yes" : "No";
}

function formatDate(value: string) {
  return value ? String(value).slice(0, 10) : "";
}

function formatTime(value: string) {
  return value ? String(value).slice(0, 8) : "";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function boolFilter(
  value: string,
  onChange: (next: string) => void,
  label: string
) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={filterSelect}
      aria-label={`${label} filter`}
    >
      <option value="">All</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
}

export default function RecutWarehousePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState("requestedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [printing, setPrinting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Record<string, string>>({
    recutId: "",
    requestedDate: "",
    requestedTime: "",
    requestedByName: "",
    requestedDepartment: "",
    salesOrder: "",
    designName: "",
    recutReason: "",
    detailNumber: "",
    capStyle: "",
    pieces: "",
    operator: "",
    deliverTo: "",
    notes: "",
    event: "",
    doNotPull: "",
    supervisorApproved: "",
    warehousePrinted: "false",
  });

  async function loadRows() {
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams({
        page: String(pageIndex + 1),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
        q: "",
        recutId: filters.recutId || "",
        requestedDate: filters.requestedDate || "",
        requestedTime: filters.requestedTime || "",
        requestedByName: filters.requestedByName || "",
        requestedDepartment: filters.requestedDepartment || "",
        salesOrder: filters.salesOrder || "",
        designName: filters.designName || "",
        detailNumber: filters.detailNumber || "",
        capStyle: filters.capStyle || "",
        pieces: filters.pieces || "",
        operator: filters.operator || "",
        deliverTo: filters.deliverTo || "",
        event: filters.event || "",
        doNotPull: filters.doNotPull || "",
        supervisorApproved: filters.supervisorApproved || "",
        warehousePrinted: filters.warehousePrinted || "",
      });

      const res = await fetch(`/api/recuts/warehouse-list?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json()) as ApiResp;

      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Failed to load warehouse list.");
        setRows([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      setRows(data.rows);
      setTotalCount(data.total);
    } catch {
      setError("Failed to load warehouse list.");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pageIndex, pageSize, sortBy, sortDir]);

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  }

  function clearVisibleSelections() {
    const visibleIds = new Set(rows.map((r) => r.id));
    setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  }

  async function printSelected() {
    if (!selectedIds.length || printing) return;

    setPrinting(true);
    setError(null);

    try {
      const res = await fetch("/api/recuts/warehouse/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).error || "Failed to generate print PDF.");
        setPrinting(false);
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.open(blobUrl, "_blank", "noopener,noreferrer");
        }

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          iframe.remove();
        }, 15000);
      };

      setSelectedIds([]);
      await loadRows();
    } catch {
      setError("Failed to generate print PDF.");
    } finally {
      setPrinting(false);
    }
  }

  async function toggleDoNotPull(id: string, value: boolean) {
    setTogglingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/recuts/${encodeURIComponent(id)}/toggle-do-not-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((data as any).error || "Failed to update Do Not Pull.");
        return;
      }

      await loadRows();
    } catch {
      setError("Failed to update Do Not Pull.");
    } finally {
      setTogglingId(null);
    }
  }

  const toolbar = (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={printSelected}
        disabled={printing || selectedIds.length === 0}
        title={selectedIds.length ? `Print ${selectedIds.length} selected` : "Select rows to print"}
      >
        {printing ? "Printing..." : `Print Selected${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
      </button>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setSelectedIds([])}
        disabled={printing || selectedIds.length === 0}
      >
        Clear Selected
      </button>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={clearVisibleSelections}
        disabled={printing || rows.length === 0}
      >
        Clear Visible
      </button>
    </>
  );

  function onFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  }

  const columns = useMemo<Column<Row>[]>(() => {
    return [
      {
        key: "print",
        header: "Print",
        sortable: false,
        filterable: false,
        serverSortable: false,
        width: 70,
        render: (r) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            onChange={(e) => toggleSelected(r.id, e.target.checked)}
            aria-label={`Select recut ${r.recutId} for printing`}
          />
        ),
      },
      { key: "recutId", header: "Recut ID", sortable: true, filterable: true, placeholder: "Recut ID", render: (r) => r.recutId },
      { key: "requestedDate", header: "Date Requested", sortable: true, filterable: true, placeholder: "Date Requested", render: (r) => formatDate(r.requestedDate) },
      { key: "requestedTime", header: "Time Requested", sortable: true, filterable: true, placeholder: "Time Requested", render: (r) => formatTime(r.requestedTime) },
      { key: "requestedByName", header: "Name", sortable: true, filterable: true, placeholder: "Name", render: (r) => r.requestedByName },
      { key: "requestedDepartment", header: "Requested Department", sortable: true, filterable: true, placeholder: "Requested Department", render: (r) => r.requestedDepartment },
      { key: "salesOrder", header: "Sales Order #", sortable: true, filterable: true, placeholder: "Sales Order #", render: (r) => r.salesOrder },
      { key: "designName", header: "Design Name", sortable: true, filterable: true, placeholder: "Design Name", render: (r) => r.designName },
      { key: "detailNumber", header: "Detail #", sortable: true, filterable: true, placeholder: "Detail #", render: (r) => r.detailNumber },
      { key: "capStyle", header: "Cap Style", sortable: true, filterable: true, placeholder: "Cap Style", render: (r) => r.capStyle },
      { key: "pieces", header: "Pieces", sortable: true, filterable: true, placeholder: "Pieces", render: (r) => r.pieces },
      { key: "operator", header: "Operator", sortable: true, filterable: true, placeholder: "Operator", render: (r) => r.operator },
      { key: "deliverTo", header: "Deliver To", sortable: true, filterable: true, placeholder: "Deliver To", render: (r) => r.deliverTo },
      {
        key: "event",
        header: "Event",
        sortable: true,
        filterable: false,
        filterRender: boolFilter(filters.event, (v) => onFilterChange("event", v), "Event"),
        render: (r) => boolText(r.event),
      },
      {
        key: "doNotPull",
        header: "Do Not Pull",
        sortable: true,
        filterable: false,
        filterRender: boolFilter(filters.doNotPull, (v) => onFilterChange("doNotPull", v), "Do Not Pull"),
        render: (r) => boolText(r.doNotPull),
      },
      {
        key: "warehousePrinted",
        header: "Warehouse Printed",
        sortable: true,
        filterable: false,
        filterRender: boolFilter(
          filters.warehousePrinted,
          (v) => onFilterChange("warehousePrinted", v),
          "Warehouse Printed"
        ),
        render: (r) => (r.warehousePrinted ? <span className="badge badge-warning">Printed</span> : "No"),
      },
      {
        key: "warehousePrintedAt",
        header: "Printed At",
        sortable: false,
        filterable: false,
        serverSortable: false,
        render: (r) => formatDateTime(r.warehousePrintedAt),
      },
      {
        key: "warehousePrintedBy",
        header: "Printed By",
        sortable: false,
        filterable: false,
        serverSortable: false,
        render: (r) => r.warehousePrintedBy || "",
      },
      {
        key: "view",
        header: "View",
        sortable: false,
        filterable: false,
        serverSortable: false,
        render: (r) => (
          <Link href={`/recuts/${r.id}`} className="btn btn-secondary btn-sm">
            View
          </Link>
        ),
      },
      {
        key: "dnpAction",
        header: "Do Not Pull Action",
        sortable: false,
        filterable: false,
        serverSortable: false,
        render: (r) => (
          <button
            type="button"
            onClick={() => toggleDoNotPull(r.id, !r.doNotPull)}
            disabled={togglingId === r.id}
            className="btn btn-secondary btn-sm"
          >
            {togglingId === r.id
              ? "Saving..."
              : r.doNotPull
                ? "Clear Do Not Pull"
                : "Mark Do Not Pull"}
          </button>
        ),
      },
    ];
  }, [filters, selectedIds, togglingId]);

  function onToggleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPageIndex(0);
  }

  return (
    <div className="page-shell-table">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Warehouse Recuts</h1>
          <p className="page-subtitle">Select recut requests to generate warehouse pick tickets.</p>
        </div>
      </div>

      {error ? <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div> : null}

      <DataTable<Row>
        columns={columns}
        rows={rows}
        loading={loading}
        error={null}
        sortBy={sortBy}
        sortDir={sortDir}
        onToggleSort={onToggleSort}
        filters={filters}
        onFilterChange={onFilterChange}
        totalCount={totalCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageIndexChange={setPageIndex}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPageIndex(0);
        }}
        rowKey={(r) => r.id}
        toolbar={toolbar}
        csvFilename="recuts-warehouse.csv"
        rowToCsv={(r) => ({
          Print: selectedIds.includes(r.id) ? "Yes" : "No",
          "Recut ID": r.recutId,
          "Date Requested": formatDate(r.requestedDate),
          "Time Requested": formatTime(r.requestedTime),
          Name: r.requestedByName,
          "Requested Department": r.requestedDepartment,
          "Sales Order #": r.salesOrder,
          "Design Name": r.designName,
          "Detail #": r.detailNumber,
          "Cap Style": r.capStyle,
          Pieces: r.pieces,
          Operator: r.operator,
          "Deliver To": r.deliverTo,
          Event: boolText(r.event),
          "Do Not Pull": boolText(r.doNotPull),
          "Warehouse Printed": boolText(r.warehousePrinted),
          "Printed At": formatDateTime(r.warehousePrintedAt),
          "Printed By": r.warehousePrintedBy || "",
        })}
      />
    </div>
  );
}

const filterSelect: React.CSSProperties = {
  width: "100%",
  minWidth: 88,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  padding: "6px 8px",
  background: "#fff",
  fontSize: 12,
};