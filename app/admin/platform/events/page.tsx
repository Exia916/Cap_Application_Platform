"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";

type EventTypeRow = {
  id: string;
  module: string;
  eventType: string;
  eventLabel: string;
  eventDescription: string | null;
  eventGroup: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

type EventForm = {
  module: string;
  eventType: string;
  eventLabel: string;
  eventDescription: string;
  eventGroup: string;
  sortOrder: string;
  isActive: boolean;
};

type EventEditForm = {
  eventLabel: string;
  eventDescription: string;
  eventGroup: string;
  sortOrder: string;
  isActive: boolean;
};

type Filters = {
  module: string;
  eventType: string;
  eventLabel: string;
  eventGroup: string;
  eventDescription: string;
  isActive: string;
};

const DEFAULT_FILTERS: Filters = {
  module: "",
  eventType: "",
  eventLabel: "",
  eventGroup: "",
  eventDescription: "",
  isActive: "",
};

const DEFAULT_FORM: EventForm = {
  module: "",
  eventType: "",
  eventLabel: "",
  eventDescription: "",
  eventGroup: "general",
  sortOrder: "0",
  isActive: true,
};

function statusBadge(active: boolean) {
  return (
    <span className={active ? "badge badge-success" : "badge badge-neutral"}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function normalizeCreatePayload(form: EventForm) {
  return {
    module: form.module.trim().toLowerCase(),
    eventType: form.eventType.trim().toLowerCase(),
    eventLabel: form.eventLabel.trim(),
    eventDescription: form.eventDescription.trim() || null,
    eventGroup: form.eventGroup.trim() || "general",
    sortOrder: Number(form.sortOrder || 0),
    isActive: !!form.isActive,
  };
}

function normalizeEditPayload(form: EventEditForm) {
  return {
    eventLabel: form.eventLabel.trim(),
    eventDescription: form.eventDescription.trim() || null,
    eventGroup: form.eventGroup.trim() || "general",
    sortOrder: Number(form.sortOrder || 0),
    isActive: !!form.isActive,
  };
}

function validateCreate(form: EventForm): string {
  if (!form.module.trim()) return "Module is required.";
  if (!form.eventType.trim()) return "Event Type is required.";
  if (!form.eventLabel.trim()) return "Event Label is required.";

  const module = form.module.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(module)) {
    return "Module may only contain lowercase letters, numbers, underscores, or dashes.";
  }

  const eventType = form.eventType.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.:-]*$/.test(eventType)) {
    return "Event Type may only contain lowercase letters, numbers, dots, underscores, dashes, or colons.";
  }

  return "";
}

function validateEdit(form: EventEditForm): string {
  if (!form.eventLabel.trim()) return "Event Label is required.";
  return "";
}

function compareValues(a: unknown, b: unknown, dir: SortDir) {
  const direction = dir === "asc" ? 1 : -1;

  if (typeof a === "number" || typeof b === "number") {
    return (Number(a ?? 0) - Number(b ?? 0)) * direction;
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return ((a ? 1 : 0) - (b ? 1 : 0)) * direction;
  }

  return String(a ?? "")
    .toLowerCase()
    .localeCompare(String(b ?? "").toLowerCase()) * direction;
}

function sortValue(row: EventTypeRow, key: string): unknown {
  switch (key) {
    case "module":
      return row.module;
    case "eventType":
      return row.eventType;
    case "eventLabel":
      return row.eventLabel;
    case "eventGroup":
      return row.eventGroup;
    case "sortOrder":
      return row.sortOrder;
    case "isActive":
      return row.isActive;
    case "updatedAt":
      return row.updatedAt;
    default:
      return row.eventLabel;
  }
}

