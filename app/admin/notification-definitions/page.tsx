"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type NotificationPriority = "low" | "normal" | "high" | "urgent";
type NotificationChannel = "in_app" | "email";

type NotificationDefinitionRow = {
  id: string;
  eventType: string;
  module: string;
  description: string | null;
  isActive: boolean;
  defaultPriority: NotificationPriority;
  titleTemplate: string;
  messageTemplate: string | null;
  channels: NotificationChannel[];
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

type Filters = {
  q: string;
  module: string;
  active: string;
  channel: string;
};

type FormState = {
  id: string | null;
  eventType: string;
  module: string;
  description: string;
  isActive: boolean;
  defaultPriority: NotificationPriority;
  titleTemplate: string;
  messageTemplate: string;
  channels: NotificationChannel[];
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  module: "",
  active: "",
  channel: "",
};

const EMPTY_FORM: FormState = {
  id: null,
  eventType: "",
  module: "tasks",
  description: "",
  isActive: true,
  defaultPriority: "normal",
  titleTemplate: "",
  messageTemplate: "",
  channels: ["in_app"],
};

function fmtDateTime(value?: string | null) {
  if (!value) return "";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function activeBadge(value: boolean) {
  return (
    <span className={value ? "badge badge-success" : "badge badge-neutral"}>
      {value ? "Active" : "Inactive"}
    </span>
  );
}

function priorityBadge(priority: NotificationPriority) {
  const cls =
    priority === "urgent" || priority === "high"
      ? "badge badge-danger"
      : priority === "low"
        ? "badge badge-success"
        : "badge badge-neutral";

  return <span className={cls}>{priority}</span>;
}

function channelsLabel(channels: NotificationChannel[]) {
  if (!Array.isArray(channels) || channels.length === 0) return "in_app";
  return channels.join(", ");
}

function normalizeRowForSearch(row: NotificationDefinitionRow) {
  return [
    row.eventType,
    row.module,
    row.description ?? "",
    row.defaultPriority,
    row.titleTemplate,
    row.messageTemplate ?? "",
    channelsLabel(row.channels),
    row.isActive ? "active" : "inactive",
  ]
    .join(" ")
    .toLowerCase();
}

function formFromRow(row: NotificationDefinitionRow): FormState {
  return {
    id: row.id,
    eventType: row.eventType,
    module: row.module || "tasks",
    description: row.description || "",
    isActive: !!row.isActive,
    defaultPriority: row.defaultPriority || "normal",
    titleTemplate: row.titleTemplate || "",
    messageTemplate: row.messageTemplate || "",
    channels: Array.isArray(row.channels) && row.channels.length ? row.channels : ["in_app"],
  };
}

function FieldBlock({
  label,
  children,
  required = false,
  helperText,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  helperText?: string;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required ? <span style={{ color: "var(--brand-red)" }}> *</span> : null}
      </label>
      {children}
      {helperText ? <div className="field-help">{helperText}</div> : null}
    </div>
  );
}

export default function NotificationDefinitionsAdminPage() {
  const [rows, setRows] = useState<NotificationDefinitionRow[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [sortBy, setSortBy] = useState("eventType");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters({ ...DEFAULT_FILTERS, ...filters }), 250);
    return () => window.clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedFilters, sortBy, sortDir, pageSize]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/notification-definitions", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load notification definitions.");
      }

      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to load notification definitions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = String(debouncedFilters.q ?? "").trim().toLowerCase();
    const moduleFilter = String(debouncedFilters.module ?? "").trim().toLowerCase();
    const activeFilter = String(debouncedFilters.active ?? "").trim();
    const channelFilter = String(debouncedFilters.channel ?? "").trim() as NotificationChannel | "";

    return rows.filter((row) => {
      if (q && !normalizeRowForSearch(row).includes(q)) return false;

      if (
        moduleFilter &&
        !String(row.module ?? "").toLowerCase().includes(moduleFilter)
      ) {
        return false;
      }

      if (activeFilter === "active" && !row.isActive) return false;
      if (activeFilter === "inactive" && row.isActive) return false;

      if (
        channelFilter &&
        (!Array.isArray(row.channels) || !row.channels.includes(channelFilter))
      ) {
        return false;
      }

      return true;
    });
  }, [rows, debouncedFilters]);

  function valueForSort(row: NotificationDefinitionRow, key: string): string | number {
    if (key === "isActive") return row.isActive ? 1 : 0;
    if (key === "channels") return channelsLabel(row.channels);
    if (key === "updatedAt") return row.updatedAt || "";
    if (key === "createdAt") return row.createdAt || "";
    return String((row as any)[key] ?? "").toLowerCase();
  }

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const dir = sortDir === "desc" ? -1 : 1;

    copy.sort((a, b) => {
      const av = valueForSort(a, sortBy);
      const bv = valueForSort(b, sortBy);

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;

      return a.eventType.localeCompare(b.eventType);
    });

    return copy;
  }, [filteredRows, sortBy, sortDir]);

  const pagedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, pageIndex, pageSize]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
      return;
    }

    setSortDir((current) => (current === "asc" ? "desc" : "asc"));
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setSuccessMsg(null);
    setFormOpen(true);
  }

  function openEdit(row: NotificationDefinitionRow) {
    setForm(formFromRow(row));
    setFormError(null);
    setSuccessMsg(null);
    setFormOpen(true);
  }

  function toggleChannel(channel: NotificationChannel, checked: boolean) {
    setForm((current) => {
      const next = checked
        ? Array.from(new Set([...current.channels, channel]))
        : current.channels.filter((x) => x !== channel);

      return {
        ...current,
        channels: next.length ? next : ["in_app"],
      };
    });
  }

  function validateForm() {
    if (!form.eventType.trim()) return "Event type is required.";
    if (!/^[a-z0-9_.-]+$/i.test(form.eventType.trim())) {
      return "Event type can only contain letters, numbers, dots, dashes, and underscores.";
    }
    if (!form.module.trim()) return "Module is required.";
    if (!form.titleTemplate.trim()) return "Title template is required.";
    if (!form.channels.length) return "Select at least one channel.";
    return null;
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        eventType: form.eventType.trim(),
        module: form.module.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
        defaultPriority: form.defaultPriority,
        titleTemplate: form.titleTemplate.trim(),
        messageTemplate: form.messageTemplate.trim() || null,
        channels: form.channels,
      };

      const url = form.id
        ? `/api/admin/notification-definitions/${encodeURIComponent(form.id)}`
        : "/api/admin/notification-definitions";

      const res = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save notification definition.");
      }

      setFormOpen(false);
      setForm(EMPTY_FORM);
      setSuccessMsg("Notification definition saved.");
      await load();
    } catch (err: any) {
      setFormError(err?.message || "Failed to save notification definition.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: NotificationDefinitionRow) {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(
        `/api/admin/notification-definitions/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ isActive: !row.isActive }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update notification definition.");
      }

      setSuccessMsg(row.isActive ? "Notification disabled." : "Notification enabled.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to update notification definition.");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<NotificationDefinitionRow>[] = [
    {
      key: "eventType",
      header: "Event Type",
      sortable: true,
      render: (row) => (
        <button
          type="button"
          className="btn-linkish"
          style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}
          onClick={() => openEdit(row)}
        >
          {row.eventType}
        </button>
      ),
      getSearchText: (row) => row.eventType,
    },
    {
      key: "module",
      header: "Module",
      sortable: true,
      render: (row) => row.module,
      getSearchText: (row) => row.module,
    },
    {
      key: "isActive",
      header: "Active",
      sortable: true,
      render: (row) => activeBadge(row.isActive),
      getSearchText: (row) => (row.isActive ? "active" : "inactive"),
    },
    {
      key: "defaultPriority",
      header: "Priority",
      sortable: true,
      render: (row) => priorityBadge(row.defaultPriority),
      getSearchText: (row) => row.defaultPriority,
    },
    {
      key: "channels",
      header: "Channels",
      sortable: true,
      render: (row) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(row.channels?.length ? row.channels : ["in_app"]).map((channel) => (
            <span key={channel} className="badge badge-neutral">
              {channel}
            </span>
          ))}
        </div>
      ),
      getSearchText: (row) => channelsLabel(row.channels),
    },
    {
      key: "titleTemplate",
      header: "Title Template",
      sortable: true,
      render: (row) => <span style={{ whiteSpace: "normal" }}>{row.titleTemplate}</span>,
      getSearchText: (row) => row.titleTemplate,
    },
    {
      key: "messageTemplate",
      header: "Message Template",
      render: (row) => (
        <span style={{ whiteSpace: "normal" }}>{row.messageTemplate || ""}</span>
      ),
      getSearchText: (row) => row.messageTemplate || "",
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: true,
      render: (row) => fmtDateTime(row.updatedAt),
      getSearchText: (row) => fmtDateTime(row.updatedAt),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openEdit(row)}
          >
            Edit
          </button>
          <button
            type="button"
            className={row.isActive ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}
            onClick={() => toggleActive(row)}
            disabled={saving}
          >
            {row.isActive ? "Disable" : "Enable"}
          </button>
        </div>
      ),
    },
  ];

  const toolbar = (
    <>
      <input
        className="input"
        style={{ width: 240 }}
        value={filters.q}
        onChange={(e) => setFilter("q", e.target.value)}
        placeholder="Search definitions..."
      />

      <input
        className="input"
        style={{ width: 160 }}
        value={filters.module}
        onChange={(e) => setFilter("module", e.target.value)}
        placeholder="Module"
      />

      <select
        className="select"
        style={{ width: 150 }}
        value={filters.active}
        onChange={(e) => setFilter("active", e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <select
        className="select"
        style={{ width: 150 }}
        value={filters.channel}
        onChange={(e) => setFilter("channel", e.target.value)}
      >
        <option value="">All Channels</option>
        <option value="in_app">In-App</option>
        <option value="email">Email</option>
      </select>

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setFilters(DEFAULT_FILTERS);
          setSortBy("eventType");
          setSortDir("asc");
          setPageIndex(0);
        }}
      >
        Clear
      </button>

      <button type="button" className="btn btn-primary" onClick={openCreate}>
        Add Definition
      </button>
    </>
  );

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Notification Definitions</h1>
          <p className="page-subtitle">
            Configure task notification behavior without changing the final delivery hook.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/admin" className="btn btn-secondary">
            Admin Home
          </Link>
        </div>
      </div>

      <div className="section-stack">
        <section className="card">
          <div className="section-card-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Template Tokens</h2>
              <div className="text-soft">
                Available values depend on the notification event, but task notifications currently
                pass common fields like taskTitle, taskNumber, actorName, message, commentText,
                sourceModule, sourceRecordLabel, and taskType.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              "{{taskTitle}}",
              "{{taskNumber}}",
              "{{taskDescription}}",
              "{{actorName}}",
              "{{message}}",
              "{{commentText}}",
              "{{sourceRecordLabel}}",
              "{{taskType}}",
            ].map((token) => (
              <span key={token} className="badge badge-neutral">
                {token}
              </span>
            ))}
          </div>
        </section>

        {error ? <div className="alert alert-danger">{error}</div> : null}
        {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

        <section className="card">
          <DataTable<NotificationDefinitionRow>
            columns={columns}
            rows={pagedRows}
            loading={loading}
            error={error}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={onToggleSort}
            filters={{}}
            onFilterChange={() => {}}
            totalCount={sortedRows.length}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageSizes={[10, 25, 50, 100]}
            onPageIndexChange={setPageIndex}
            onPageSizeChange={setPageSize}
            toolbar={toolbar}
            rowKey={(row) => row.id}
            emptyText="No notification definitions found."
            enableGlobalSearch={false}
            enableCsvExport={true}
            csvFilename="notification_definitions.csv"
            rowToCsv={(row) => ({
              "Event Type": row.eventType,
              Module: row.module,
              Active: row.isActive ? "Yes" : "No",
              Priority: row.defaultPriority,
              Channels: channelsLabel(row.channels),
              "Title Template": row.titleTemplate,
              "Message Template": row.messageTemplate ?? "",
              Description: row.description ?? "",
              Created: fmtDateTime(row.createdAt),
              Updated: fmtDateTime(row.updatedAt),
            })}
          />
        </section>
      </div>

      {formOpen ? (
        <div className="nd-modal-backdrop">
          <div className="card nd-modal">
            <form onSubmit={saveForm} className="section-stack">
              <div className="section-card-header" style={{ marginBottom: 0 }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>
                    {form.id ? "Edit Notification Definition" : "Add Notification Definition"}
                  </h2>
                  <div className="text-soft">
                    These settings control whether notifications are active, how they are worded,
                    and which delivery channels are requested.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Close
                </button>
              </div>

              {formError ? <div className="alert alert-danger">{formError}</div> : null}

              <div className="form-grid">
                <FieldBlock
                  label="Event Type"
                  required
                  helperText={form.id ? "Event type cannot be changed after creation." : undefined}
                >
                  <input
                    className="input"
                    value={form.eventType}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, eventType: e.target.value }))
                    }
                    placeholder="task.created"
                    disabled={!!form.id || saving}
                  />
                </FieldBlock>

                <FieldBlock label="Module" required>
                  <input
                    className="input"
                    value={form.module}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, module: e.target.value }))
                    }
                    placeholder="tasks"
                    disabled={saving}
                  />
                </FieldBlock>

                <FieldBlock label="Default Priority" required>
                  <select
                    className="select"
                    value={form.defaultPriority}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        defaultPriority: e.target.value as NotificationPriority,
                      }))
                    }
                    disabled={saving}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </FieldBlock>

                <FieldBlock label="Active">
                  <label className="muted-box" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((current) => ({ ...current, isActive: e.target.checked }))
                      }
                      disabled={saving}
                    />
                    <span>{form.isActive ? "Active" : "Inactive"}</span>
                  </label>
                </FieldBlock>
              </div>

              <FieldBlock label="Title Template" required>
                <input
                  className="input"
                  value={form.titleTemplate}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, titleTemplate: e.target.value }))
                  }
                  placeholder="New task: {{taskTitle}}"
                  disabled={saving}
                />
              </FieldBlock>

              <FieldBlock label="Message Template">
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.messageTemplate}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, messageTemplate: e.target.value }))
                  }
                  placeholder="{{actorName}}: {{commentText}}"
                  disabled={saving}
                />
              </FieldBlock>

              <FieldBlock label="Description">
                <textarea
                  className="textarea"
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, description: e.target.value }))
                  }
                  placeholder="Describe when this notification is sent."
                  disabled={saving}
                />
              </FieldBlock>

              <FieldBlock label="Channels" required>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <label className="muted-box" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.channels.includes("in_app")}
                      onChange={(e) => toggleChannel("in_app", e.target.checked)}
                      disabled={saving}
                    />
                    <span>In-App</span>
                  </label>

                  <label className="muted-box" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={form.channels.includes("email")}
                      onChange={(e) => toggleChannel("email", e.target.checked)}
                      disabled={saving}
                    />
                    <span>Email</span>
                  </label>
                </div>

                <div className="field-help">
                  Email remains controlled by the existing delivery engine flag and user preferences.
                  This page only configures the requested channels.
                </div>
              </FieldBlock>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Definition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .nd-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgba(17, 17, 17, 0.34);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .nd-modal {
          width: min(980px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
        }
      `}</style>
    </div>
  );
}
