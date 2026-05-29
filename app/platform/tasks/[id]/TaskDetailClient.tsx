"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CommentsPanel from "@/components/platform/CommentsPanel";

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
  taskKey: string | null;

  sourceModule: string;
  entityType: string;
  entityId: string;
  sourceRecordLabel: string | null;
  sourceCreatedByUserId: string | null;
  sourceCreatedByName: string | null;
  sourceBinCode: string | null;

  taskType: string;

  title: string;
  description: string | null;

  assignedToUserId: string | null;
  assignedToRole: string | null;
  assignedToDepartment: string | null;
  assignedToDisplayName: string | null;

  priority: TaskPriority;
  status: TaskStatus;

  dueAt: string | null;

  completedAt: string | null;
  completedBy: string | null;

  canceledAt: string | null;
  canceledBy: string | null;

  createdAt: string;
  createdBy: string | null;

  updatedAt: string;
  updatedBy: string | null;

  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;

  metadata: any;
};

type TaskEventRow = {
  id: number;
  taskId: string;
  eventType: string;
  previousValue: unknown | null;
  newValue: unknown | null;
  message: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
  metadata: any;
};

type ApiResponse = {
  task: TaskRow;
  events: TaskEventRow[];
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

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function sourceHref(task: TaskRow) {
  if (task.sourceModule === "design_workflow") {
    return `/design-workflow/${encodeURIComponent(task.entityId)}`;
  }

  return null;
}

function isActiveStatus(status: TaskStatus) {
  return ["open", "in_progress", "blocked"].includes(status);
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

function valueText(value: unknown) {
  if (value == null) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
        background: "var(--surface-subtle)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--text-soft)",
        }}
      >
        {label}
      </div>
      <div style={{ color: "var(--text)" }}>{children}</div>
    </div>
  );
}

