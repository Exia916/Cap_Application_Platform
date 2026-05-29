"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type RuleRunRow = {
  id: string;

  ruleId: string;
  ruleName: string | null;

  notificationEventId: string | null;

  entityType: string;
  entityId: string;
  entityLabel: string | null;

  eventType: string;
  triggerType: string;

  workflowStatusId: number | null;
  workflowStatusLabel: string | null;
  statusEnteredAt: string | null;

  recipientUserId: string | null;
  recipientUserLabel: string | null;
  recipientEmail: string | null;
  recipientDisplay: string | null;

  notificationTitle: string | null;
  notificationMessage: string | null;
  notificationPriority: string | null;
  notificationCreatedAt: string | null;

  deliveryCount: number;
  deliveryChannels: string[];
  deliveryStatuses: string[];
  deliveryErrors: string | null;
  lastAttemptedAt: string | null;
  lastDeliveredAt: string | null;

  triggeredAt: string;
  metadata: Record<string, any>;
};

type RuleRunDeliveryRow = {
  id: string;
  notificationEventId: string;

  recipientUserId: string | null;
  recipientUserLabel: string | null;
  recipientEmail: string | null;
  recipientKind: string | null;
  recipientLabel: string | null;

  channel: string;
  status: string;

  attemptedAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;

  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;

  errorMessage: string | null;
  skippedReason: string | null;

  createdAt: string;
  updatedAt: string;
};

type RuleRunDetail = RuleRunRow & {
  eventPayload: Record<string, any> | null;
  deliveries: RuleRunDeliveryRow[];
};

type Filters = {
  q: string;
  eventType: string;
  triggerType: string;
  deliveryStatus: string;
  recipient: string;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  eventType: "",
  triggerType: "",
  deliveryStatus: "",
  recipient: "",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function statusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "sent") {
    return <span className="badge badge-success">Sent</span>;
  }

  if (normalized === "pending") {
    return <span className="badge badge-warning">Pending</span>;
  }

  if (normalized === "failed") {
    return <span className="badge badge-danger">Failed</span>;
  }

  if (normalized === "skipped") {
    return <span className="badge badge-neutral">Skipped</span>;
  }

  return <span className="badge badge-neutral">{status || "Unknown"}</span>;
}

function priorityBadge(priority: string | null | undefined) {
  const normalized = String(priority || "normal").toLowerCase();

  if (normalized === "urgent" || normalized === "high") {
    return <span className="badge badge-danger">{normalized}</span>;
  }

  if (normalized === "low") {
    return <span className="badge badge-neutral">low</span>;
  }

  return <span className="badge badge-info">{normalized}</span>;
}

function formatArray(values: string[] | null | undefined) {
  return Array.isArray(values) ? values.filter(Boolean).join(", ") : "";
}

function compareValues(a: unknown, b: unknown, dir: SortDir) {
  const direction = dir === "asc" ? 1 : -1;

  if (typeof a === "number" || typeof b === "number") {
    return (Number(a ?? 0) - Number(b ?? 0)) * direction;
  }

  return (
    String(a ?? "")
      .toLowerCase()
      .localeCompare(String(b ?? "").toLowerCase()) * direction
  );
}

function sortValue(row: RuleRunRow, key: string): unknown {
  switch (key) {
    case "triggeredAt":
      return row.triggeredAt;
    case "ruleName":
      return row.ruleName;
    case "eventType":
      return row.eventType;
    case "triggerType":
      return row.triggerType;
    case "entityLabel":
      return row.entityLabel;
    case "recipientDisplay":
      return row.recipientDisplay;
    case "deliveryCount":
      return row.deliveryCount;
    case "lastDeliveredAt":
      return row.lastDeliveredAt;
    default:
      return row.triggeredAt;
  }
}

