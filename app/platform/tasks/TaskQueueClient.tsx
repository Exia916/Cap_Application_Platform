"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type TaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "completed"
  | "canceled"
  | "voided";

type TaskPriority = "low" | "normal" | "high" | "urgent";

type TaskRow = {
  id: string;
  taskNumber: number;
  taskKey?: string | null;

  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel: string | null;

  taskType: string;
  title: string;
  description: string | null;

  assignedToUserId: string | null;
  assignedToDisplayName: string | null;
  assignedToDepartment: string | null;
  assignedToRole: string | null;

  priority: TaskPriority;
  status: TaskStatus;

  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssignableUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  employeeNumber: number | null;
  role: string | null;
  shift: string | null;
  department: string | null;
  managerUserId: string | null;
  managerDisplayName: string | null;
};

type TaskSummary = {
  active: number;
  overdue: number;
  dueToday: number;
  blocked: number;
  highPriority: number;
  completed: number;
  canceled: number;
};

type Props = {
  scope: "mine" | "oversight";
  title: string;
  subtitle: string;
};

type Filters = {
  q: string;
  status: string;
  sourceModule: string;
  taskType: string;
  priority: string;
  overdue: string;
  dueToday: string;
};

type ReassignState =
  | { open: false }
  | {
      open: true;
      task: TaskRow;
      query: string;
      users: AssignableUser[];
      selectedUserId: string;
      loading: boolean;
      saving: boolean;
      error: string | null;
    };

