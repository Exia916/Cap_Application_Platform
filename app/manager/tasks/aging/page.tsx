"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type AgingBucket =
  | "all"
  | "overdue"
  | "due_today"
  | "due_this_week"
  | "no_due_date"
  | "active_older_than_7"
  | "closed_older_than_30"
  | "closed_older_than_90"
  | "current";

type StatusGroup = "active" | "closed" | "all";

type TaskAgingRow = {
  id: string;
  taskNumber: number;
  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel: string | null;
  sourceCreatedByUserId: string | null;
  sourceCreatedByName: string | null;
  sourceBinCode: string | null;
  taskType: string;
  title: string;
  assignedToUserId: string | null;
  assignedToDisplayName: string | null;
  assignedToDepartment: string | null;
  assignedToRole: string | null;
  priority: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  closedAt: string | null;
  agingBucket: AgingBucket;
  ageDays: number;
  daysPastDue: number | null;
  closedAgeDays: number | null;
};

type AgingSummary = {
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  noDueDate: number;
  activeOlderThan7: number;
  closedOlderThan30: number;
  closedOlderThan90: number;
  current: number;
};

type Filters = {
  q: string;
  statusGroup: StatusGroup;
  agingBucket: AgingBucket;
  sourceModule: string;
  sourceCreatedByName: string;
  sourceBinCode: string;
  taskType: string;
  priority: string;
};

const EMPTY_SUMMARY: AgingSummary = {
  overdue: 0,
  dueToday: 0,
  dueThisWeek: 0,
  noDueDate: 0,
  activeOlderThan7: 0,
  closedOlderThan30: 0,
  closedOlderThan90: 0,
  current: 0,
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  statusGroup: "active",
  agingBucket: "all",
  sourceModule: "",
  sourceCreatedByName: "",
  sourceBinCode: "",
  taskType: "",
  priority: "",
};

function prettyLabel(value?: string | null) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function sourceModuleLabel(value: string) {
  if (value === "design_workflow") return "Workflow";
  return prettyLabel(value);
}

function taskTypeLabel(value: string) {
  if (value === "workflow_design") return "Workflow Design";
  if (value === "workflow_digitizing") return "Workflow Digitizing";
  return prettyLabel(value);
}

function bucketLabel(value: AgingBucket) {
  if (value === "all") return "All";
  if (value === "due_today") return "Due Today";
  if (value === "due_this_week") return "Due This Week";
  if (value === "no_due_date") return "No Due Date";
  if (value === "active_older_than_7") return "Active Older Than 7 Days";
  if (value === "closed_older_than_30") return "Closed Older Than 30 Days";
  if (value === "closed_older_than_90") return "Closed Older Than 90 Days";
  return prettyLabel(value);
}

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function sourceHref(row: TaskAgingRow) {
  if (row.sourceModule === "design_workflow") {
    return `/design-workflow/${encodeURIComponent(row.entityId)}`;
  }

  return null;
}

function taskHref(row: TaskAgingRow) {
  return `/platform/tasks/${encodeURIComponent(row.id)}`;
}

function assignmentLabel(row: TaskAgingRow) {
  return (
    row.assignedToDisplayName ||
    row.assignedToDepartment ||
    row.assignedToRole ||
    "Unassigned"
  );
}

function statusBadge(status: string) {
  const cls =
    status === "completed"
      ? "badge badge-success"
      : status === "blocked"
        ? "badge badge-warning"
        : status === "canceled" || status === "voided"
          ? "badge badge-danger"
          : "badge badge-brand-blue";

  return <span className={cls}>{prettyLabel(status)}</span>;
}

function priorityBadge(priority: string) {
  const cls =
    priority === "urgent" || priority === "high"
      ? "badge badge-danger"
      : priority === "low"
        ? "badge badge-success"
        : "badge badge-neutral";

  return <span className={cls}>{prettyLabel(priority)}</span>;
}

function agingBadge(bucket: AgingBucket) {
  const cls =
    bucket === "overdue" ||
    bucket === "closed_older_than_90"
      ? "badge badge-danger"
      : bucket === "due_today" ||
          bucket === "active_older_than_7" ||
          bucket === "closed_older_than_30"
        ? "badge badge-warning"
        : bucket === "due_this_week"
          ? "badge badge-brand-blue"
          : "badge badge-neutral";

  return <span className={cls}>{bucketLabel(bucket)}</span>;
}

function SummaryCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "primary" | "danger" | "warning" | "neutral";
  onClick: () => void;
}) {
  const badgeClass =
    tone === "danger"
      ? "badge badge-danger"
      : tone === "warning"
        ? "badge badge-warning"
        : tone === "primary"
          ? "badge badge-brand-blue"
          : "badge badge-neutral";

  return (
    <button
      type="button"
      className="card"
      onClick={onClick}
      style={{
        textAlign: "left",
        display: "grid",
        gap: 8,
        cursor: "pointer",
        minHeight: 86,
      }}
    >
      <span className={badgeClass} style={{ width: "fit-content" }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>
        {value}
      </span>
    </button>
  );
}

export default function TaskAgingPage() {
  const [rows, setRows] = useState<TaskAgingRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<AgingSummary>(EMPTY_SUMMARY);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debounced, setDebounced] = useState<Filters>(DEFAULT_FILTERS);

  const [sortBy, setSortBy] = useState("dueAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(filters), 300);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [debounced, sortBy, sortDir, pageSize]);

  const qs = useMemo(() => {
  const sp = new URLSearchParams();

  const q = debounced.q ?? "";
  const sourceModule = debounced.sourceModule ?? "";
  const sourceCreatedByName = debounced.sourceCreatedByName ?? "";
  const sourceBinCode = debounced.sourceBinCode ?? "";
  const taskType = debounced.taskType ?? "";
  const priority = debounced.priority ?? "";

  sp.set("page", String(pageIndex + 1));
  sp.set("pageSize", String(pageSize));
  sp.set("sortBy", sortBy);
  sp.set("sortDir", sortDir);
  sp.set("statusGroup", debounced.statusGroup ?? "active");
  sp.set("agingBucket", debounced.agingBucket ?? "all");

  if (q.trim()) sp.set("q", q.trim());
  if (sourceModule.trim()) sp.set("sourceModule", sourceModule.trim());

  if (sourceCreatedByName.trim()) {
    sp.set("sourceCreatedByName", sourceCreatedByName.trim());
  }

  if (sourceBinCode.trim()) {
    sp.set("sourceBinCode", sourceBinCode.trim());
  }

  if (taskType.trim()) sp.set("taskType", taskType.trim());
  if (priority.trim()) sp.set("priority", priority.trim());

  return sp.toString();
}, [pageIndex, pageSize, sortBy, sortDir, debounced]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/platform/tasks/aging?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load task aging report.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number(data?.totalCount ?? 0));
      setSummary({
        overdue: Number(data?.summary?.overdue ?? 0),
        dueToday: Number(data?.summary?.dueToday ?? 0),
        dueThisWeek: Number(data?.summary?.dueThisWeek ?? 0),
        noDueDate: Number(data?.summary?.noDueDate ?? 0),
        activeOlderThan7: Number(data?.summary?.activeOlderThan7 ?? 0),
        closedOlderThan30: Number(data?.summary?.closedOlderThan30 ?? 0),
        closedOlderThan90: Number(data?.summary?.closedOlderThan90 ?? 0),
        current: Number(data?.summary?.current ?? 0),
      });
    } catch (err: any) {
      setRows([]);
      setTotalCount(0);
      setSummary(EMPTY_SUMMARY);
      setError(err?.message || "Failed to load task aging report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [qs]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyBucket(bucket: AgingBucket, statusGroup?: StatusGroup) {
    setFilters((current) => ({
      ...current,
      statusGroup: statusGroup ?? current.statusGroup,
      agingBucket: bucket,
    }));
  }

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  const columns: Column<TaskAgingRow>[] = [
    {
      key: "taskNumber",
      header: "Task #",
      sortable: true,
      width: 95,
      render: (r) => (
        <Link href={taskHref(r)} className="btn-linkish">
          {r.taskNumber}
        </Link>
      ),
      getSearchText: (r) => String(r.taskNumber),
    },
    {
      key: "title",
      header: "Task",
      sortable: true,
      render: (r) => (
        <div style={{ display: "grid", gap: 4 }}>
          <Link href={taskHref(r)} className="btn-linkish">
            <strong>{r.title}</strong>
          </Link>
          <span className="text-soft">{taskTypeLabel(r.taskType)}</span>
        </div>
      ),
      getSearchText: (r) => `${r.title} ${taskTypeLabel(r.taskType)}`,
    },
    {
      key: "agingBucket",
      header: "Aging",
      sortable: true,
      render: (r) => agingBadge(r.agingBucket),
      getSearchText: (r) => bucketLabel(r.agingBucket),
    },
    {
      key: "assignedToDisplayName",
      header: "Assigned To",
      sortable: true,
      render: (r) => assignmentLabel(r),
      getSearchText: (r) => assignmentLabel(r),
    },
    {
      key: "sourceModule",
      header: "Source",
      sortable: true,
      render: (r) => {
        const href = sourceHref(r);
        const label = r.sourceRecordLabel || r.entityId;

        return (
          <div style={{ display: "grid", gap: 4 }}>
            <span className="badge badge-neutral">{sourceModuleLabel(r.sourceModule)}</span>
            {href ? (
              <Link href={href} className="btn-linkish">
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
          </div>
        );
      },
      getSearchText: (r) => `${sourceModuleLabel(r.sourceModule)} ${r.sourceRecordLabel || ""}`,
    },
    {
      key: "sourceCreatedByName",
      header: "Created By",
      sortable: true,
      render: (r) => r.sourceCreatedByName || "",
      getSearchText: (r) => r.sourceCreatedByName || "",
    },
    {
      key: "sourceBinCode",
      header: "Bin #",
      sortable: true,
      render: (r) =>
        r.sourceBinCode ? (
          <span className="badge badge-neutral">{r.sourceBinCode}</span>
        ) : (
          ""
        ),
      getSearchText: (r) => r.sourceBinCode || "",
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (r) => priorityBadge(r.priority),
      getSearchText: (r) => r.priority,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => statusBadge(r.status),
      getSearchText: (r) => r.status,
    },
    {
      key: "dueAt",
      header: "Due",
      sortable: true,
      render: (r) => fmtDateTime(r.dueAt),
      getSearchText: (r) => fmtDateTime(r.dueAt),
    },
    {
      key: "ageDays",
      header: "Age",
      sortable: true,
      render: (r) => `${r.ageDays}d`,
      getSearchText: (r) => String(r.ageDays),
    },
    {
      key: "daysPastDue",
      header: "Past Due",
      sortable: true,
      render: (r) => (r.daysPastDue == null ? "" : `${r.daysPastDue}d`),
      getSearchText: (r) => String(r.daysPastDue ?? ""),
    },
    {
      key: "closedAgeDays",
      header: "Closed Age",
      sortable: true,
      render: (r) => (r.closedAgeDays == null ? "" : `${r.closedAgeDays}d`),
      getSearchText: (r) => String(r.closedAgeDays ?? ""),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={taskHref(r)} className="btn btn-secondary btn-sm">
            View
          </Link>
          {sourceHref(r) ? (
            <Link href={sourceHref(r)!} className="btn btn-secondary btn-sm">
              Source
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="input"
        style={{ width: 220 }}
        value={filters.q}
        onChange={(e) => setFilter("q", e.target.value)}
        placeholder="Search task, SO, assignee..."
      />

      <select
        className="select"
        style={{ width: 150 }}
        value={filters.statusGroup}
        onChange={(e) => setFilter("statusGroup", e.target.value as StatusGroup)}
      >
        <option value="active">Active</option>
        <option value="closed">Closed</option>
        <option value="all">All</option>
      </select>

      <select
        className="select"
        style={{ width: 220 }}
        value={filters.agingBucket}
        onChange={(e) => setFilter("agingBucket", e.target.value as AgingBucket)}
      >
        <option value="all">All Aging Buckets</option>
        <option value="overdue">Overdue</option>
        <option value="due_today">Due Today</option>
        <option value="due_this_week">Due This Week</option>
        <option value="no_due_date">No Due Date</option>
        <option value="active_older_than_7">Active Older Than 7 Days</option>
        <option value="closed_older_than_30">Closed Older Than 30 Days</option>
        <option value="closed_older_than_90">Closed Older Than 90 Days</option>
        <option value="current">Current</option>
      </select>

      <select
        className="select"
        style={{ width: 170 }}
        value={filters.sourceModule}
        onChange={(e) => setFilter("sourceModule", e.target.value)}
      >
        <option value="">All Sources</option>
        <option value="design_workflow">Workflow</option>
      </select>

      <input
        className="input"
        style={{ width: 180 }}
        value={filters.sourceCreatedByName}
        onChange={(e) => setFilter("sourceCreatedByName", e.target.value)}
        placeholder="Created By"
      />

      <input
        className="input"
        style={{ width: 130 }}
        value={filters.sourceBinCode}
        onChange={(e) => setFilter("sourceBinCode", e.target.value)}
        placeholder="Bin #"
      />

      <select
        className="select"
        style={{ width: 190 }}
        value={filters.taskType}
        onChange={(e) => setFilter("taskType", e.target.value)}
      >
        <option value="">All Types</option>
        <option value="workflow_design">Workflow Design</option>
        <option value="workflow_digitizing">Workflow Digitizing</option>
      </select>

      <select
        className="select"
        style={{ width: 150 }}
        value={filters.priority}
        onChange={(e) => setFilter("priority", e.target.value)}
      >
        <option value="">All Priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setFilters(DEFAULT_FILTERS);
          setSortBy("dueAt");
          setSortDir("asc");
          setPageIndex(0);
        }}
      >
        Clear
      </button>
    </>
  );

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Task Aging & Cleanup Review</h1>
          <p className="page-subtitle">
            Review overdue work, stale active tasks, and closed task cleanup candidates.
            This page is read-only and does not delete or archive tasks.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/manager/tasks" className="btn btn-secondary">
            Task Oversight
          </Link>
          <Link href="/my-work" className="btn btn-secondary">
            My Work
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 16,
        }}
      >
        <SummaryCard
          label="Overdue"
          value={summary.overdue}
          tone={summary.overdue > 0 ? "danger" : "neutral"}
          onClick={() => applyBucket("overdue", "active")}
        />
        <SummaryCard
          label="Due Today"
          value={summary.dueToday}
          tone={summary.dueToday > 0 ? "warning" : "neutral"}
          onClick={() => applyBucket("due_today", "active")}
        />
        <SummaryCard
          label="Due This Week"
          value={summary.dueThisWeek}
          tone={summary.dueThisWeek > 0 ? "primary" : "neutral"}
          onClick={() => applyBucket("due_this_week", "active")}
        />
        <SummaryCard
          label="No Due Date"
          value={summary.noDueDate}
          tone={summary.noDueDate > 0 ? "warning" : "neutral"}
          onClick={() => applyBucket("no_due_date", "active")}
        />
        <SummaryCard
          label="Active > 7d"
          value={summary.activeOlderThan7}
          tone={summary.activeOlderThan7 > 0 ? "warning" : "neutral"}
          onClick={() => applyBucket("active_older_than_7", "active")}
        />
        <SummaryCard
          label="Closed > 30d"
          value={summary.closedOlderThan30}
          tone={summary.closedOlderThan30 > 0 ? "warning" : "neutral"}
          onClick={() => applyBucket("closed_older_than_30", "closed")}
        />
        <SummaryCard
          label="Closed > 90d"
          value={summary.closedOlderThan90}
          tone={summary.closedOlderThan90 > 0 ? "danger" : "neutral"}
          onClick={() => applyBucket("closed_older_than_90", "closed")}
        />
      </div>

      <section className="card">
        <DataTable<TaskAgingRow>
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={onToggleSort}
          filters={{}}
          onFilterChange={() => {}}
          totalCount={totalCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageSizes={[10, 25, 50, 100, 250]}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          toolbar={toolbar}
          rowKey={(row) => row.id}
          emptyText="No tasks found for this aging view."
          enableGlobalSearch={false}
          enableCsvExport={true}
          csvFilename="task_aging_cleanup_review.csv"
          rowToCsv={(row) => ({
            "Task #": row.taskNumber,
            Task: row.title,
            Aging: bucketLabel(row.agingBucket),
            "Assigned To": assignmentLabel(row),
            Source: `${sourceModuleLabel(row.sourceModule)} ${row.sourceRecordLabel || row.entityId}`,
            "Created By": row.sourceCreatedByName ?? "",
            "Bin #": row.sourceBinCode ?? "",
            Type: taskTypeLabel(row.taskType),
            Priority: row.priority,
            Status: row.status,
            Due: fmtDateTime(row.dueAt),
            "Age Days": row.ageDays,
            "Days Past Due": row.daysPastDue ?? "",
            "Closed Age Days": row.closedAgeDays ?? "",
            Created: fmtDateTime(row.createdAt),
            Updated: fmtDateTime(row.updatedAt),
            Closed: fmtDateTime(row.closedAt),
          })}
        />
      </section>
    </div>
  );
}