export default function TaskDetailClient({ taskId }: { taskId: string }) {
  const router = useRouter();

  const [task, setTask] = useState<TaskRow | null>(null);
  const [events, setEvents] = useState<TaskEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => (task ? isActiveStatus(task.status) : false),
    [task],
  );

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/platform/tasks/${encodeURIComponent(taskId)}?includeVoided=true`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

      const data = (await res.json().catch(() => ({}))) as Partial<ApiResponse> & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load task.");
      }

      setTask(data.task ?? null);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err: any) {
      setTask(null);
      setEvents([]);
      setError(err?.message || "Failed to load task.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [taskId]);

  async function postTaskAction(action: "complete" | "cancel" | "reopen") {
    if (!task) return;

    const reason =
      action === "cancel"
        ? window.prompt("Cancel reason:", "Task canceled from task detail.")
        : null;

    if (action === "cancel" && reason === null) return;

    setActionLoading(action);
    setError(null);

    try {
      const res = await fetch(
        `/api/platform/tasks/${encodeURIComponent(task.id)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: action === "cancel" ? JSON.stringify({ reason }) : undefined,
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `Failed to ${action} task.`);
      }

      await load();
    } catch (err: any) {
      setError(err?.message || `Failed to ${action} task.`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card">
          <div className="text-muted">Loading task…</div>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="page-shell">
        <div className="alert alert-danger">{error}</div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => router.back()}
        >
          Back
        </button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="page-shell">
        <div className="alert alert-warning">Task was not found.</div>
      </div>
    );
  }

  const href = sourceHref(task);

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <div className="text-soft" style={{ fontWeight: 800 }}>
            Task #{task.taskNumber}
          </div>
          <h1 className="page-title">{task.title}</h1>
          <p className="page-subtitle">
            {sourceModuleLabel(task.sourceModule)} / {taskTypeLabel(task.taskType)}
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/my-work" className="btn btn-secondary">
            My Work
          </Link>
          <Link href="/manager/tasks" className="btn btn-secondary">
            Task Oversight
          </Link>
          {href ? (
            <Link href={href} className="btn btn-secondary">
              Open Source
            </Link>
          ) : null}
          {active ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => postTaskAction("complete")}
              disabled={!!actionLoading}
            >
              {actionLoading === "complete" ? "Completing…" : "Complete"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <aside className="card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {statusBadge(task.status)}
            {priorityBadge(task.priority)}
          </div>

          <InfoItem label="Assigned To">
            {task.assignedToDisplayName ||
              task.assignedToDepartment ||
              task.assignedToRole ||
              "Unassigned"}
          </InfoItem>

          <InfoItem label="Due">{fmtDateTime(task.dueAt) || "No due date"}</InfoItem>

          <InfoItem label="Created">{fmtDateTime(task.createdAt)}</InfoItem>

          <InfoItem label="Updated">{fmtDateTime(task.updatedAt)}</InfoItem>

          {task.completedAt ? (
            <InfoItem label="Completed">{fmtDateTime(task.completedAt)}</InfoItem>
          ) : null}

          {task.canceledAt ? (
            <InfoItem label="Canceled">{fmtDateTime(task.canceledAt)}</InfoItem>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => postTaskAction("cancel")}
                disabled={!!actionLoading}
              >
                {actionLoading === "cancel" ? "Canceling…" : "Cancel Task"}
              </button>
            ) : null}

            {task.status === "completed" || task.status === "canceled" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => postTaskAction("reopen")}
                disabled={!!actionLoading}
              >
                {actionLoading === "reopen" ? "Reopening…" : "Reopen Task"}
              </button>
            ) : null}
          </div>
        </aside>

        <main style={{ display: "grid", gap: 16 }}>
          <section className="card">
            <div className="section-card-header">
              <div>
                <h2 style={{ marginBottom: 4 }}>Task Details</h2>
                <div className="text-soft">Source, assignment, and description.</div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <InfoItem label="Task Type">{taskTypeLabel(task.taskType)}</InfoItem>
              <InfoItem label="Source Module">{sourceModuleLabel(task.sourceModule)}</InfoItem>
              <InfoItem label="Source Record">
                {href ? (
                  <Link href={href} className="btn-linkish">
                    {task.sourceRecordLabel || task.entityId}
                  </Link>
                ) : (
                  task.sourceRecordLabel || task.entityId
                )}
              </InfoItem>
              <InfoItem label="Source Created By">
                {task.sourceCreatedByName || task.sourceCreatedByUserId || ""}
              </InfoItem>
              <InfoItem label="Bin #">{task.sourceBinCode || ""}</InfoItem>
              <InfoItem label="Entity Type">{prettyLabel(task.entityType)}</InfoItem>
            </div>

            <div style={{ marginTop: 12 }}>
              <InfoItem label="Description">
                <div style={{ whiteSpace: "pre-wrap" }}>{task.description || ""}</div>
              </InfoItem>
            </div>
          </section>

          <CommentsPanel
            entityType="platform_task"
            entityId={task.id}
            title="Task Comments"
            subtitle="Use comments for updates, questions, and handoff notes tied to this task."
            onCommentAdded={load}
          />

          <section className="card">
            <div className="section-card-header">
              <div>
                <h2 style={{ marginBottom: 4 }}>Event History</h2>
                <div className="text-soft">
                  {events.length} event{events.length === 1 ? "" : "s"} recorded for this task.
                </div>
              </div>
            </div>

            {events.length === 0 ? (
              <div className="text-muted">No task events yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {events.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 14,
                      background: "var(--surface)",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {event.message || prettyLabel(event.eventType)}
                        </div>
                        <div className="text-soft">
                          {prettyLabel(event.eventType)} • {fmtDateTime(event.createdAt)}
                        </div>
                      </div>
                      <div className="badge badge-neutral">
                        {event.actorName || "System"}
                      </div>
                    </div>

                    {event.previousValue != null || event.newValue != null ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        }}
                      >
                        {event.previousValue != null ? (
                          <InfoItem label="Previous">
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                              {valueText(event.previousValue)}
                            </pre>
                          </InfoItem>
                        ) : null}

                        {event.newValue != null ? (
                          <InfoItem label="New">
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                              {valueText(event.newValue)}
                            </pre>
                          </InfoItem>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