const DEFAULT_FILTERS: Filters = {
  q: "",
  status: "open,in_progress,blocked",
  sourceModule: "",
  taskType: "",
  priority: "",
  overdue: "",
  dueToday: "",
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

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function isActiveTask(row: TaskRow) {
  return ["open", "in_progress", "blocked"].includes(row.status);
}

function statusBadge(status: TaskStatus) {
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

function priorityBadge(priority: TaskPriority) {
  const cls =
    priority === "urgent" || priority === "high"
      ? "badge badge-danger"
      : priority === "low"
        ? "badge badge-success"
        : "badge badge-neutral";

  return <span className={cls}>{prettyLabel(priority)}</span>;
}

function sourceHref(row: TaskRow) {
  if (row.sourceModule === "design_workflow") {
    return `/design-workflow/${encodeURIComponent(row.entityId)}`;
  }

  return null;
}

function taskHref(row: TaskRow) {
  return `/platform/tasks/${encodeURIComponent(row.id)}`;
}

function assignmentLabel(row: TaskRow) {
  return (
    row.assignedToDisplayName ||
    row.assignedToDepartment ||
    row.assignedToRole ||
    "Unassigned"
  );
}

function dueDisplay(row: TaskRow) {
  if (!row.dueAt) return "";

  const d = new Date(row.dueAt);
  if (Number.isNaN(d.getTime())) return String(row.dueAt);

  if (!isActiveTask(row)) return fmtDateTime(row.dueAt);

  const today = ymdChicago(new Date());
  const dueDay = ymdChicago(d);

  if (d.getTime() < Date.now()) {
    return <span className="badge badge-danger">{fmtDateTime(row.dueAt)}</span>;
  }

  if (dueDay === today) {
    return <span className="badge badge-warning">{fmtDateTime(row.dueAt)}</span>;
  }

  return fmtDateTime(row.dueAt);
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "danger" | "warning" | "primary";
  onClick?: () => void;
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
      onClick={onClick}
      className="card"
      style={{
        textAlign: "left",
        display: "grid",
        gap: 8,
        minHeight: 86,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div className={badgeClass} style={{ width: "fit-content" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>
        {value}
      </div>
    </button>
  );
}

export default function TaskQueueClient({ scope, title, subtitle }: Props) {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<TaskSummary | null>(null);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debounced, setDebounced] = useState<Filters>(DEFAULT_FILTERS);

  const [sortBy, setSortBy] = useState("dueAt");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reassign, setReassign] = useState<ReassignState>({ open: false });

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

  async function loadSummary() {
    setSummaryLoading(true);

    try {
      const res = await fetch(`/api/platform/tasks/summary?scope=${scope}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load task summary.");
      }

      setSummary({
        active: Number(data?.active ?? 0),
        overdue: Number(data?.overdue ?? 0),
        dueToday: Number(data?.dueToday ?? 0),
        blocked: Number(data?.blocked ?? 0),
        highPriority: Number(data?.highPriority ?? 0),
        completed: Number(data?.completed ?? 0),
        canceled: Number(data?.canceled ?? 0),
      });
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

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

  async function reloadAll() {
    await Promise.all([load(), loadSummary()]);
  }

  useEffect(() => {
    load();
  }, [qs]);

  useEffect(() => {
    loadSummary();
  }, [scope]);

  useEffect(() => {
    if (!reassign.open) return;

    const controller = new AbortController();

    const t = window.setTimeout(async () => {
      setReassign((current) =>
        current.open ? { ...current, loading: true, error: null } : current,
      );

      try {
        const sp = new URLSearchParams();
        if (reassign.query.trim()) sp.set("q", reassign.query.trim());
        sp.set("limit", "50");

        const res = await fetch(`/api/users/assignable?${sp.toString()}`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load assignable users.");
        }

        const users = Array.isArray(data?.users) ? data.users : [];

        setReassign((current) =>
          current.open ? { ...current, users, loading: false } : current,
        );
      } catch (err: any) {
        if (controller.signal.aborted) return;

        setReassign((current) =>
          current.open
            ? {
                ...current,
                users: [],
                loading: false,
                error: err?.message || "Failed to load assignable users.",
              }
            : current,
        );
      }
    }, 250);

    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [reassign.open, reassign.open ? reassign.query : ""]);

  function setFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applySummaryFilter(kind: "active" | "overdue" | "dueToday" | "blocked" | "high") {
    if (kind === "active") {
      setFilters((current) => ({
        ...current,
        status: "open,in_progress,blocked",
        overdue: "",
        dueToday: "",
        priority: "",
      }));
    }

    if (kind === "overdue") {
      setFilters((current) => ({
        ...current,
        status: "open,in_progress,blocked",
        overdue: "true",
        dueToday: "",
      }));
    }

    if (kind === "dueToday") {
      setFilters((current) => ({
        ...current,
        status: "open,in_progress,blocked",
        overdue: "",
        dueToday: "true",
      }));
    }

    if (kind === "blocked") {
      setFilters((current) => ({
        ...current,
        status: "blocked",
        overdue: "",
        dueToday: "",
      }));
    }

    if (kind === "high") {
      setFilters((current) => ({
        ...current,
        status: "open,in_progress,blocked",
        priority: "high",
        overdue: "",
        dueToday: "",
      }));
    }
  }

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  async function completeTask(row: TaskRow) {
    const res = await fetch(`/api/platform/tasks/${encodeURIComponent(row.id)}/complete`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "Failed to complete task.");
      return;
    }

    await reloadAll();
  }

  function openReassign(row: TaskRow) {
    setReassign({
      open: true,
      task: row,
      query: "",
      users: [],
      selectedUserId: row.assignedToUserId ?? "",
      loading: true,
      saving: false,
      error: null,
    });
  }

  async function submitReassign() {
    if (!reassign.open) return;

    const selectedUserId = reassign.selectedUserId.trim();

    if (!selectedUserId) {
      setReassign((current) =>
        current.open ? { ...current, error: "Select a user first." } : current,
      );
      return;
    }

    setReassign((current) =>
      current.open ? { ...current, saving: true, error: null } : current,
    );

    try {
      const res = await fetch(
        `/api/platform/tasks/${encodeURIComponent(reassign.task.id)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assignedToUserId: selectedUserId }),
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to reassign task.");
      }

      setReassign({ open: false });
      await reloadAll();
    } catch (err: any) {
      setReassign((current) =>
        current.open
          ? {
              ...current,
              saving: false,
              error: err?.message || "Failed to reassign task.",
            }
          : current,
      );
    }
  }

  const columns: Column<TaskRow>[] = [
    {
      key: "taskNumber",
      header: "Task #",
      sortable: true,
      width: 100,
      render: (r) => (
        <Link className="btn-linkish" href={taskHref(r)}>
          {r.taskNumber}
        </Link>
      ),
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
          <Link className="btn-linkish" href={taskHref(r)}>
            <strong>{r.title}</strong>
          </Link>
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

        return (
          <div style={{ display: "grid", gap: 4 }}>
            <span className="badge badge-neutral">{sourceModuleLabel(r.sourceModule)}</span>
            {href ? (
              <Link className="btn-linkish" href={href}>
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
          </div>
        );
      },
      getSearchText: (r) =>
        `${sourceModuleLabel(r.sourceModule)} ${r.sourceRecordLabel || ""}`,
    },
    {
      key: "taskType",
      header: "Type",
      sortable: true,
      render: (r) => taskTypeLabel(r.taskType),
      getSearchText: (r) => taskTypeLabel(r.taskType),
    },
    {
      key: "assignedToDisplayName",
      header: "Assigned To",
      sortable: true,
      render: (r) => assignmentLabel(r),
      getSearchText: (r) => assignmentLabel(r),
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
      render: (r) => dueDisplay(r),
      getSearchText: (r) => fmtDateTime(r.dueAt),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={taskHref(r)} className="btn btn-secondary btn-sm">
            View
          </Link>

          {isActiveTask(r) ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => completeTask(r)}
            >
              Complete
            </button>
          ) : null}

          {scope === "oversight" && isActiveTask(r) ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => openReassign(r)}
            >
              Reassign
            </button>
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
        style={{ width: 170 }}
        value={filters.sourceModule}
        onChange={(e) => setFilter("sourceModule", e.target.value)}
      >
        <option value="">All Sources</option>
        <option value="design_workflow">Workflow</option>
      </select>

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

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginBottom: 16,
        }}
      >
        <SummaryCard
          label="Active"
          value={summaryLoading ? 0 : summary?.active ?? 0}
          tone="primary"
          onClick={() => applySummaryFilter("active")}
        />
        <SummaryCard
          label="Overdue"
          value={summaryLoading ? 0 : summary?.overdue ?? 0}
          tone="danger"
          onClick={() => applySummaryFilter("overdue")}
        />
        <SummaryCard
          label="Due Today"
          value={summaryLoading ? 0 : summary?.dueToday ?? 0}
          tone="warning"
          onClick={() => applySummaryFilter("dueToday")}
        />
        <SummaryCard
          label="Blocked"
          value={summaryLoading ? 0 : summary?.blocked ?? 0}
          tone="warning"
          onClick={() => applySummaryFilter("blocked")}
        />
        <SummaryCard
          label="High Priority"
          value={summaryLoading ? 0 : summary?.highPriority ?? 0}
          tone="danger"
          onClick={() => applySummaryFilter("high")}
        />
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
            Source: `${sourceModuleLabel(row.sourceModule)} ${row.sourceRecordLabel || row.entityId}`,
            Type: taskTypeLabel(row.taskType),
            "Assigned To": assignmentLabel(row),
            Priority: row.priority,
            Status: row.status,
            Due: fmtDateTime(row.dueAt),
            Created: fmtDateTime(row.createdAt),
          })}
        />
      </div>

      {reassign.open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(17, 17, 17, 0.32)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 560 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>
                  Reassign Task #{reassign.task.taskNumber}
                </h2>
                <div className="text-soft">{reassign.task.title}</div>
              </div>

              {reassign.error ? (
                <div className="alert alert-danger">{reassign.error}</div>
              ) : null}

              <div>
                <label className="field-label">Search users</label>
                <input
                  className="input"
                  value={reassign.query}
                  onChange={(e) =>
                    setReassign((current) =>
                      current.open ? { ...current, query: e.target.value } : current,
                    )
                  }
                  placeholder="Name, username, email, or employee #"
                  autoFocus
                />
              </div>

              <div>
                <label className="field-label">Assign To</label>
                <select
                  className="select"
                  value={reassign.selectedUserId}
                  onChange={(e) =>
                    setReassign((current) =>
                      current.open
                        ? { ...current, selectedUserId: e.target.value }
                        : current,
                    )
                  }
                  disabled={reassign.loading || reassign.saving}
                >
                  <option value="">
                    {reassign.loading ? "Loading users..." : "Select a user"}
                  </option>

                  {reassign.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName || user.username}
                      {user.department ? ` — ${user.department}` : ""}
                      {user.role ? ` (${user.role})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReassign({ open: false })}
                  disabled={reassign.saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submitReassign}
                  disabled={reassign.saving || !reassign.selectedUserId}
                >
                  {reassign.saving ? "Saving…" : "Reassign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}