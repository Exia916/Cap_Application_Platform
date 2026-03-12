"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { btnSecondary, type Column, type SortDir } from "@/components/DataTable";

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

// ✅ Shift Date display helper: shows date only, never time
function fmtShiftDateOnly(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return ymdChicago(dt);
}

// ✅ remove commas helper (SO, employee #, etc.)
function stripCommas(v: any) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/,/g, "");
}

// ✅ show blank for null/undefined (instead of 0)
function fmtMaybeNumber(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  const s = stripCommas(v);
  return s;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
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

function getRangeThisMonth(): { from: string; to: string } {
  const now = new Date();
  return { from: startOfMonthChicago(now), to: endOfMonthChicago(now) };
}

function getRangePrevMonth(): { from: string; to: string } {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  return { from: startOfMonthChicago(prev), to: endOfMonthChicago(prev) };
}

type SubmissionRow = {
  id: string;
  entryTs: string;
  shiftDate?: string;
  name: string;
  machineNumber: number | null;
  salesOrder: number | null;
  lineCount: number;
  totalStitches: number | null;
  totalPieces: number | null;
  notes: string | null;
};

type SortBy =
  | "shiftDate"
  | "entryTs"
  | "name"
  | "machineNumber"
  | "salesOrder"
  | "lineCount"
  | "totalStitches"
  | "totalPieces";

type Filters = {
  name: string;
  machineNumber: string;
  salesOrder: string;
  notes: string;
};

const DEFAULT_FILTERS: Filters = {
  name: "",
  machineNumber: "",
  salesOrder: "",
  notes: "",
};

export default function DailyProductionPage() {
  const def = useMemo(() => getRangeLastNDays(30), []);
  const [shiftDateFrom, setShiftDateFrom] = useState(def.from);
  const [shiftDateTo, setShiftDateTo] = useState(def.to);

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
  }, [shiftDateFrom, shiftDateTo, sortBy, sortDir, debouncedFilters, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("shiftDateFrom", shiftDateFrom);
    sp.set("shiftDateTo", shiftDateTo);

    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);

    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));

    if (debouncedFilters.name.trim()) sp.set("name", debouncedFilters.name.trim());
    if (debouncedFilters.machineNumber.trim()) sp.set("machineNumber", debouncedFilters.machineNumber.trim());
    if (debouncedFilters.salesOrder.trim()) sp.set("salesOrder", debouncedFilters.salesOrder.trim());
    if (debouncedFilters.notes.trim()) sp.set("notes", debouncedFilters.notes.trim());

    return sp.toString();
  }, [shiftDateFrom, shiftDateTo, sortBy, sortDir, debouncedFilters, pageSize, offset]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/daily-production-submission-list?${qs}`, {
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load submissions.");

      setRows(Array.isArray(data?.submissions) ? data.submissions : []);
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

  // ✅ Clear All: clears text filters AND resets date range back to default
  function clearFilters() {
    setFilters(DEFAULT_FILTERS);

    // reset the date range back to default (Last 30)
    setShiftDateFrom(def.from);
    setShiftDateTo(def.to);

    // optional but usually expected for "Clear All"
    setSortBy("entryTs");
    setSortDir("desc");
    setPageIndex(0);
  }

  function applyRange(r: { from: string; to: string }) {
    setShiftDateFrom(r.from);
    setShiftDateTo(r.to);
  }

  const columns: Column<SubmissionRow>[] = useMemo(
    () => [
      {
        key: "shiftDate",
        header: "SHIFT DATE",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              style={filterInput}
              type="date"
              value={shiftDateFrom}
              onChange={(e) => setShiftDateFrom(e.target.value)}
              title="From"
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>–</span>
            <input
              style={filterInput}
              type="date"
              value={shiftDateTo}
              onChange={(e) => setShiftDateTo(e.target.value)}
              title="To"
            />
          </div>
        ),
        render: (r) => fmtShiftDateOnly(r.shiftDate),
        getSearchText: (r) => fmtShiftDateOnly(r.shiftDate),
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
        key: "machineNumber",
        header: "MACHINE",
        sortable: true,
        filterable: true,
        placeholder: "Machine (starts with)",
        render: (r) => fmtMaybeNumber(r.machineNumber),
        getSearchText: (r) => fmtMaybeNumber(r.machineNumber),
      },
      {
        key: "salesOrder",
        header: "SO",
        sortable: true,
        filterable: true,
        placeholder: "Sales Order (starts with)",
        render: (r) => fmtMaybeNumber(r.salesOrder),
        getSearchText: (r) => fmtMaybeNumber(r.salesOrder),
      },
      {
        key: "lineCount",
        header: "LINES",
        sortable: true,
        render: (r) => r.lineCount ?? 0,
        getSearchText: (r) => String(r.lineCount ?? 0),
      },
      {
        key: "totalStitches",
        header: "TOTAL STITCHES",
        sortable: true,
        render: (r) => fmtMaybeNumber(r.totalStitches),
        getSearchText: (r) => fmtMaybeNumber(r.totalStitches),
      },
      {
        key: "totalPieces",
        header: "TOTAL PIECES",
        sortable: true,
        render: (r) => fmtMaybeNumber(r.totalPieces),
        getSearchText: (r) => fmtMaybeNumber(r.totalPieces),
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
        key: "edit",
        header: "",
        render: (r) => <Link href={`/daily-production/${r.id}/edit`}>Edit</Link>,
      },
    ],
    [shiftDateFrom, shiftDateTo]
  );

  const toolbar = (
    <>
      <button type="button" onClick={clearFilters} style={btnSecondary} disabled={loading}>
        Clear Filters
      </button>

      <button type="button" onClick={() => applyRange(getRangeLastNDays(7))} style={btnSecondary} disabled={loading}>
        Last 7
      </button>
      <button type="button" onClick={() => applyRange(getRangeLastNDays(30))} style={btnSecondary} disabled={loading}>
        Last 30
      </button>
      <button type="button" onClick={() => applyRange(getRangeLastNDays(90))} style={btnSecondary} disabled={loading}>
        Last 90
      </button>
      <button type="button" onClick={() => applyRange(getRangeThisMonth())} style={btnSecondary} disabled={loading}>
        This Month
      </button>
      <button type="button" onClick={() => applyRange(getRangePrevMonth())} style={btnSecondary} disabled={loading}>
        Prev Month
      </button>
      <button type="button" onClick={() => applyRange(getRangeToday())} style={btnSecondary} disabled={loading}>
        Today Only
      </button>
    </>
  );

  return (
    <div style={page}>
      <div style={headerRow}>
        <h1 style={{ margin: 0 }}>Daily Production</h1>
        <Link href="/daily-production/add" className="btn btn-primary">
        + Add Entry
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
        emptyText="No submissions found."
        globalSearchPlaceholder="Search current view… (SO, machine, name, notes)"
        csvFilename="daily-production.csv"
        rowToCsv={(r) => ({
          "Shift Date": fmtShiftDateOnly(r.shiftDate),
          "Name": r.name ?? "",
          "Machine": stripCommas(r.machineNumber ?? ""),
          "SO": stripCommas(r.salesOrder ?? ""),
          "Lines": r.lineCount ?? 0,
          "Total Stitches": r.totalStitches ?? "",
          "Total Pieces": r.totalPieces ?? "",
          "Notes": r.notes ?? "",
        })}
      />

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
        Note: This list shows submissions created after the new submission system was enabled.
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */

const page: React.CSSProperties = { padding: 24, maxWidth: "100%" };

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const filterInput: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #ddd",
  borderRadius: 4,
};