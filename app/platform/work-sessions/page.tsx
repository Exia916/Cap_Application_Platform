"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type MeResponse = {
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
};

type WorkSessionRow = {
  id: string;
  moduleKey: string;
  areaCode: string;
  workDate: string;
  shiftDate: string | null;
  shift: string | null;
  userId: string | null;
  username: string | null;
  employeeNumber: number | null;
  operatorName: string;
  timeIn: string;
  timeOut: string | null;
  isOpen: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
};

type SortBy = "timeIn" | "workDate" | "shiftDate" | "operatorName" | "areaCode" | "isOpen";

type Filters = {
  moduleKey: string;
  areaCode: string;
  isOpen: string;
};

const DEFAULT_FILTERS: Filters = {
  moduleKey: "",
  areaCode: "",
  isOpen: "",
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

function fmtDateOnly(v?: string | null): string {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : ymdChicago(d);
}

function fmtDateTime(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function durationText(timeIn?: string | null, timeOut?: string | null) {
  if (!timeIn) return "";
  const start = new Date(timeIn);
  const end = timeOut ? new Date(timeOut) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return "";
  }

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function isElevatedRole(role?: string | null) {
  const v = String(role ?? "").trim().toUpperCase();
  return v === "ADMIN" || v === "MANAGER" || v === "SUPERVISOR";
}

export default function WorkSessionsPage() {
  const def = useMemo(() => getRangeLastNDays(30), []);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [workDateFrom, setWorkDateFrom] = useState(def.from);
  const [workDateTo, setWorkDateTo] = useState(def.to);

  const [rows, setRows] = useState<WorkSessionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("timeIn");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const offset = pageIndex * pageSize;
  const elevated = isElevatedRole(me?.role);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setMe(data);
        }
      } catch {
        setMe(null);
      }
    })();
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [workDateFrom, workDateTo, sortBy, sortDir, filters.moduleKey, filters.areaCode, filters.isOpen, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("workDateFrom", workDateFrom);
    sp.set("workDateTo", workDateTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("limit", String(pageSize));
    sp.set("offset", String(offset));

    if (filters.moduleKey.trim()) sp.set("moduleKey", filters.moduleKey.trim());
    if (filters.areaCode.trim()) sp.set("areaCode", filters.areaCode.trim());
    if (filters.isOpen === "true" || filters.isOpen === "false") sp.set("isOpen", filters.isOpen);

    if (!elevated && me?.employeeNumber != null) {
      sp.set("employeeNumber", String(me.employeeNumber));
    }

    return sp.toString();
  }, [workDateFrom, workDateTo, sortBy, sortDir, pageSize, offset, filters, elevated, me?.employeeNumber]);

  async function load(qs: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/platform/work-sessions?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load work sessions.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number.isFinite(data?.totalCount) ? Number(data.totalCount) : 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load work sessions.");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!elevated && me?.employeeNumber == null) return;
    load(queryString);
  }, [queryString, elevated, me?.employeeNumber]);

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
    setWorkDateFrom(def.from);
    setWorkDateTo(def.to);
    setSortBy("timeIn");
    setSortDir("desc");
    setPageIndex(0);
  }

  const columns: Column<WorkSessionRow>[] = useMemo(
    () => [
      {
        key: "workDate",
        header: "WORK DATE",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="input"
              style={{ minWidth: 0, width: 150 }}
              type="date"
              value={workDateFrom}
              onChange={(e) => setWorkDateFrom(e.target.value)}
              title="From"
            />
            <span style={{ fontSize: 12, opacity: 0.7 }}>–</span>
            <input
              className="input"
              style={{ minWidth: 0, width: 150 }}
              type="date"
              value={workDateTo}
              onChange={(e) => setWorkDateTo(e.target.value)}
              title="To"
            />
          </div>
        ),
        render: (r) => fmtDateOnly(r.workDate),
        getSearchText: (r) => fmtDateOnly(r.workDate),
      },
      {
        key: "timeIn",
        header: "TIME IN",
        sortable: true,
        render: (r) => fmtDateTime(r.timeIn),
        getSearchText: (r) => fmtDateTime(r.timeIn),
      },
      {
        key: "operatorName",
        header: "OPERATOR",
        sortable: true,
        render: (r) => r.operatorName ?? "",
        getSearchText: (r) => `${r.operatorName ?? ""} ${r.username ?? ""} ${r.employeeNumber ?? ""}`,
      },
      {
        key: "areaCode",
        header: "AREA",
        sortable: true,
        filterable: true,
        placeholder: "Area",
        render: (r) => r.areaCode ?? "",
        getSearchText: (r) => r.areaCode ?? "",
      },
      {
        key: "isOpen",
        header: "STATUS",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.isOpen}
            onChange={(e) => onFilterChange("isOpen", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Open</option>
            <option value="false">Closed</option>
          </select>
        ),
        render: (r) => (
          <span className={r.isOpen ? "badge badge-success" : "badge badge-neutral"}>
            {r.isOpen ? "Open" : "Closed"}
          </span>
        ),
        getSearchText: (r) => (r.isOpen ? "Open" : "Closed"),
      },
      {
        key: "shiftDate",
        header: "SHIFT DATE",
        sortable: true,
        render: (r) => fmtDateOnly(r.shiftDate),
        getSearchText: (r) => fmtDateOnly(r.shiftDate),
      },
      {
        key: "moduleKey",
        header: "MODULE",
        sortable: false,
        filterable: true,
        placeholder: "Module",
        render: (r) => r.moduleKey ?? "",
        getSearchText: (r) => r.moduleKey ?? "",
      },
      {
        key: "duration",
        header: "DURATION",
        sortable: false,
        serverSortable: false,
        render: (r) => durationText(r.timeIn, r.timeOut),
        getSearchText: (r) => durationText(r.timeIn, r.timeOut),
      },
      {
        key: "notes",
        header: "NOTES",
        sortable: false,
        serverSortable: false,
        render: (r) => r.notes ?? "",
        getSearchText: (r) => r.notes ?? "",
      },
      {
        key: "view",
        header: "",
        sortable: false,
        serverSortable: false,
        render: (r) => (
          <Link href={`/platform/work-sessions/${r.id}`} className="btn btn-secondary btn-sm">
            View
          </Link>
        ),
      },
    ],
    [filters.isOpen, workDateFrom, workDateTo]
  );

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Work Sessions</h1>
          <p className="page-subtitle">
            Review and manage production work sessions across modules.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <DataTable<WorkSessionRow>
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
        emptyText="No work sessions found."
        toolbar={
          <>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          </>
        }
        rowToCsv={(row) => ({
          id: row.id,
          module: row.moduleKey,
          area: row.areaCode,
          work_date: row.workDate,
          shift_date: row.shiftDate,
          shift: row.shift,
          operator_name: row.operatorName,
          employee_number: row.employeeNumber,
          time_in: row.timeIn,
          time_out: row.timeOut,
          status: row.isOpen ? "Open" : "Closed",
          duration: durationText(row.timeIn, row.timeOut),
          notes: row.notes,
        })}
      />
    </div>
  );
}