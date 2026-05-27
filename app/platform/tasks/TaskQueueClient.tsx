"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type TaskRow = {
  id: string;
  taskNumber: number;
  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel: string | null;
  taskType: string;
  title: string;
  description: string | null;
  assignedToDisplayName: string | null;
  assignedToDepartment: string | null;
  assignedToRole: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "blocked" | "completed" | "canceled" | "voided";
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  scope: "mine" | "oversight";
  title: string;
  subtitle: string;
};

const DEFAULT_FILTERS = {
  q: "",
  status: "open,in_progress,blocked",
  sourceModule: "",
  taskType: "",
  priority: "",
  overdue: "",
  dueToday: "",
};

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function statusBadge(status: TaskRow["status"]) {
  const cls =
    status === "completed"
      ? "badge badge-success"
      : status === "blocked"
        ? "badge badge-warning"
        : status === "canceled" || status === "voided"
          ? "badge badge-danger"
          : "badge badge-brand-blue";

  return <span className={cls}>{status.replaceAll("_", " ")}</span>;
}

function priorityBadge(priority: TaskRow["priority"]) {
  const cls =
    priority === "urgent" || priority === "high"
      ? "badge badge-danger"
      : priority === "normal"
        ? "badge badge-neutral"
        : "badge badge-success";

  return <span className={cls}>{priority}</span>;
}

function sourceHref(row: TaskRow) {
  if (row.sourceModule === "design_workflow") {
    return `/design-workflow/${encodeURIComponent(row.entityId)}`;
  }

  return null;
}

export default function TaskQueueClient({ scope, title, subtitle }: Props) {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debounced, setDebounced] = useState(DEFAULT_FILTERS);

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
    sp.set("scope", scope);
    sp.set("page", String(pageIndex + 1));
    sp.set("pageSize", String(pageSize));
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);

    if (debounced.q.trim()) sp.set("q", debounced.q.trim());
    if (debounced.status.trim()) sp.set("status", debounced.status.trim());
    if (debounced.sourceModule.trim()) sp.set("sourceModule", debounced.sourceModule.trim());
    if (debounced.taskType.trim()) sp.set("taskType", debounced.taskType.trim());
    if (debounced.priority.trim()) sp.set("priority", debounced.priority.trim());
    if (debounced.overdue === "true") sp.set("overdue", "true");
    if (debounced.dueToday === "true") sp.set("dueToday", "true");

    return sp.toString();
  }, [scope, pageIndex, pageSize, sortBy, sortDir, debounced]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/platform/tasks?${qs}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load tasks.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalCount(Number.isFinite(data?.totalCount) ? data.totalCount : 0);
    } catch (err: any) {
      setRows([]);
      setTotalCount(0);
      setError(err?.message || "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [qs]);

  function setFilter(key: keyof typeof DEFAULT_FILTERS, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  async function completeTask(id: string) {
    const res = await fetch(`/api/platform/tasks/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Failed to complete task.");
      return;
    }

    await load();
  }

  const columns: Column<TaskRow>[] = [
    {
      key: "taskNumber",
      header: "Task #",
      sortable: true,
      width: 90,
      render: (r) => r.taskNumber,
      getSearchText: (r) => String(r.taskNumber),
    },
    {
      key: "title",
      header: "Task",
      sortable: true,
      filterable: true,
      placeholder: "Search task",
      render: (r) => (
        <div style={{ display: "grid", gap: 4 }}>
          <strong>{r.title}</strong>
          <span className="text-soft">{r.description || ""}</span>
        </div>
      ),
      getSearchText: (r) => `${r.title} ${r.description || ""}`,
    },
    {
      key: "sourceModule",
      header: "Source",
      sortable: true,
      render: (r) => {
        const href = sourceHref(r);
        const label = r.sourceRecordLabel || r.entityId;

        return href ? (
          <Link className="btn-linkish" href={href}>
            {label}
          </Link>
        ) : (
          label
        );
      },
      getSearchText: (r) => `${r.sourceModule} ${r.sourceRecordLabel || ""}`,
    },
    {
      key: "taskType",
      header: "Type",
      sortable: true,
      render: (r) => r.taskType.replaceAll("_", " "),
      getSearchText: (r) => r.taskType,
    },
    {
      key: "assignedToDisplayName",
      header: "Assigned To",
      sortable: true,
      render: (r) =>
        r.assignedToDisplayName ||
        r.assignedToDepartment ||
        r.assignedToRole ||
        "",
      getSearchText: (r) =>
        r.assignedToDisplayName ||
        r.assignedToDepartment ||
        r.assignedToRole ||
        "",
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
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "completed" || r.status === "canceled" || r.status === "voided" ? null : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => completeTask(r.id)}
          >
            Complete
          </button>
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
        placeholder="Search tasks..."
      />

      <select
        className="select"
        style={{ width: 180 }}
        value={filters.status}
        onChange={(e) => setFilter("status", e.target.value)}
      >
        <option value="open,in_progress,blocked">Active</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="blocked">Blocked</option>
        <option value="completed">Completed</option>
        <option value="canceled">Canceled</option>
        <option value="">All</option>
      </select>

      <select
        className="select"
        style={{ width: 160 }}
        value={filters.priority}
        onChange={(e) => setFilter("priority", e.target.value)}
      >
        <option value="">All Priorities</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>

      <select
        className="select"
        style={{ width: 150 }}
        value={filters.overdue}
        onChange={(e) => setFilter("overdue", e.target.value)}
      >
        <option value="">Due Any Time</option>
        <option value="true">Overdue</option>
      </select>

      <select
        className="select"
        style={{ width: 150 }}
        value={filters.dueToday}
        onChange={(e) => setFilter("dueToday", e.target.value)}
      >
        <option value="">Any Due Date</option>
        <option value="true">Due Today</option>
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
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="card">
        <DataTable<TaskRow>
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
          pageSizes={[10, 25, 50, 100]}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          toolbar={toolbar}
          rowKey={(row) => row.id}
          emptyText="No tasks found."
          enableGlobalSearch={false}
          enableCsvExport={true}
          csvFilename={scope === "mine" ? "my_work_tasks.csv" : "task_oversight.csv"}
          rowToCsv={(row) => ({
            "Task #": row.taskNumber,
            Task: row.title,
            Source: row.sourceRecordLabel || row.entityId,
            Type: row.taskType,
            "Assigned To":
              row.assignedToDisplayName || row.assignedToDepartment || row.assignedToRole || "",
            Priority: row.priority,
            Status: row.status,
            Due: fmtDateTime(row.dueAt),
            Created: fmtDateTime(row.createdAt),
          })}
        />
      </div>
    </div>
  );
}