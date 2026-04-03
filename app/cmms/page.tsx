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

  type: string | null;
  tech: string | null;
  status: string;
  resolution: string | null;
  downTimeRecorded: string | null;
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

function defaultFromTo() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  return { from: ymdChicago(from), to: ymdChicago(now) };
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

export default function CMMSPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [sortBy, setSortBy] = useState("requestedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [{ from, to }, setRange] = useState(defaultFromTo());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hideResolved, setHideResolved] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/cmms/tech/work-orders", window.location.origin);
      url.searchParams.set("pageIndex", String(pageIndex));
      url.searchParams.set("pageSize", String(pageSize));
      url.searchParams.set("sortBy", sortBy);
      url.searchParams.set("sortDir", sortDir);

      if (from) url.searchParams.set("requestedFrom", from);
      if (to) url.searchParams.set("requestedTo", to);
      if (hideResolved) url.searchParams.set("excludeResolved", "true");

      for (const [k, v] of Object.entries(filters)) {
        if (v?.trim()) url.searchParams.set(`f_${k}`, v.trim());
      }

      const res = await fetch(url.toString(), { cache: "no-store", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);

      setRows((data as any).rows || []);
      setTotalCount((data as any).totalCount || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load CMMS");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageSize, sortBy, sortDir, from, to, hideResolved, JSON.stringify(filters)]);

  const columns: Column<Row>[] = useMemo(() => {
    const cell = (key: keyof Row) => (r: Row) => {
      const v: any = (r as any)[key];
      return v == null ? "" : String(v);
    };

    const dt = (ts: string) => {
      if (!ts) return "";
      const d = new Date(ts);
      return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(ts);
    };

    return [
      {
        key: "workOrderId",
        header: "WO#",
        sortable: true,
        filterable: true,
        placeholder: "WO…",
        render: cell("workOrderId"),
        getSearchText: (r) => String(r.workOrderId ?? ""),
      },
      {
        key: "requestedAt",
        header: "Requested",
        sortable: true,
        filterable: false,
        render: (r) => dt(r.requestedAt),
        getSearchText: (r) => dt(r.requestedAt),
      },
      {
        key: "requestedByName",
        header: "Requester",
        sortable: true,
        filterable: true,
        placeholder: "Name…",
        render: cell("requestedByName"),
      },
      {
        key: "department",
        header: "Department",
        sortable: true,
        filterable: true,
        placeholder: "Dept…",
        render: cell("department"),
      },
      {
        key: "asset",
        header: "Asset",
        sortable: true,
        filterable: true,
        placeholder: "Asset…",
        render: cell("asset"),
      },
      {
        key: "priority",
        header: "Priority",
        sortable: true,
        filterable: true,
        placeholder: "Priority…",
        render: cell("priority"),
      },
      {
        key: "operatorInitials",
        header: "Op Name",
        sortable: false,
        serverSortable: false,
        filterable: true,
        placeholder: "DT…",
        render: cell("operatorInitials"),
      },
      {
        key: "commonIssue",
        header: "Common Issue",
        sortable: true,
        filterable: true,
        placeholder: "Issue…",
        render: cell("commonIssue"),
      },
      {
        key: "issueDialogue",
        header: "Issue Dialogue",
        sortable: false,
        serverSortable: false,
        filterable: true,
        placeholder: "Contains…",
        render: cell("issueDialogue"),
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        filterable: true,
        placeholder: "Type…",
        render: cell("type"),
      },
      {
        key: "tech",
        header: "Tech",
        sortable: true,
        filterable: true,
        placeholder: "Tech…",
        render: cell("tech"),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        filterable: true,
        placeholder: "Status…",
        render: (r) => {
          const label = r.status == null ? "" : String(r.status);
          return <span style={statusPillStyle(label)}>{label}</span>;
        },
        getSearchText: (r) => String(r.status ?? ""),
      },
      {
        key: "downTimeRecorded",
        header: "Down Time",
        sortable: false,
        serverSortable: false,
        filterable: true,
        placeholder: "Down time…",
        render: cell("downTimeRecorded"),
      },
      {
        key: "resolution",
        header: "Resolution",
        sortable: false,
        serverSortable: false,
        filterable: true,
        placeholder: "Resolution…",
        render: cell("resolution"),
      },
      {
        key: "view",
        header: "",
        filterable: false,
        sortable: false,
        serverSortable: false,
        render: (r) => (
          <Link href={`/cmms/${r.workOrderId}`} className="btn btn-secondary btn-sm">
            View
          </Link>
        ),
      },
      {
        key: "edit",
        header: "",
        filterable: false,
        sortable: false,
        serverSortable: false,
        render: (r) => (
          <Link href={`/cmms/${r.workOrderId}/edit`} className="btn btn-primary btn-sm">
            Open
          </Link>
        ),
      },
    ];
  }, []);

  return (
    <div className="page-shell-table">
      <div className="page-header">
        <h1 className="page-title">CMMS</h1>
        <Link href="/cmms/add" className="btn btn-primary">
          + Add Request
        </Link>
      </div>

      {error ? <div className="alert alert-danger" style={{ marginTop: 8 }}>{error}</div> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <span>From</span>
        <input
          value={from}
          onChange={(e) => {
            setPageIndex(0);
            setRange((r) => ({ ...r, from: e.target.value }));
          }}
          type="date"
        />

        <span>To</span>
        <input
          value={to}
          onChange={(e) => {
            setPageIndex(0);
            setRange((r) => ({ ...r, to: e.target.value }));
          }}
          type="date"
        />

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
          className="btn btn-secondary"
          onClick={() => {
            setPageIndex(0);
            setPageSize(25);
            setSortBy("requestedAt");
            setSortDir("desc");
            setFilters({});
            setRange(defaultFromTo());
            setHideResolved(true);
          }}
        >
          Clear Filters
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <DataTable
          rows={rows}
          columns={columns}
          loading={loading}
          error={error}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={totalCount}
          sortBy={sortBy}
          sortDir={sortDir}
          rowKey={(r) => String(r.workOrderId)}
          onPageIndexChange={(next) => setPageIndex(next)}
          onPageSizeChange={(next) => {
            setPageIndex(0);
            setPageSize(next);
          }}
          onToggleSort={(key) => {
            if (sortBy === key) {
              setSortDir(sortDir === "asc" ? "desc" : "asc");
            } else {
              setSortBy(key);
              setSortDir("asc");
            }
            setPageIndex(0);
          }}
          filters={filters}
          onFilterChange={(key, value) => {
            setPageIndex(0);
            setFilters((prev) => ({ ...prev, [key]: value }));
          }}
          csvFilename="cmms.csv"
          globalSearchPlaceholder="Search current view…"
        />
      </div>
    </div>
  );
}