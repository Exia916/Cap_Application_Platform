"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type Row = {
  workOrderId: number;
  requestedAt: string;
  requestedByName: string;
  department: string;
  asset: string;
  priority: string;
  operatorInitials: string | null;
  commonIssue: string;
  issueDialogue: string;
  tech: string | null;
  status: string;
};

type ApiResponse = {
  rows: Row[];
  totalCount: number;
};

const DEFAULT_PAGE_SIZE = 25;

function ymdLocal(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function normStatus(s: unknown) {
  return String(s ?? "").trim().toLowerCase();
}

function statusPillStyle(statusRaw: unknown): React.CSSProperties {
  const s = normStatus(statusRaw);

  let bg = "rgba(148, 163, 184, 0.25)";
  let border = "rgba(148, 163, 184, 0.55)";
  let fg = "rgb(51, 65, 85)";

  if (s === "resolved") {
    bg = "rgba(34, 197, 94, 0.18)";
    border = "rgba(34, 197, 94, 0.55)";
    fg = "rgb(20, 83, 45)";
  } else if (s === "open") {
    bg = "rgba(239, 68, 68, 0.18)";
    border = "rgba(239, 68, 68, 0.55)";
    fg = "rgb(127, 29, 29)";
  } else if (s === "parts on order") {
    bg = "rgba(249, 115, 22, 0.18)";
    border = "rgba(249, 115, 22, 0.55)";
    fg = "rgb(124, 45, 18)";
  } else if (s === "in process") {
    bg = "rgba(234, 179, 8, 0.20)";
    border = "rgba(234, 179, 8, 0.60)";
    fg = "rgb(113, 63, 18)";
  } else if (s === "waiting on tech support") {
    bg = "rgba(59, 130, 246, 0.18)";
    border = "rgba(59, 130, 246, 0.55)";
    fg = "rgb(30, 58, 138)";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color: fg,
    fontWeight: 600,
    fontSize: 12,
    lineHeight: "18px",
    whiteSpace: "nowrap",
  };
}

export default function RepairRequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<string>("requestedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [filters, setFilters] = useState<Record<string, string>>({
    workOrderId: "",
    requestedByName: "",
    department: "",
    asset: "",
    priority: "",
    operatorInitials: "",
    commonIssue: "",
    issueDialogue: "",
    tech: "",
    status: "",
  });

  const [requestedFrom, setRequestedFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return ymdLocal(d);
  });
  const [requestedTo, setRequestedTo] = useState<string>(() => ymdLocal(new Date()));

  const [hideResolved, setHideResolved] = useState(true);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/cmms/work-orders", window.location.origin);

      url.searchParams.set("pageIndex", String(pageIndex));
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("sortBy", sortBy);
      url.searchParams.set("sortDir", sortDir);

      if (requestedFrom) url.searchParams.set("requestedFrom", requestedFrom);
      if (requestedTo) url.searchParams.set("requestedTo", requestedTo);
      if (hideResolved) url.searchParams.set("excludeResolved", "true");

      for (const [k, v] of Object.entries(filters)) {
        const val = (v ?? "").trim();
        if (val) url.searchParams.set(`f_${k}`, val);
      }

      const res = await fetch(url.toString(), { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || `Failed to load work orders (HTTP ${res.status})`);
      }

      const data = (await res.json()) as ApiResponse;
      setRows(data.rows || []);
      setTotalCount(Number(data.totalCount || 0));
    } catch (e: any) {
      setError(e?.message || "Failed to load work orders");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDir, pageIndex, pageSize, requestedFrom, requestedTo, hideResolved, JSON.stringify(filters)]);

  function onToggleSort(nextKey: string) {
    setPageIndex(0);
    setSortBy(nextKey);
    setSortDir((prev) => {
      if (sortBy !== nextKey) return "desc";
      return prev === "asc" ? "desc" : "asc";
    });
  }

  function onFilterChange(key: string, value: string) {
    setPageIndex(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function setPreset(kind: "today" | "last7" | "last30" | "thisMonth" | "prevMonth") {
    const now = new Date();

    if (kind === "today") {
      const t = ymdLocal(now);
      setRequestedFrom(t);
      setRequestedTo(t);
      setPageIndex(0);
      return;
    }
    if (kind === "last7") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setRequestedFrom(ymdLocal(d));
      setRequestedTo(ymdLocal(now));
      setPageIndex(0);
      return;
    }
    if (kind === "last30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setRequestedFrom(ymdLocal(d));
      setRequestedTo(ymdLocal(now));
      setPageIndex(0);
      return;
    }
    if (kind === "thisMonth") {
      setRequestedFrom(ymdLocal(startOfMonth(now)));
      setRequestedTo(ymdLocal(endOfMonth(now)));
      setPageIndex(0);
      return;
    }
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setRequestedFrom(ymdLocal(startOfMonth(prev)));
    setRequestedTo(ymdLocal(endOfMonth(prev)));
    setPageIndex(0);
  }

  const columns: Column<Row>[] = useMemo(
    () => [
      {
        key: "workOrderId",
        header: "WORK ORDER ID",
        width: 140,
        sortable: true,
        filterable: true,
        placeholder: "WO…",
        getSearchText: (r) => String(r.workOrderId),
        render: (r) => String(r.workOrderId),
      },
      {
        key: "requestedAt",
        header: "DATE",
        width: 140,
        sortable: true,
        filterable: false,
        render: (r) => new Date(r.requestedAt).toLocaleDateString(),
      },
      {
        key: "time",
        header: "TIME",
        width: 120,
        sortable: false,
        serverSortable: false,
        filterable: false,
        getSearchText: (r) => r.requestedAt,
        render: (r) =>
          new Date(r.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      {
        key: "requestedByName",
        header: "NAME",
        width: 220,
        sortable: true,
        filterable: true,
        placeholder: "Name…",
        render: (r) => r.requestedByName,
      },
      {
        key: "department",
        header: "DEPARTMENT",
        width: 180,
        sortable: true,
        filterable: true,
        placeholder: "Dept…",
        render: (r) => r.department,
      },
      {
        key: "asset",
        header: "ASSET",
        width: 180,
        sortable: true,
        filterable: true,
        placeholder: "Asset…",
        render: (r) => r.asset,
      },
      {
        key: "priority",
        header: "PRIORITY",
        width: 120,
        sortable: true,
        filterable: true,
        placeholder: "Priority…",
        render: (r) => r.priority,
      },
      {
        key: "operatorInitials",
        header: "OP Name",
        width: 90,
        sortable: true,
        filterable: true,
        placeholder: "DT…",
        render: (r) => r.operatorInitials || "",
      },
      {
        key: "commonIssue",
        header: "COMMON ISSUE",
        width: 220,
        sortable: true,
        filterable: true,
        placeholder: "Issue…",
        render: (r) => r.commonIssue,
      },
      {
        key: "issueDialogue",
        header: "ISSUE DIALOGUE",
        width: 380,
        sortable: true,
        filterable: true,
        placeholder: "Contains…",
        render: (r) => r.issueDialogue,
      },
      {
        key: "tech",
        header: "TECH",
        width: 200,
        sortable: true,
        filterable: true,
        placeholder: "Tech…",
        render: (r) => r.tech || "",
      },
      {
        key: "status",
        header: "STATUS",
        width: 140,
        sortable: true,
        filterable: true,
        placeholder: "Status…",
        getSearchText: (r) => String(r.status ?? ""),
        render: (r) => {
          const label = r.status == null ? "" : String(r.status);
          return <span style={statusPillStyle(label)}>{label}</span>;
        },
      },
      {
        key: "view",
        header: "",
        width: 90,
        sortable: false,
        serverSortable: false,
        filterable: false,
        render: (r) => (
          <Link href={`/cmms/${r.workOrderId}`} className="btn btn-secondary btn-sm">
            View
          </Link>
        ),
      },
      {
        key: "edit",
        header: "",
        width: 90,
        sortable: false,
        serverSortable: false,
        filterable: false,
        render: (r) => (
          <Link href={`/cmms/repair-requests/${r.workOrderId}`} className="btn btn-primary btn-sm">
            Edit
          </Link>
        ),
      },
    ],
    []
  );

  const toolbar = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button type="button" className="btn btn-secondary" onClick={() => setPreset("today")} disabled={loading}>
        Today
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setPreset("last7")} disabled={loading}>
        Last 7
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setPreset("last30")} disabled={loading}>
        Last 30
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setPreset("thisMonth")} disabled={loading}>
        This Month
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setPreset("prevMonth")} disabled={loading}>
        Prev Month
      </button>

      <div style={{ width: 1, height: 22, background: "#e5e7eb", margin: "0 4px" }} />

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>From</span>
        <input
          type="date"
          value={requestedFrom}
          onChange={(e) => {
            setPageIndex(0);
            setRequestedFrom(e.target.value);
          }}
          style={dateInput}
          disabled={loading}
        />
        <span style={{ fontSize: 12, opacity: 0.75 }}>To</span>
        <input
          type="date"
          value={requestedTo}
          onChange={(e) => {
            setPageIndex(0);
            setRequestedTo(e.target.value);
          }}
          style={dateInput}
          disabled={loading}
        />
      </div>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginLeft: 4,
          fontSize: 13,
          whiteSpace: "nowrap",
        }}
      >
        <input
          type="checkbox"
          checked={hideResolved}
          onChange={(e) => {
            setPageIndex(0);
            setHideResolved(e.target.checked);
          }}
        />
        Hide Resolved
      </label>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setFilters({
            workOrderId: "",
            requestedByName: "",
            department: "",
            asset: "",
            priority: "",
            operatorInitials: "",
            commonIssue: "",
            issueDialogue: "",
            tech: "",
            status: "",
          });
          setSortBy("requestedAt");
          setSortDir("desc");
          setPageIndex(0);
          setPageSize(DEFAULT_PAGE_SIZE);
          const d = new Date();
          d.setDate(d.getDate() - 30);
          setRequestedFrom(ymdLocal(d));
          setRequestedTo(ymdLocal(new Date()));
          setHideResolved(true);
        }}
        disabled={loading}
        title="Clear all filters + reset date range"
      >
        Clear Filters
      </button>
    </div>
  );

  return (
    <div className="page-shell-table">
      <div className="page-header">
        <h1 className="page-title">Repair Requests</h1>
        <Link href="/cmms/repair-requests/add" className="btn btn-primary">
          + Add Request
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        rowKey={(r: Row) => String(r.workOrderId)}
        emptyText="No results found."
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
          setPageIndex(0);
          setPageSize(n);
        }}
        toolbar={toolbar}
        enableGlobalSearch={true}
        globalSearchPlaceholder="Search current view… (WO, name, dept, issue, etc.)"
        enableCsvExport={true}
        csvFilename="work_orders.csv"
      />
    </div>
  );
}

const dateInput: React.CSSProperties = {
  width: 140,
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #ddd",
  borderRadius: 6,
  background: "#fff",
};