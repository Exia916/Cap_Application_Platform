"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

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

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getRangeLastNDays(n: number): { from: string; to: string } {
  const today = new Date();
  const to = ymdChicago(today);
  const from = ymdChicago(addDays(today, -(n - 1)));
  return { from, to };
}

type Row = {
  id: string;
  entryTs: string;
  entryDate: string;
  shift: string | null;
  shiftDate: string | null;
  name: string;
  employeeNumber: number | null;
  salesOrder: string | null;
  detailCount: number;
  quantity: number;
  notes: string | null;
};

type SortBy =
  | "entryTs"
  | "entryDate"
  | "shift"
  | "shiftDate"
  | "name"
  | "salesOrder"
  | "detailCount"
  | "quantity";

type Filters = {
  shiftDate: string;
  entryDate: string;
  shift: string;
  name: string;
  salesOrder: string;
  detailCount: string;
  quantity: string;
  notes: string;
};

const DEFAULT_FILTERS: Filters = {
  shiftDate: "",
  entryDate: "",
  shift: "",
  name: "",
  salesOrder: "",
  detailCount: "",
  quantity: "",
  notes: "",
};

function formatEntryTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
}

const filterInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 120,
};

export default function SampleEmbroideryListPage() {
  const def = useMemo(() => getRangeLastNDays(30), []);
  const [shiftDateFrom, setShiftDateFrom] = useState(def.from);
  const [shiftDateTo, setShiftDateTo] = useState(def.to);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("shiftDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  const offset = pageIndex * pageSize;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [shiftDateFrom, shiftDateTo, sortBy, sortDir, debouncedFilters, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("shiftDateFrom", shiftDateFrom);
    sp.set("shiftDateTo", shiftDateTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));

    if (debouncedFilters.shiftDate.trim()) sp.set("shiftDate", debouncedFilters.shiftDate.trim());
    if (debouncedFilters.entryDate.trim()) sp.set("entryDate", debouncedFilters.entryDate.trim());
    if (debouncedFilters.shift.trim()) sp.set("shift", debouncedFilters.shift.trim());
    if (debouncedFilters.name.trim()) sp.set("name", debouncedFilters.name.trim());
    if (debouncedFilters.salesOrder.trim()) sp.set("salesOrder", debouncedFilters.salesOrder.trim());
    if (debouncedFilters.detailCount.trim()) sp.set("detailCount", debouncedFilters.detailCount.trim());
    if (debouncedFilters.quantity.trim()) sp.set("quantity", debouncedFilters.quantity.trim());
    if (debouncedFilters.notes.trim()) sp.set("notes", debouncedFilters.notes.trim());

    return sp.toString();
  }, [shiftDateFrom, shiftDateTo, sortBy, sortDir, debouncedFilters, pageSize, offset]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/production/sample-embroidery/list?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load entries.");

      setRows(Array.isArray(data?.entries) ? data.entries : []);
      setTotalCount(Number.isFinite(data?.totalCount) ? Number(data.totalCount) : 0);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(queryString);
  }, [queryString]);

  function onToggleSort(key: string) {
    const next = key as SortBy;
    if (sortBy !== next) {
      setSortBy(next);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((f) => ({ ...f, [key]: value }));
    }
  }

  function clearFilters() {
    const r = getRangeLastNDays(30);
    setShiftDateFrom(r.from);
    setShiftDateTo(r.to);
    setFilters(DEFAULT_FILTERS);
    setSortBy("shiftDate");
    setSortDir("desc");
    setPageIndex(0);
  }

  const columns: Column<Row>[] = [
    {
      key: "shiftDate",
      header: "Shift Date",
      sortable: true,
      filterRender: (
        <input
          className="input dt-filter-input"
          style={filterInputStyle}
          type="date"
          value={filters.shiftDate}
          onChange={(e) => onFilterChange("shiftDate", e.target.value)}
          title="Filter Shift Date"
        />
      ),
      render: (row) => row.shiftDate ?? "",
      getSearchText: (row) => row.shiftDate ?? "",
    },
    {
      key: "shift",
      header: "Shift",
      sortable: true,
      filterable: true,
      render: (row) => row.shift ?? "",
      getSearchText: (row) => row.shift ?? "",
    },
    {
      key: "entryDate",
      header: "Entry Date",
      sortable: true,
      filterRender: (
        <input
          className="input dt-filter-input"
          style={filterInputStyle}
          type="date"
          value={filters.entryDate}
          onChange={(e) => onFilterChange("entryDate", e.target.value)}
          title="Filter Entry Date"
        />
      ),
      render: (row) => row.entryDate || "",
      getSearchText: (row) => row.entryDate || "",
    },
    {
      key: "entryTs",
      header: "Entry Time",
      sortable: true,
      render: (row) => formatEntryTime(row.entryTs),
      getSearchText: (row) => formatEntryTime(row.entryTs),
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      filterable: true,
      render: (row) => row.name,
      getSearchText: (row) => row.name ?? "",
    },
    {
      key: "salesOrder",
      header: "Sales Order",
      sortable: true,
      filterable: true,
      render: (row) => row.salesOrder ?? "",
      getSearchText: (row) => row.salesOrder ?? "",
    },
    {
      key: "detailCount",
      header: "Details",
      sortable: true,
      filterable: true,
      render: (row) => row.detailCount ?? "",
      getSearchText: (row) => String(row.detailCount ?? ""),
    },
    {
      key: "quantity",
      header: "Quantity",
      sortable: true,
      filterable: true,
      render: (row) => row.quantity ?? "",
      getSearchText: (row) => String(row.quantity ?? ""),
    },
    {
      key: "notes",
      header: "Notes",
      filterable: true,
      render: (row) => row.notes ?? "",
      getSearchText: (row) => row.notes ?? "",
    },
    {
      key: "view",
      header: "View",
      render: (row) => (
        <Link className="btn btn-secondary btn-sm" href={`/production/sample-embroidery/${row.id}`}>
          View
        </Link>
      ),
    },
    {
      key: "edit",
      header: "Edit",
      render: (row) => (
        <Link
          className="btn btn-primary btn-sm"
          href={`/production/sample-embroidery/${row.id}/edit`}
        >
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="section-stack">
      <div className="page-header">
        <div>
          <h1>Sample Embroidery</h1>
          <p>Track sample embroidery production entries.</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
          <Link className="btn btn-primary" href="/production/sample-embroidery/add">
            Add Entry
          </Link>
        </div>
      </div>

      <div className="section-card">
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div>
            <label className="field-label">Shift Date From</label>
            <input
              type="date"
              className="input"
              value={shiftDateFrom}
              onChange={(e) => setShiftDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Shift Date To</label>
            <input
              type="date"
              className="input"
              value={shiftDateTo}
              onChange={(e) => setShiftDateTo(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const r = getRangeLastNDays(30);
                setShiftDateFrom(r.from);
                setShiftDateTo(r.to);
              }}
            >
              Last 30 Days
            </button>
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
          rowKey={(row) => row.id}
          csvFilename="sample-embroidery.csv"
          rowToCsv={(row) => ({
            ShiftDate: row.shiftDate ?? "",
            Shift: row.shift ?? "",
            EntryDate: row.entryDate,
            EntryTime: formatEntryTime(row.entryTs),
            Name: row.name,
            SalesOrder: row.salesOrder,
            DetailCount: row.detailCount,
            Quantity: row.quantity,
            Notes: row.notes ?? "",
          })}
        />
      </div>
    </div>
  );
}