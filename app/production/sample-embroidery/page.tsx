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
  | "name"
  | "salesOrder"
  | "detailCount"
  | "quantity";

type Filters = {
  name: string;
  salesOrder: string;
  detailCount: string;
  quantity: string;
  notes: string;
};

const DEFAULT_FILTERS: Filters = {
  name: "",
  salesOrder: "",
  detailCount: "",
  quantity: "",
  notes: "",
};

export default function SampleEmbroideryListPage() {
  const def = useMemo(() => getRangeLastNDays(30), []);
  const [entryDateFrom, setEntryDateFrom] = useState(def.from);
  const [entryDateTo, setEntryDateTo] = useState(def.to);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("entryTs");
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
  }, [entryDateFrom, entryDateTo, sortBy, sortDir, debouncedFilters, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("entryDateFrom", entryDateFrom);
    sp.set("entryDateTo", entryDateTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));

    if (debouncedFilters.name.trim()) sp.set("name", debouncedFilters.name.trim());
    if (debouncedFilters.salesOrder.trim()) sp.set("salesOrder", debouncedFilters.salesOrder.trim());
    if (debouncedFilters.detailCount.trim()) sp.set("detailCount", debouncedFilters.detailCount.trim());
    if (debouncedFilters.quantity.trim()) sp.set("quantity", debouncedFilters.quantity.trim());
    if (debouncedFilters.notes.trim()) sp.set("notes", debouncedFilters.notes.trim());

    return sp.toString();
  }, [entryDateFrom, entryDateTo, sortBy, sortDir, debouncedFilters, pageSize, offset]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/production/sample-embroidery/list?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
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

  const columns: Column<Row>[] = [
    {
      key: "entryDate",
      header: "Date",
      sortable: true,
      render: (row) => row.entryDate || "",
    },
    {
      key: "entryTs",
      header: "Time",
      sortable: true,
      render: (row) =>
        row.entryTs
          ? new Date(row.entryTs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      filterable: true,
      render: (row) => row.name,
    },
    {
      key: "salesOrder",
      header: "Sales Order",
      sortable: true,
      filterable: true,
      render: (row) => row.salesOrder ?? "",
    },
    {
      key: "detailCount",
      header: "Details",
      sortable: true,
      filterable: true,
      render: (row) => row.detailCount ?? "",
    },
    {
      key: "quantity",
      header: "Quantity",
      sortable: true,
      filterable: true,
      render: (row) => row.quantity ?? "",
    },
    {
      key: "notes",
      header: "Notes",
      filterable: true,
      render: (row) => row.notes ?? "",
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

        <div className="page-actions">
          <Link className="btn btn-primary" href="/production/sample-embroidery/add">
            Add Entry
          </Link>
        </div>
      </div>

      <div className="section-card">
        <div className="form-grid form-grid-3">
          <div>
            <label className="form-label">From</label>
            <input
              type="date"
              className="w-full rounded border p-2"
              value={entryDateFrom}
              onChange={(e) => setEntryDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">To</label>
            <input
              type="date"
              className="w-full rounded border p-2"
              value={entryDateTo}
              onChange={(e) => setEntryDateTo(e.target.value)}
            />
          </div>
          <div className="section-actions" style={{ alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const r = getRangeLastNDays(30);
                setEntryDateFrom(r.from);
                setEntryDateTo(r.to);
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
            Date: row.entryDate,
            Time: row.entryTs,
            Name: row.name,
            SalesOrder: row.salesOrder,
            DetailCount: row.detailCount,
            Quantity: row.quantity,
            Notes: row.notes,
          })}
        />
      </div>
    </div>
  );
}