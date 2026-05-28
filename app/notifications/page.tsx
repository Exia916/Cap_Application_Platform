"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NotificationPriority = "low" | "normal" | "high" | "urgent";

type NotificationRow = {
  deliveryId: string;
  eventId: string;
  eventType: string;
  module: string | null;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  targetUserId: string | null;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  payload: any;
  channel: string;
  status: string;
  readAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

type ApiResponse = {
  rows: NotificationRow[];
  unreadCount: number;
  limit: number;
  offset: number;
  error?: string;
};

function fmtDateTime(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function prettyLabel(value?: string | null) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function priorityBadge(priority: NotificationPriority) {
  const cls =
    priority === "urgent" || priority === "high"
      ? "badge badge-danger"
      : priority === "low"
        ? "badge badge-success"
        : "badge badge-neutral";

  return <span className={cls}>{prettyLabel(priority)}</span>;
}

function notificationHref(row: NotificationRow) {
  const payload = row.payload || {};

  if (row.entityType === "platform_task" && row.entityId) {
    return `/platform/tasks/${encodeURIComponent(row.entityId)}`;
  }

  if (payload.taskId) {
    return `/platform/tasks/${encodeURIComponent(String(payload.taskId))}`;
  }

  if (row.entityType === "design_workflow_request" && row.entityId) {
    return `/design-workflow/${encodeURIComponent(row.entityId)}`;
  }

  if (payload.workflowRequestId) {
    return `/design-workflow/${encodeURIComponent(String(payload.workflowRequestId))}`;
  }

  return null;
}

function sourceLabel(row: NotificationRow) {
  if (row.module === "tasks") return "Tasks";
  if (row.module === "design_workflow") return "Workflow";
  if (row.module) return prettyLabel(row.module);
  if (row.entityType) return prettyLabel(row.entityType);
  return "Platform";
}

export default function NotificationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasNext = useMemo(() => rows.length >= limit, [rows.length, limit]);
  const pageNumber = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(limit));
      sp.set("offset", String(offset));
      if (unreadOnly) sp.set("unreadOnly", "true");

      const res = await fetch(`/api/platform/notifications?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load notifications.");
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch (err: any) {
      setRows([]);
      setUnreadCount(0);
      setError(err?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [unreadOnly, limit, offset]);

  async function markRead(deliveryId: string) {
    setActionLoading(deliveryId);
    setError(null);

    try {
      const res = await fetch(
        `/api/platform/notifications/${encodeURIComponent(deliveryId)}/read`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to mark notification read.");
      }

      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to mark notification read.");
    } finally {
      setActionLoading(null);
    }
  }

  async function openNotification(row: NotificationRow) {
    const href = notificationHref(row);

    setActionLoading(row.deliveryId);
    setError(null);

    try {
      if (!row.readAt) {
        const res = await fetch(
          `/api/platform/notifications/${encodeURIComponent(row.deliveryId)}/read`,
          {
            method: "POST",
            credentials: "include",
          },
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Failed to mark notification read.");
        }
      }

      if (href) {
        router.push(href);
        return;
      }

      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to open notification.");
      setActionLoading(null);
    }
  }

  async function markAllRead() {
    setActionLoading("read-all");
    setError(null);

    try {
      const res = await fetch("/api/platform/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to mark all notifications read.");
      }

      setOffset(0);
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to mark all notifications read.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            Task assignments, comments, and platform notifications.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/my-work" className="btn btn-secondary">
            My Work
          </Link>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={load}
            disabled={loading || !!actionLoading}
          >
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={markAllRead}
            disabled={unreadCount === 0 || !!actionLoading}
          >
            {actionLoading === "read-all" ? "Updating…" : "Mark All Read"}
          </button>
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
        <div className="card">
          <div className="badge badge-brand-blue" style={{ width: "fit-content" }}>
            Unread
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {unreadCount}
          </div>
        </div>

        <div className="card">
          <div className="badge badge-neutral" style={{ width: "fit-content" }}>
            Showing
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {rows.length}
          </div>
        </div>

        <div className="card">
          <div className="badge badge-neutral" style={{ width: "fit-content" }}>
            Page
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
            {pageNumber}
          </div>
        </div>
      </div>

      <section className="card">
        <div className="section-card-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Inbox</h2>
            <div className="text-soft">
              Open a notification to mark it read and navigate to the related task or source record.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <select
              className="select"
              value={unreadOnly ? "unread" : "all"}
              onChange={(e) => {
                setUnreadOnly(e.target.value === "unread");
                setOffset(0);
              }}
              style={{ width: 150 }}
            >
              <option value="all">All</option>
              <option value="unread">Unread Only</option>
            </select>

            <select
              className="select"
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              style={{ width: 130 }}
            >
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-muted">Loading notifications…</div>
        ) : rows.length === 0 ? (
          <div className="text-muted">No notifications found.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => {
              const href = notificationHref(row);
              const unread = !row.readAt;

              return (
                <div
                  key={row.deliveryId}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 14,
                    background: unread ? "var(--surface-subtle)" : "var(--surface)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {unread ? (
                          <span className="badge badge-brand-blue">Unread</span>
                        ) : (
                          <span className="badge badge-neutral">Read</span>
                        )}

                        {priorityBadge(row.priority)}

                        <span className="badge badge-neutral">
                          {sourceLabel(row)}
                        </span>
                      </div>

                      <div style={{ fontWeight: 800, color: "var(--text)" }}>
                        {row.title}
                      </div>

                      {row.message ? (
                        <div className="text-soft" style={{ lineHeight: 1.4 }}>
                          {row.message}
                        </div>
                      ) : null}

                      <div className="text-soft" style={{ fontSize: 12 }}>
                        {prettyLabel(row.eventType)} • {fmtDateTime(row.createdAt)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => openNotification(row)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === row.deliveryId
                          ? "Opening…"
                          : href
                            ? "Open"
                            : "Mark Read"}
                      </button>

                      {unread ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => markRead(row.deliveryId)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === row.deliveryId ? "Updating…" : "Mark Read"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setOffset((current) => Math.max(0, current - limit))}
            disabled={offset === 0 || loading || !!actionLoading}
          >
            Previous
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setOffset((current) => current + limit)}
            disabled={!hasNext || loading || !!actionLoading}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}