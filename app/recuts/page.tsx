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

export default function RecutsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState("requestedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

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
    warehousePrinted: "",
  });

  useEffect(() => {
    (async () => {
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
          recutReason: filters.recutReason || "",
          detailNumber: filters.detailNumber || "",
          capStyle: filters.capStyle || "",
          pieces: filters.pieces || "",
          operator: filters.operator || "",
          deliverTo: filters.deliverTo || "",
          notes: filters.notes || "",
          event: filters.event || "",
          doNotPull: filters.doNotPull || "",
          supervisorApproved: filters.supervisorApproved || "",
          warehousePrinted: filters.warehousePrinted || "",
        });

        const res = await fetch(`/api/recuts/list?${qs.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await res.json()) as ApiResp;

        if (!res.ok || "error" in data) {
          setError("error" in data ? data.error : "Failed to load recuts.");
          setRows([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        setRows(data.rows);
        setTotalCount(data.total);
      } catch {
        setError("Failed to load recuts.");
        setRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters, pageIndex, pageSize, sortBy, sortDir]);

  function onFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  }

  const columns = useMemo<Column<Row>[]>(() => {
    return [
      { key: "recutId", header: "Recut ID", sortable: true, filterable: true, placeholder: "Recut ID", render: (r) => r.recutId },
      { key: "requestedDate", header: "Date Requested", sortable: true, filterable: true, placeholder: "Date", render: (r) => formatDate(r.requestedDate) },
      { key: "requestedTime", header: "Time Requested", sortable: true, filterable: true, placeholder: "Time", render: (r) => formatTime(r.requestedTime) },
      { key: "requestedByName", header: "Name", sortable: true, filterable: true, placeholder: "Name", render: (r) => r.requestedByName },
      { key: "requestedDepartment", header: "Requested Department", sortable: true, filterable: true, placeholder: "Department", render: (r) => r.requestedDepartment },
      { key: "salesOrder", header: "Sales Order #", sortable: true, filterable: true, placeholder: "Sales Order #", render: (r) => r.salesOrder },
      { key: "designName", header: "Design Name", sortable: true, filterable: true, placeholder: "Design Name", render: (r) => r.designName },
      { key: "recutReason", header: "Recut Reason", sortable: true, filterable: true, placeholder: "Reason", render: (r) => r.recutReason },
      { key: "detailNumber", header: "Detail #", sortable: true, filterable: true, placeholder: "Detail #", render: (r) => r.detailNumber },
      { key: "capStyle", header: "Cap Style", sortable: true, filterable: true, placeholder: "Cap Style", render: (r) => r.capStyle },
      { key: "pieces", header: "Pieces", sortable: true, filterable: true, placeholder: "Pieces", render: (r) => r.pieces },
      { key: "operator", header: "Operator", sortable: true, filterable: true, placeholder: "Operator", render: (r) => r.operator },
      { key: "deliverTo", header: "Deliver To", sortable: true, filterable: true, placeholder: "Deliver To", render: (r) => r.deliverTo },
      { key: "notes", header: "Notes", sortable: true, filterable: true, placeholder: "Notes", render: (r) => r.notes || "" },
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
        key: "supervisorApproved",
        header: "Supervisor Approved",
        sortable: true,
        filterable: false,
        filterRender: boolFilter(
          filters.supervisorApproved,
          (v) => onFilterChange("supervisorApproved", v),
          "Supervisor Approved"
        ),
        render: (r) => boolText(r.supervisorApproved),
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
        render: (r) => boolText(r.warehousePrinted),
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
        key: "edit",
        header: "Edit",
        sortable: false,
        filterable: false,
        serverSortable: false,
        render: (r) =>
          r.supervisorApproved || r.warehousePrinted ? (
            <span className="text-soft">Locked</span>
          ) : (
            <Link href={`/recuts/${r.id}/edit`} className="btn btn-primary btn-sm">
              Edit
            </Link>
          ),
      },
    ];
  }, [filters]);

  function onToggleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
    setPageIndex(0);
  }

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Recuts</h1>
          <p className="page-subtitle">Your submitted recut requests.</p>
        </div>
        <Link href="/recuts/add" className="btn btn-primary">
          + New Recut Request
        </Link>
      </div>

      <DataTable<Row>
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
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPageIndex(0);
        }}
        rowKey={(r) => r.id}
        csvFilename="recuts.csv"
        rowToCsv={(r) => ({
          "Recut ID": r.recutId,
          "Date Requested": formatDate(r.requestedDate),
          "Time Requested": formatTime(r.requestedTime),
          Name: r.requestedByName,
          "Requested Department": r.requestedDepartment,
          "Sales Order #": r.salesOrder,
          "Design Name": r.designName,
          "Recut Reason": r.recutReason,
          "Detail #": r.detailNumber,
          "Cap Style": r.capStyle,
          Pieces: r.pieces,
          Operator: r.operator,
          "Deliver To": r.deliverTo,
          Notes: r.notes || "",
          Event: boolText(r.event),
          "Do Not Pull": boolText(r.doNotPull),
          "Supervisor Approved": boolText(r.supervisorApproved),
          "Warehouse Printed": boolText(r.warehousePrinted),
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