function jsonPretty(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export default function NotificationRuleRunsPage() {
  const [rows, setRows] = useState<RuleRunRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<RuleRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [sortBy, setSortBy] = useState("triggeredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", "500");
      params.set("offset", "0");

      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.eventType.trim()) params.set("eventType", filters.eventType.trim());
      if (filters.triggerType.trim()) params.set("triggerType", filters.triggerType.trim());
      if (filters.deliveryStatus.trim()) params.set("deliveryStatus", filters.deliveryStatus.trim());
      if (filters.recipient.trim()) params.set("recipient", filters.recipient.trim());

      const res = await fetch(`/api/platform/notification-rule-runs?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to load notification rule runs.");
      }

      setRows(Array.isArray((json as any)?.rows) ? (json as any).rows : []);
      setTotalCount(Number((json as any)?.totalCount ?? 0));
    } catch (err: any) {
      setRows([]);
      setTotalCount(0);
      setError(err?.message || "Failed to load notification rule runs.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    setSelectedDetail(null);
    setDetailLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/platform/notification-rule-runs/${encodeURIComponent(id)}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to load rule run detail.");
      }

      setSelectedDetail((json as any).row ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load rule run detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [filters, sortBy, sortDir, pageSize]);

  const eventTypes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.eventType).filter(Boolean))).sort();
  }, [rows]);

  const triggerTypes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.triggerType).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const q = filters.q.trim().toLowerCase();
      if (q) {
        const haystack = [
          row.ruleName,
          row.eventType,
          row.triggerType,
          row.entityType,
          row.entityId,
          row.entityLabel,
          row.recipientDisplay,
          row.recipientEmail,
          row.notificationTitle,
          row.notificationMessage,
          row.workflowStatusLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      if (filters.eventType && row.eventType !== filters.eventType) return false;
      if (filters.triggerType && row.triggerType !== filters.triggerType) return false;

      if (
        filters.deliveryStatus &&
        !row.deliveryStatuses.map((x) => x.toLowerCase()).includes(filters.deliveryStatus)
      ) {
        return false;
      }

      if (filters.recipient.trim()) {
        const text = [
          row.recipientDisplay,
          row.recipientEmail,
          row.recipientUserLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(filters.recipient.trim().toLowerCase())) return false;
      }

      return true;
    });
  }, [rows, filters]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const primary = compareValues(sortValue(a, sortBy), sortValue(b, sortBy), sortDir);
      if (primary !== 0) return primary;

      return String(b.triggeredAt || "").localeCompare(String(a.triggeredAt || ""));
    });
  }, [filteredRows, sortBy, sortDir]);

  const pagedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, pageIndex, pageSize]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir(key === "triggeredAt" ? "desc" : "asc");
      return;
    }

    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function onFilterChange(key: string, value: string) {
    if (key in DEFAULT_FILTERS) {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSortBy("triggeredAt");
    setSortDir("desc");
    setPageIndex(0);
  }

  const columns: Column<RuleRunRow>[] = useMemo(
    () => [
      {
        key: "triggeredAt",
        header: "TRIGGERED",
        sortable: true,
        render: (row) => formatDateTime(row.triggeredAt),
        getSearchText: (row) => row.triggeredAt,
      },
      {
        key: "ruleName",
        header: "RULE",
        sortable: true,
        filterable: true,
        placeholder: "Rule / search",
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{row.ruleName || "Unknown rule"}</span>
            <code>{row.ruleId}</code>
          </div>
        ),
        getSearchText: (row) => `${row.ruleName || ""} ${row.ruleId}`,
      },
      {
        key: "eventType",
        header: "EVENT",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.eventType}
            onChange={(e) => onFilterChange("eventType", e.target.value)}
          >
            <option value="">All</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
        ),
        render: (row) => <code>{row.eventType}</code>,
        getSearchText: (row) => row.eventType,
      },
      {
        key: "triggerType",
        header: "TRIGGER",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.triggerType}
            onChange={(e) => onFilterChange("triggerType", e.target.value)}
          >
            <option value="">All</option>
            {triggerTypes.map((triggerType) => (
              <option key={triggerType} value={triggerType}>
                {triggerType}
              </option>
            ))}
          </select>
        ),
        render: (row) => row.triggerType,
        getSearchText: (row) => row.triggerType,
      },
      {
        key: "entityLabel",
        header: "RECORD",
        sortable: true,
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{row.entityLabel || row.entityId}</span>
            <span className="text-soft">{row.entityType}</span>
          </div>
        ),
        getSearchText: (row) => `${row.entityLabel || ""} ${row.entityId} ${row.entityType}`,
      },
      {
        key: "workflowStatus",
        header: "WORKFLOW STATUS",
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{row.workflowStatusLabel || ""}</span>
            {row.statusEnteredAt ? (
              <span className="text-soft">{formatDateTime(row.statusEnteredAt)}</span>
            ) : null}
          </div>
        ),
        getSearchText: (row) => `${row.workflowStatusLabel || ""} ${row.statusEnteredAt || ""}`,
      },
      {
        key: "recipientDisplay",
        header: "RECIPIENT",
        sortable: true,
        filterable: true,
        placeholder: "Recipient",
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{row.recipientDisplay || ""}</span>
            {row.recipientEmail ? <span className="text-soft">{row.recipientEmail}</span> : null}
          </div>
        ),
        getSearchText: (row) => `${row.recipientDisplay || ""} ${row.recipientEmail || ""}`,
      },
      {
        key: "deliveryStatuses",
        header: "DELIVERY",
        filterRender: (
          <select
            className="select"
            value={filters.deliveryStatus}
            onChange={(e) => onFilterChange("deliveryStatus", e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        ),
        render: (row) => (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {row.deliveryStatuses.length ? (
              row.deliveryStatuses.map((status) => <span key={status}>{statusBadge(status)}</span>)
            ) : (
              <span className="text-soft">No deliveries</span>
            )}
          </div>
        ),
        getSearchText: (row) => formatArray(row.deliveryStatuses),
      },
      {
        key: "deliveryCount",
        header: "COUNT",
        sortable: true,
        render: (row) => row.deliveryCount,
        getSearchText: (row) => String(row.deliveryCount),
      },
      {
        key: "view",
        header: "ACTIONS",
        width: 120,
        render: (row) => (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadDetail(row.id)}
          >
            View
          </button>
        ),
      },
    ],
    [eventTypes, filters.deliveryStatus, filters.eventType, filters.triggerType, triggerTypes]
  );

  return (
    <div className="page-shell-wide section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – Notification Rule Runs</h1>
            <p className="page-subtitle">
              Review fired notification rules, matched records, recipients, and delivery outcomes.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/notification-rules" className="btn btn-secondary">
              Notification Rules
            </Link>
            <Link href="/admin/platform/notification-rules/evaluate" className="btn btn-secondary">
              Rule Evaluation
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="card">
        <DataTable
          columns={columns}
          rows={pagedRows}
          loading={loading}
          error={error || null}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={onToggleSort}
          filters={filters}
          onFilterChange={onFilterChange}
          totalCount={sortedRows.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          rowKey={(row) => row.id}
          emptyText="No notification rule runs found."
          csvFilename="notification_rule_runs.csv"
          rowToCsv={(row) => ({
            Triggered: formatDateTime(row.triggeredAt),
            Rule: row.ruleName || "",
            "Rule ID": row.ruleId,
            Event: row.eventType,
            Trigger: row.triggerType,
            "Entity Type": row.entityType,
            "Entity ID": row.entityId,
            Record: row.entityLabel || "",
            "Workflow Status": row.workflowStatusLabel || "",
            "Status Entered": formatDateTime(row.statusEnteredAt),
            Recipient: row.recipientDisplay || "",
            "Recipient Email": row.recipientEmail || "",
            "Delivery Count": row.deliveryCount,
            Channels: formatArray(row.deliveryChannels),
            Statuses: formatArray(row.deliveryStatuses),
            Errors: row.deliveryErrors || "",
            Title: row.notificationTitle || "",
          })}
          toolbar={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={clearFilters}
              >
                Clear Filters
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadRows}
              >
                Refresh
              </button>

              <span className="text-soft">
                Loaded {rows.length} of {totalCount}
              </span>
            </div>
          }
        />
      </div>

      <div className="card section-stack">
        <div className="section-card-header">
          <div>
            <h2 style={{ margin: 0 }}>Rule Run Detail</h2>
            <div className="text-soft">
              Select a rule run to review notification event, metadata, and deliveries.
            </div>
          </div>

          {selectedDetail ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedId(null);
                setSelectedDetail(null);
              }}
            >
              Clear Selection
            </button>
          ) : null}
        </div>

        {detailLoading ? <div className="text-soft">Loading detail...</div> : null}

        {!detailLoading && !selectedId ? (
          <div className="text-soft">No rule run selected.</div>
        ) : null}

        {!detailLoading && selectedId && !selectedDetail ? (
          <div className="text-soft">No detail loaded.</div>
        ) : null}

        {selectedDetail ? (
          <>
            <div className="section-grid">
              <div className="section-card">
                <div className="text-soft">Rule</div>
                <div style={{ fontWeight: 700 }}>{selectedDetail.ruleName || "Unknown rule"}</div>
                <code>{selectedDetail.ruleId}</code>
              </div>

              <div className="section-card">
                <div className="text-soft">Event</div>
                <div style={{ fontWeight: 700 }}>{selectedDetail.eventType}</div>
                <div>{selectedDetail.triggerType}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Record</div>
                <div style={{ fontWeight: 700 }}>
                  {selectedDetail.entityLabel || selectedDetail.entityId}
                </div>
                <div>{selectedDetail.entityType}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Recipient</div>
                <div style={{ fontWeight: 700 }}>{selectedDetail.recipientDisplay || ""}</div>
                <div>{selectedDetail.recipientEmail || ""}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Priority</div>
                <div>{priorityBadge(selectedDetail.notificationPriority)}</div>
              </div>

              <div className="section-card">
                <div className="text-soft">Triggered</div>
                <div>{formatDateTime(selectedDetail.triggeredAt)}</div>
              </div>
            </div>

            <div className="section-card">
              <h3 style={{ marginTop: 0 }}>Notification</h3>
              <div style={{ fontWeight: 700 }}>{selectedDetail.notificationTitle || ""}</div>
              {selectedDetail.notificationMessage ? (
                <p style={{ whiteSpace: "pre-wrap" }}>{selectedDetail.notificationMessage}</p>
              ) : (
                <div className="text-soft">No message.</div>
              )}
            </div>

            <div className="section-card">
              <h3 style={{ marginTop: 0 }}>Deliveries</h3>

              {selectedDetail.deliveries.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th>Status</th>
                        <th>Recipient</th>
                        <th>Attempts</th>
                        <th>Attempted</th>
                        <th>Delivered</th>
                        <th>Error / Skip Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDetail.deliveries.map((delivery) => (
                        <tr key={delivery.id}>
                          <td>{delivery.channel}</td>
                          <td>{statusBadge(delivery.status)}</td>
                          <td>
                            <div style={{ display: "grid", gap: 2 }}>
                              <span>
                                {delivery.recipientUserLabel ||
                                  delivery.recipientLabel ||
                                  delivery.recipientEmail ||
                                  ""}
                              </span>
                              {delivery.recipientEmail ? (
                                <span className="text-soft">{delivery.recipientEmail}</span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            {delivery.attemptCount} / {delivery.maxAttempts}
                          </td>
                          <td>{formatDateTime(delivery.attemptedAt)}</td>
                          <td>{formatDateTime(delivery.deliveredAt)}</td>
                          <td>{delivery.errorMessage || delivery.skippedReason || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-soft">No deliveries linked to this rule run.</div>
              )}
            </div>

            <div className="section-card">
              <h3 style={{ marginTop: 0 }}>Rule Run Metadata</h3>
              <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
                {jsonPretty(selectedDetail.metadata)}
              </pre>
            </div>

            <div className="section-card">
              <h3 style={{ marginTop: 0 }}>Notification Event Payload</h3>
              <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
                {jsonPretty(selectedDetail.eventPayload)}
              </pre>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}