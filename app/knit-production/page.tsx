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

function getRangeToday(): { from: string; to: string } {
  const t = ymdChicago(new Date());
  return { from: t, to: t };
}

function startOfMonthChicago(ref: Date): string {
  const ymd = ymdChicago(ref);
  return `${ymd.slice(0, 8)}01`;
}

function endOfMonthChicago(ref: Date): string {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const last = new Date(y, m + 1, 0);
  return ymdChicago(last);
}

function getRangeThisMonth(): { from: string; to: string } {
  const now = new Date();
  return { from: startOfMonthChicago(now), to: endOfMonthChicago(now) };
}

function getRangePrevMonth(): { from: string; to: string } {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return { from: startOfMonthChicago(prev), to: endOfMonthChicago(prev) };
}

function fmtDateTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function fmtDateOnly(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : ymdChicago(d);
}

function knitAreaBadge(v?: string | null) {
  const text = String(v ?? "").trim();
  if (!text) return "";

  return <span className="badge badge-neutral">{text}</span>;
}

type SubmissionRow = {
  id: string;
  entryTs: string;
  entryDate: string;
  name: string;
  employeeNumber: number;
  shift: string | null;
  stockOrder: boolean;
  salesOrder: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  knitArea: string;
  lineCount: number;
  totalQuantity: number;
  notes: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

type SortBy =
  | "entryDate"
  | "entryTs"
  | "name"
  | "shift"
  | "stockOrder"
  | "salesOrder"
  | "knitArea"
  | "lineCount"
  | "totalQuantity";

type Filters = {
  name: string;
  salesOrder: string;
  knitArea: string;
  itemStyle: string;
  logo: string;
  notes: string;
  stockOrder: string;
};

const DEFAULT_FILTERS: Filters = {
  name: "",
  salesOrder: "",
  knitArea: "",
  itemStyle: "",
  logo: "",
  notes: "",
  stockOrder: "",
};

function stockOrderBadge(v: boolean) {
  return (
    <span className={v ? "badge badge-brand-blue" : "badge badge-neutral"}>
      {v ? "Yes" : "No"}
    </span>
  );
}

export default function KnitProductionPage() {
  const def = useMemo(() => getRangeLastNDays(1), []);
  const [entryDateFrom, setEntryDateFrom] = useState(def.from);
  const [entryDateTo, setEntryDateTo] = useState(def.to);

  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("entryTs");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

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
    if (debouncedFilters.knitArea.trim()) sp.set("knitArea", debouncedFilters.knitArea.trim());
    if (debouncedFilters.itemStyle.trim()) sp.set("itemStyle", debouncedFilters.itemStyle.trim());
    if (debouncedFilters.logo.trim()) sp.set("logo", debouncedFilters.logo.trim());
    if (debouncedFilters.notes.trim()) sp.set("notes", debouncedFilters.notes.trim());
    if (debouncedFilters.stockOrder === "true" || debouncedFilters.stockOrder === "false") {
      sp.set("stockOrder", debouncedFilters.stockOrder);
    }

    return sp.toString();
  }, [entryDateFrom, entryDateTo, sortBy, sortDir, debouncedFilters, pageSize, offset]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/knit-production-submission-list?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load knit production submissions.");
      }

      setRows(Array.isArray(data?.submissions) ? data.submissions : []);
      setTotalCount(Number.isFinite(data?.totalCount) ? Number(data.totalCount) : 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load knit production submissions.");
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
    setFilters(DEFAULT_FILTERS);
    setEntryDateFrom(def.from);
    setEntryDateTo(def.to);
    setSortBy("entryTs");
    setSortDir("desc");
    setPageIndex(0);
  }

  function applyRange(r: { from: string; to: string }) {
    setEntryDateFrom(r.from);
    setEntryDateTo(r.to);
  }

  const columns: Column<SubmissionRow>[] = useMemo(
    () => [
      {
        key: "entryDate",
        header: "ENTRY DATE",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="input"
              style={filterInput}
              type="date"
              value={entryDateFrom}
              onChange={(e) => setEntryDateFrom(e.target.value)}
              title="From"
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>–</span>
            <input
              className="input"
              style={filterInput}
              type="date"
              value={entryDateTo}
              onChange={(e) => setEntryDateTo(e.target.value)}
              title="To"
            />
          </div>
        ),
        render: (r) => fmtDateOnly(r.entryDate),
        getSearchText: (r) => fmtDateOnly(r.entryDate),
      },
      {
        key: "entryTs",
        header: "ENTRY TIME",
        sortable: true,
        render: (r) => fmtDateTime(r.entryTs),
        getSearchText: (r) => fmtDateTime(r.entryTs),
      },
      {
        key: "name",
        header: "NAME",
        sortable: true,
        filterable: true,
        placeholder: "Name",
        render: (r) => r.name ?? "",
        getSearchText: (r) => r.name ?? "",
      },
      {
        key: "shift",
        header: "SHIFT",
        sortable: true,
        render: (r) => r.shift ?? "",
        getSearchText: (r) => r.shift ?? "",
      },
      {
        key: "stockOrder",
        header: "STOCK ORDER",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.stockOrder}
            onChange={(e) => onFilterChange("stockOrder", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ),
        render: (r) => stockOrderBadge(!!r.stockOrder),
        getSearchText: (r) => (r.stockOrder ? "Yes Stock Order" : "No Sales Order"),
      },
      {
        key: "salesOrder",
        header: "SALES ORDER",
        sortable: true,
        filterable: true,
        placeholder: "Sales Order",
        render: (r) => r.salesOrder ?? r.salesOrderDisplay ?? "",
        getSearchText: (r) => r.salesOrder ?? r.salesOrderDisplay ?? "",
      },
      {
        key: "knitArea",
        header: "KNIT AREA",
        sortable: true,
        filterable: true,
        placeholder: "Knit Area",
        render: (r) => knitAreaBadge(r.knitArea),
        getSearchText: (r) => r.knitArea ?? "",
      },
      {
        key: "lineCount",
        header: "LINES",
        sortable: true,
        render: (r) => r.lineCount ?? 0,
        getSearchText: (r) => String(r.lineCount ?? 0),
      },
      {
        key: "totalQuantity",
        header: "TOTAL QTY",
        sortable: true,
        render: (r) => r.totalQuantity ?? 0,
        getSearchText: (r) => String(r.totalQuantity ?? 0),
      },
      {
        key: "notes",
        header: "NOTES",
        filterable: true,
        placeholder: "Notes",
        render: (r) => <span style={{ whiteSpace: "normal" }}>{r.notes ?? ""}</span>,
        getSearchText: (r) => r.notes ?? "",
      },
      {
        key: "view",
        header: "",
        render: (r) => (
          <Link
            href={`/knit-production/${encodeURIComponent(r.id)}`}
            className="btn btn-secondary btn-sm"
          >
            View
          </Link>
        ),
      },
      {
        key: "edit",
        header: "",
        render: (r) => (
          <Link
            href={`/knit-production/${encodeURIComponent(r.id)}/edit`}
            className="btn btn-primary btn-sm"
          >
            Edit
          </Link>
        ),
      },
    ],
    [entryDateFrom, entryDateTo, filters.stockOrder]
  );

  const toolbar = (
    <>
      <button
        type="button"
        onClick={clearFilters}
        className="btn btn-secondary"
        disabled={loading}
      >
        Clear Filters
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeLastNDays(7))}
        className="btn btn-secondary"
        disabled={loading}
      >
        Last 7
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeLastNDays(30))}
        className="btn btn-secondary"
        disabled={loading}
      >
        Last 30
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeLastNDays(90))}
        className="btn btn-secondary"
        disabled={loading}
      >
        Last 90
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeThisMonth())}
        className="btn btn-secondary"
        disabled={loading}
      >
        This Month
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangePrevMonth())}
        className="btn btn-secondary"
        disabled={loading}
      >
        Prev Month
      </button>

      <button
        type="button"
        onClick={() => applyRange(getRangeToday())}
        className="btn btn-secondary"
        disabled={loading}
      >
        Today Only
      </button>
    </>
  );

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Knit Production</h1>
          <p className="page-subtitle">
            Track and review knit production submissions.
          </p>
        </div>

        <Link href="/knit-production/add" className="btn btn-primary">
          + New Knit Production
        </Link>
      </div>

      <DataTable<SubmissionRow>
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
        toolbar={toolbar}
        rowKey={(r) => r.id}
        emptyText="No knit production submissions found."
        globalSearchPlaceholder="Search current view…"
        csvFilename="knit-production.csv"
        rowToCsv={(r) => ({
          "Entry Date": fmtDateOnly(r.entryDate),
          "Entry Time": fmtDateTime(r.entryTs),
          Name: r.name ?? "",
          Shift: r.shift ?? "",
          "Stock Order": r.stockOrder ? "Yes" : "No",
          "Sales Order": r.salesOrder ?? r.salesOrderDisplay ?? "",
          "Knit Area": r.knitArea ?? "",
          "Line Count": r.lineCount ?? 0,
          "Total Quantity": r.totalQuantity ?? 0,
          Notes: r.notes ?? "",
        })}
      />

      <div className="text-soft" style={{ marginTop: 8, fontSize: 12 }}>
        Standardized Knit Production list using the shared DataTable pattern.
      </div>
    </div>
  );
}

const filterInput: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "4px 6px",
  borderRadius: 4,
};