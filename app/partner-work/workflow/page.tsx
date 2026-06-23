"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type PartnerInfo = {
  id: string;
  code: string;
  name: string;
  type: string;
  role: string;
};

type ExternalWorkflowRow = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;
  dueDate: string | null;
  customerName: string | null;
  digitizerName: string | null;
  designerName: string | null;
  statusCode: string;
  statusLabel: string;
  tapeNumber: string | null;
  rush: boolean;
  styleCode: string | null;
  externalAssignmentField: "designer" | "digitizer";
};

type Filters = {
  statusCode: string;
  search: string;
};

const DEFAULT_FILTERS: Filters = {
  statusCode: "",
  search: "",
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

function fmtDateOnly(value?: string | null): string {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : ymdChicago(d);
}

function statusBadge(row: ExternalWorkflowRow) {
  const code = String(row.statusCode || "").toUpperCase();
  let cls = "badge badge-neutral";

  if (code === "INSTOCK_CONCEPTS" || code === "SIGN_IN_PROGRESS") {
    cls = "badge badge-brand-blue";
  } else if (code === "A" || code === "RA") {
    cls = "badge badge-warning";
  }

  return <span className={cls}>{row.statusLabel || row.statusCode}</span>;
}

function assignmentName(row: ExternalWorkflowRow): string {
  return row.externalAssignmentField === "digitizer"
    ? row.digitizerName || "Unassigned"
    : row.designerName || "Unassigned";
}

function assignmentLabel(row: ExternalWorkflowRow): string {
  return row.externalAssignmentField === "digitizer" ? "Digitizer" : "Designer";
}

function statusOptionsForPartner(partner: PartnerInfo | null) {
  if (partner?.type === "WORKFLOW_DIGITIZING") {
    return [
      { code: "SIGN_IN_PROGRESS", label: "Sign in Progress" },
    ];
  }

  return [
    { code: "INSTOCK_CONCEPTS", label: "Instock Concepts" },
    { code: "A", label: "A PO To Art Dept." },
    { code: "RA", label: "Ra Revisions" },
  ];
}

export default function PartnerWorkflowPage() {
  const router = useRouter();

  const [rows, setRows] = useState<ExternalWorkflowRow[]>([]);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");

  const [sortBy, setSortBy] = useState("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedFilters, dueDateFrom, dueDateTo, sortBy, sortDir, pageSize]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();

    sp.set("page", String(pageIndex + 1));
    sp.set("pageSize", String(pageSize));
    sp.set("sortField", sortBy);
    sp.set("sortDir", sortDir);

    if (debouncedFilters.statusCode) {
      sp.set("statusCode", debouncedFilters.statusCode);
    }

    if (debouncedFilters.search.trim()) {
      sp.set("search", debouncedFilters.search.trim());
    }

    if (dueDateFrom) sp.set("dueDateFrom", dueDateFrom);
    if (dueDateTo) sp.set("dueDateTo", dueDateTo);

    return sp.toString();
  }, [debouncedFilters, dueDateFrom, dueDateTo, pageIndex, pageSize, sortBy, sortDir]);

  async function loadRows(qs: string) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/partner-work/workflow?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load partner Workflow records.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number.isFinite(data?.totalCount) ? Number(data.totalCount) : 0);
      setPartner(data?.partner ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load partner Workflow records.");
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

    setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setDueDateFrom("");
    setDueDateTo("");
    setSortBy("dueDate");
    setSortDir("asc");
    setPageIndex(0);
  }

  const columns: Column<ExternalWorkflowRow>[] = useMemo(
    () => [
      {
        key: "requestNumber",
        header: "Request #",
        sortable: true,
        render: (row) => row.requestNumber,
        getSearchText: (row) => row.requestNumber,
      },
      {
        key: "statusLabel",
        header: "Status",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.statusCode}
            onChange={(e) => onFilterChange("statusCode", e.target.value)}
          >
            <option value="">All</option>
            {statusOptionsForPartner(partner).map((status) => (
              <option key={status.code} value={status.code}>
                {status.label}
              </option>
            ))}
          </select>
        ),
        render: (row) => statusBadge(row),
        getSearchText: (row) => row.statusLabel,
      },
      {
        key: "tapeNumber",
        header: "Tape #",
        sortable: true,
        render: (row) => row.tapeNumber ?? "",
        getSearchText: (row) => row.tapeNumber ?? "",
      },
      {
        key: "tapeName",
        header: "Tape Name",
        sortable: true,
        render: (row) => row.tapeName ?? "",
        getSearchText: (row) => row.tapeName ?? "",
      },
      {
        key: "customerName",
        header: "Customer",
        sortable: true,
        render: (row) => row.customerName ?? "",
        getSearchText: (row) => row.customerName ?? "",
      },
      {
        key: "styleCode",
        header: "Style",
        sortable: true,
        render: (row) => row.styleCode ?? "",
        getSearchText: (row) => row.styleCode ?? "",
      },
      {
        key: "dueDate",
        header: "Due Date",
        sortable: true,
        filterRender: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              className="input"
              type="date"
              value={dueDateFrom}
              onChange={(e) => setDueDateFrom(e.target.value)}
              title="Due date from"
              style={{ minWidth: 128 }}
            />
            <span className="text-soft">–</span>
            <input
              className="input"
              type="date"
              value={dueDateTo}
              onChange={(e) => setDueDateTo(e.target.value)}
              title="Due date to"
              style={{ minWidth: 128 }}
            />
          </div>
        ),
        render: (row) => fmtDateOnly(row.dueDate),
        getSearchText: (row) => fmtDateOnly(row.dueDate),
      },
      {
        key: "assignment",
        header: "Assignment",
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{assignmentName(row)}</span>
            <span className="text-soft" style={{ fontSize: 12 }}>
              {assignmentLabel(row)}
            </span>
          </div>
        ),
        getSearchText: (row) => assignmentName(row),
      },
      {
        key: "rush",
        header: "Rush",
        sortable: true,
        render: (row) => (row.rush ? <span className="badge badge-warning">Rush</span> : ""),
        getSearchText: (row) => (row.rush ? "Rush" : ""),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row) => (
          <Link
            href={`/partner-work/workflow/${encodeURIComponent(row.id)}`}
            className="btn btn-secondary btn-sm"
          >
            Open
          </Link>
        ),
      },
    ],
    [dueDateFrom, dueDateTo, filters.statusCode, partner],
  );

  const toolbar = (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <input
        className="input"
        value={filters.search}
        onChange={(e) => onFilterChange("search", e.target.value)}
        placeholder="Search request, tape, customer, style…"
        style={{ minWidth: 260 }}
      />
      <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
        Clear Filters
      </button>
    </div>
  );

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Partner Workflow</h1>
          <p className="page-subtitle">
            {partner?.name
              ? `${partner.name} work queue. Only records available to your partner account are shown.`
              : "External-safe Workflow queue."}
          </p>
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
        emptyText="No partner Workflow records found."
        toolbar={toolbar}
        enableGlobalSearch={false}
        enableCsvExport
        csvFilename="partner_workflow.csv"
        rowToCsv={(row) => ({
          "Request #": row.requestNumber,
          Status: row.statusLabel,
          "Tape #": row.tapeNumber,
          "Tape Name": row.tapeName,
          Customer: row.customerName,
          Style: row.styleCode,
          "Due Date": fmtDateOnly(row.dueDate),
          Assignment: assignmentName(row),
          Rush: row.rush ? "Yes" : "No",
        })}
        rowClickable
        onRowDoubleClick={(row) => {
          router.push(`/partner-work/workflow/${encodeURIComponent(row.id)}`);
        }}
      />
    </main>
  );
}