export default function AdminPlatformEventsPage() {
  const [rows, setRows] = useState<EventTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [newForm, setNewForm] = useState<EventForm>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EventEditForm | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("module");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/platform/event-types", {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to load event types.");
      }

      setRows(Array.isArray((json as any)?.rows) ? (json as any).rows : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to load event types.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [filters, sortBy, sortDir, pageSize]);

  function onToggleSort(key: string) {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("asc");
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
    setSortBy("module");
    setSortDir("asc");
    setPageIndex(0);
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        filters.module.trim() &&
        !row.module.toLowerCase().includes(filters.module.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        filters.eventType.trim() &&
        !row.eventType.toLowerCase().includes(filters.eventType.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        filters.eventLabel.trim() &&
        !row.eventLabel.toLowerCase().includes(filters.eventLabel.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        filters.eventGroup.trim() &&
        !row.eventGroup.toLowerCase().includes(filters.eventGroup.trim().toLowerCase())
      ) {
        return false;
      }

      if (
        filters.eventDescription.trim() &&
        !String(row.eventDescription ?? "")
          .toLowerCase()
          .includes(filters.eventDescription.trim().toLowerCase())
      ) {
        return false;
      }

      if (filters.isActive === "true" && !row.isActive) return false;
      if (filters.isActive === "false" && row.isActive) return false;

      return true;
    });
  }, [rows, filters]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const primary = compareValues(sortValue(a, sortBy), sortValue(b, sortBy), sortDir);
      if (primary !== 0) return primary;

      const moduleCompare = a.module.localeCompare(b.module);
      if (moduleCompare !== 0) return moduleCompare;

      return a.eventType.localeCompare(b.eventType);
    });
  }, [filteredRows, sortBy, sortDir]);

  const pagedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, pageIndex, pageSize]);

  function startEditing(row: EventTypeRow) {
    setEditingId(row.id);
    setEditForm({
      eventLabel: row.eventLabel ?? "",
      eventDescription: row.eventDescription ?? "",
      eventGroup: row.eventGroup ?? "general",
      sortOrder: String(row.sortOrder ?? 0),
      isActive: !!row.isActive,
    });
    setError("");
    setSuccessMsg("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  async function createEventType(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setSuccessMsg("");

    const msg = validateCreate(newForm);
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/platform/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(normalizeCreatePayload(newForm)),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to create event type.");
      }

      setNewForm(DEFAULT_FORM);
      setSuccessMsg("Event type created.");
      await loadRows();
    } catch (err: any) {
      setError(err?.message || "Failed to create event type.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editForm) return;

    setError("");
    setSuccessMsg("");

    const msg = validateEdit(editForm);
    if (msg) {
      setError(msg);
      return;
    }

    setSavingId(id);

    try {
      const res = await fetch(`/api/platform/event-types/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(normalizeEditPayload(editForm)),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to update event type.");
      }

      setSuccessMsg("Event type updated.");
      await loadRows();
      cancelEditing();
    } catch (err: any) {
      setError(err?.message || "Failed to update event type.");
    } finally {
      setSavingId(null);
    }
  }

  async function setActive(row: EventTypeRow, nextActive: boolean) {
    const action = nextActive ? "reactivate" : "deactivate";
    const confirmed = window.confirm(
      `${nextActive ? "Reactivate" : "Deactivate"} "${row.eventLabel}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccessMsg("");
    setSavingId(row.id);

    try {
      const res = await fetch(`/api/platform/event-types/${encodeURIComponent(row.id)}`, {
        method: nextActive ? "PUT" : "DELETE",
        headers: nextActive ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: nextActive
          ? JSON.stringify({
              eventLabel: row.eventLabel,
              eventDescription: row.eventDescription,
              eventGroup: row.eventGroup,
              sortOrder: row.sortOrder,
              isActive: true,
            })
          : undefined,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as any)?.error || `Failed to ${action} event type.`);
      }

      setSuccessMsg(nextActive ? "Event type reactivated." : "Event type deactivated.");
      await loadRows();

      if (editingId === row.id) {
        cancelEditing();
      }
    } catch (err: any) {
      setError(err?.message || `Failed to ${action} event type.`);
    } finally {
      setSavingId(null);
    }
  }

  const columns: Column<EventTypeRow>[] = useMemo(
    () => [
      {
        key: "module",
        header: "MODULE",
        sortable: true,
        filterable: true,
        placeholder: "Module",
        render: (row) => <code>{row.module}</code>,
        getSearchText: (row) => row.module,
      },
      {
        key: "eventType",
        header: "EVENT TYPE",
        sortable: true,
        filterable: true,
        placeholder: "Event Type",
        render: (row) => <code>{row.eventType}</code>,
        getSearchText: (row) => row.eventType,
      },
      {
        key: "eventLabel",
        header: "LABEL",
        sortable: true,
        filterable: true,
        placeholder: "Label",
        render: (row) =>
          editingId === row.id && editForm ? (
            <input
              className="input"
              value={editForm.eventLabel}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev ? { ...prev, eventLabel: e.target.value } : prev
                )
              }
            />
          ) : (
            row.eventLabel
          ),
        getSearchText: (row) => row.eventLabel,
      },
      {
        key: "eventGroup",
        header: "GROUP",
        sortable: true,
        filterable: true,
        placeholder: "Group",
        render: (row) =>
          editingId === row.id && editForm ? (
            <input
              className="input"
              value={editForm.eventGroup}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev ? { ...prev, eventGroup: e.target.value } : prev
                )
              }
            />
          ) : (
            row.eventGroup
          ),
        getSearchText: (row) => row.eventGroup,
      },
      {
        key: "sortOrder",
        header: "SORT",
        sortable: true,
        width: 110,
        render: (row) =>
          editingId === row.id && editForm ? (
            <input
              className="input"
              type="number"
              value={editForm.sortOrder}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev ? { ...prev, sortOrder: e.target.value } : prev
                )
              }
            />
          ) : (
            row.sortOrder
          ),
        getSearchText: (row) => String(row.sortOrder ?? 0),
      },
      {
        key: "isActive",
        header: "STATUS",
        sortable: true,
        width: 130,
        filterRender: (
          <select
            className="select"
            value={filters.isActive}
            onChange={(e) => onFilterChange("isActive", e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        ),
        render: (row) =>
          editingId === row.id && editForm ? (
            <select
              className="select"
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev ? { ...prev, isActive: e.target.value === "true" } : prev
                )
              }
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          ) : (
            statusBadge(row.isActive)
          ),
        getSearchText: (row) => (row.isActive ? "Active" : "Inactive"),
      },
      {
        key: "eventDescription",
        header: "DESCRIPTION",
        filterable: true,
        placeholder: "Description",
        render: (row) =>
          editingId === row.id && editForm ? (
            <textarea
              className="textarea"
              rows={2}
              value={editForm.eventDescription}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev ? { ...prev, eventDescription: e.target.value } : prev
                )
              }
            />
          ) : (
            <span style={{ whiteSpace: "normal" }}>
              {row.eventDescription || ""}
            </span>
          ),
        getSearchText: (row) => row.eventDescription ?? "",
      },
      {
        key: "edit",
        header: "ACTIONS",
        width: 220,
        render: (row) => {
          const isEditing = editingId === row.id;
          const busy = savingId === row.id;

          if (isEditing) {
            return (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => saveEdit(row.id)}
                >
                  {busy ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                  onClick={cancelEditing}
                >
                  Cancel
                </button>
              </div>
            );
          }

          return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => startEditing(row)}
              >
                Edit
              </button>

              {row.isActive ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => setActive(row, false)}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => setActive(row, true)}
                >
                  Reactivate
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [editingId, editForm, filters.isActive, savingId]
  );

  return (
    <div className="page-shell-wide section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – Platform Event Catalog</h1>
            <p className="page-subtitle">
              Manage controlled CAP event types used by notification rules and future
              workflow automation.
            </p>
          </div>

          <Link href="/admin" className="btn btn-secondary">
            Back to Admin
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <form className="card section-stack" onSubmit={createEventType}>
        <div className="section-card-header">
          <div>
            <h2 style={{ margin: 0 }}>Add Event Type</h2>
            <div className="text-soft">
              Module and Event Type are stable identifiers. Use lowercase/snake-case style.
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Module *</label>
            <input
              className="input"
              value={newForm.module}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, module: e.target.value }))
              }
              placeholder="design_workflow"
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Event Type *</label>
            <input
              className="input"
              value={newForm.eventType}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, eventType: e.target.value }))
              }
              placeholder="workflow.status.duration_exceeded"
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Label *</label>
            <input
              className="input"
              value={newForm.eventLabel}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, eventLabel: e.target.value }))
              }
              placeholder="Workflow Status Duration Exceeded"
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Group</label>
            <input
              className="input"
              value={newForm.eventGroup}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, eventGroup: e.target.value }))
              }
              placeholder="CAP Workflow"
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Sort Order</label>
            <input
              className="input"
              type="number"
              value={newForm.sortOrder}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, sortOrder: e.target.value }))
              }
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Active</label>
            <select
              className="select"
              value={newForm.isActive ? "true" : "false"}
              onChange={(e) =>
                setNewForm((prev) => ({
                  ...prev,
                  isActive: e.target.value === "true",
                }))
              }
              disabled={saving}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Description</label>
            <textarea
              className="textarea"
              rows={3}
              value={newForm.eventDescription}
              onChange={(e) =>
                setNewForm((prev) => ({
                  ...prev,
                  eventDescription: e.target.value,
                }))
              }
              placeholder="Describe when this event is raised."
              disabled={saving}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Adding..." : "Add Event Type"}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => setNewForm(DEFAULT_FORM)}
          >
            Reset
          </button>
        </div>
      </form>

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
          emptyText="No event types found."
          csvFilename="platform_event_types.csv"
          rowToCsv={(row) => ({
            Module: row.module,
            "Event Type": row.eventType,
            Label: row.eventLabel,
            Group: row.eventGroup,
            "Sort Order": row.sortOrder,
            Status: row.isActive ? "Active" : "Inactive",
            Description: row.eventDescription ?? "",
          })}
          toolbar={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            </div>
          }
        />
      </div>
    </div>
  );
}