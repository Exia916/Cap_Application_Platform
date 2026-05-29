"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DataTable, { type Column, type SortDir } from "@/components/DataTable";
import NotificationRuleConditionEditor from "@/components/NotificationRuleConditionEditor";
import {
  normalizeNotificationRuleConditionConfig,
  type NotificationRuleConditionConfig,
} from "@/lib/services/notificationRuleConditionService";

type EventTypeRow = {
  id: string;
  module: string;
  eventType: string;
  eventLabel: string;
  eventGroup: string;
  isActive: boolean;
};

type WorkflowStatusRow = {
  id: number;
  code: string;
  label: string;
  sort_order?: number;
};

type AssignableUserRow = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  employeeNumber: number | null;
  role: string | null;
  department: string | null;
};

type RoleOption = {
  value: string;
  label: string;
};

type DepartmentRow = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type NotificationRuleRow = {
  id: string;

  ruleName: string;
  module: string;
  eventType: string;
  eventLabel: string | null;

  triggerType: string;

  workflowStatusId: number | null;
  workflowStatusCode: string | null;
  workflowStatusLabel: string | null;

  taskType: string | null;
  durationMinutes: number | null;

  recipientMode: string;
  recipientUserId: string | null;
  recipientUserName: string | null;
  recipientDisplayName: string | null;
  recipientRole: string | null;
  recipientDepartment: string | null;

  recipientStaticEmails: string[];
  ccStaticEmails: string[];
  bccStaticEmails: string[];

  priorityMode: string;
  defaultPriority: string;

  titleTemplate: string | null;
  messageTemplate: string | null;

  channels: string[];
  conditionJson: Record<string, any> | null;

  isActive: boolean;
  updatedAt: string;
};

type RuleForm = {
  ruleName: string;
  module: string;
  eventType: string;
  triggerType: string;

  workflowStatusId: string;
  taskType: string;
  durationMinutes: string;

  recipientMode: string;
  recipientUserId: string;
  recipientRole: string;
  recipientDepartment: string;

  recipientStaticEmails: string;
  ccStaticEmails: string;
  bccStaticEmails: string;

  priorityMode: string;
  defaultPriority: string;

  titleTemplate: string;
  messageTemplate: string;

  channels: string[];
  conditionJson: NotificationRuleConditionConfig;

  isActive: boolean;
};

type Filters = {
  ruleName: string;
  module: string;
  eventType: string;
  triggerType: string;
  recipientMode: string;
  channels: string;
  isActive: string;
};

const DEFAULT_FILTERS: Filters = {
  ruleName: "",
  module: "",
  eventType: "",
  triggerType: "",
  recipientMode: "",
  channels: "",
  isActive: "",
};

function emptyForm(): RuleForm {
  return {
    ruleName: "",
    module: "design_workflow",
    eventType: "workflow.status.duration_exceeded",
    triggerType: "status_duration",

    workflowStatusId: "",
    taskType: "",
    durationMinutes: "1440",

    recipientMode: "static_email_list",
    recipientUserId: "",
    recipientRole: "",
    recipientDepartment: "",

    recipientStaticEmails: "",
    ccStaticEmails: "",
    bccStaticEmails: "",

    priorityMode: "rule_default",
    defaultPriority: "normal",

    titleTemplate: "",
    messageTemplate: "",

    channels: ["in_app", "email"],
    conditionJson: normalizeNotificationRuleConditionConfig({}),

    isActive: false,
  };
}

const TRIGGER_TYPES = [
  { value: "event_based", label: "Event Based" },
  { value: "status_duration", label: "Status Duration" },
];

const RECIPIENT_MODES = [
  { value: "source_created_by", label: "Source Created By" },
  { value: "workflow_digitizer", label: "Workflow Digitizer" },
  { value: "workflow_designer", label: "Workflow Designer" },
  { value: "workflow_bin_user", label: "Workflow Bin User" },
  { value: "specific_user", label: "Specific User" },
  { value: "role", label: "Role" },
  { value: "department", label: "Department" },
  { value: "static_email_list", label: "Static Email List" },
];

const PRIORITY_MODES = [
  { value: "definition_default", label: "Definition Default" },
  { value: "rule_default", label: "Rule Default" },
  { value: "source_priority", label: "Source Priority" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const TEMPLATE_VARIABLES = [
  "{{requestNumber}}",
  "{{sourceRecordLabel}}",
  "{{salesOrder}}",
  "{{customerName}}",
  "{{workflowStatusLabel}}",
  "{{previousWorkflowStatusLabel}}",
  "{{newWorkflowStatusLabel}}",
  "{{fieldLabel}}",
  "{{previousValue}}",
  "{{newValue}}",
  "{{actorName}}",
  "{{createdByName}}",
  "{{digitizerName}}",
  "{{designerName}}",
  "{{binCode}}",
  "{{dueDate}}",
  "{{rush}}",
  "{{elapsedMinutes}}",
  "{{durationMinutes}}",
  "{{durationHours}}",
  "{{statusEnteredAt}}",
];

function isWorkflowStatusEvent(eventType: string): boolean {
  return [
    "workflow.status.changed",
    "workflow.status.entered",
    "workflow.status.exited",
    "workflow.status.duration_exceeded",
  ].includes(String(eventType || "").trim());
}

function shouldShowWorkflowStatus(form: RuleForm): boolean {
  return form.triggerType === "status_duration" || isWorkflowStatusEvent(form.eventType);
}

function isWorkflowStatusRequired(form: RuleForm): boolean {
  return form.triggerType === "status_duration";
}

function parseEmails(value: string): string[] {
  return String(value || "")
    .split(/[\n,;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function joinEmails(value: string[] | null | undefined): string {
  return Array.isArray(value) ? value.join("\n") : "";
}

function fmtChannels(channels: string[]) {
  if (!channels?.length) return "";
  return channels
    .map((c) => (c === "in_app" ? "In-App" : c === "email" ? "Email" : c))
    .join(", ");
}

function fmtStatus(row: NotificationRuleRow) {
  return (
    <span className={row.isActive ? "badge badge-success" : "badge badge-neutral"}>
      {row.isActive ? "Active" : "Inactive"}
    </span>
  );
}

function fmtTrigger(v: string) {
  return TRIGGER_TYPES.find((x) => x.value === v)?.label ?? v;
}

function fmtRecipient(row: NotificationRuleRow) {
  if (row.recipientMode === "specific_user") {
    return row.recipientDisplayName || row.recipientUserName || row.recipientUserId || "";
  }

  if (row.recipientMode === "role") return row.recipientRole || "";
  if (row.recipientMode === "department") return row.recipientDepartment || "";

  if (row.recipientMode === "static_email" || row.recipientMode === "static_email_list") {
    return row.recipientStaticEmails?.join(", ") || "";
  }

  return RECIPIENT_MODES.find((x) => x.value === row.recipientMode)?.label ?? row.recipientMode;
}

function buildPayload(form: RuleForm) {
  const showWorkflowStatus = shouldShowWorkflowStatus(form);

  return {
    ruleName: form.ruleName.trim(),
    module: form.module.trim(),
    eventType: form.eventType.trim(),
    triggerType: form.triggerType,

    workflowStatusId:
      showWorkflowStatus && form.workflowStatusId ? Number(form.workflowStatusId) : null,

    taskType: form.taskType.trim() || null,

    durationMinutes:
      form.triggerType === "status_duration" && form.durationMinutes
        ? Number(form.durationMinutes)
        : null,

    recipientMode: form.recipientMode,
    recipientUserId: form.recipientUserId || null,
    recipientRole: form.recipientRole || null,
    recipientDepartment: form.recipientDepartment || null,

    recipientStaticEmails: parseEmails(form.recipientStaticEmails),
    ccStaticEmails: parseEmails(form.ccStaticEmails),
    bccStaticEmails: parseEmails(form.bccStaticEmails),

    priorityMode: form.priorityMode,
    defaultPriority: form.defaultPriority,

    titleTemplate: form.titleTemplate.trim() || null,
    messageTemplate: form.messageTemplate.trim() || null,

    channels: form.channels,
    conditionJson: normalizeNotificationRuleConditionConfig(form.conditionJson),

    isActive: !!form.isActive,
  };
}

function validateForm(form: RuleForm) {
  if (!form.ruleName.trim()) return "Rule Name is required.";
  if (!form.module.trim()) return "Module is required.";
  if (!form.eventType.trim()) return "Event Type is required.";

  if (form.triggerType === "status_duration") {
    if (!form.workflowStatusId) {
      return "Workflow Status is required for status-duration rules.";
    }

    const duration = Number(form.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      return "Duration Minutes must be greater than zero.";
    }
  }

  if (form.recipientMode === "specific_user" && !form.recipientUserId) {
    return "Specific User is required for this recipient mode.";
  }

  if (form.recipientMode === "role" && !form.recipientRole) {
    return "Role is required for this recipient mode.";
  }

  if (form.recipientMode === "department" && !form.recipientDepartment) {
    return "Department is required for this recipient mode.";
  }

  if (
    (form.recipientMode === "static_email" || form.recipientMode === "static_email_list") &&
    parseEmails(form.recipientStaticEmails).length === 0
  ) {
    return "At least one static recipient email is required.";
  }

  if (!form.channels.length) return "At least one channel is required.";

  return "";
}

function formFromRule(row: NotificationRuleRow): RuleForm {
  return {
    ruleName: row.ruleName || "",
    module: row.module || "",
    eventType: row.eventType || "",
    triggerType: row.triggerType || "event_based",

    workflowStatusId: row.workflowStatusId != null ? String(row.workflowStatusId) : "",
    taskType: row.taskType || "",
    durationMinutes: row.durationMinutes != null ? String(row.durationMinutes) : "",

    recipientMode: row.recipientMode || "source_created_by",
    recipientUserId: row.recipientUserId || "",
    recipientRole: row.recipientRole || "",
    recipientDepartment: row.recipientDepartment || "",

    recipientStaticEmails: joinEmails(row.recipientStaticEmails),
    ccStaticEmails: joinEmails(row.ccStaticEmails),
    bccStaticEmails: joinEmails(row.bccStaticEmails),

    priorityMode: row.priorityMode || "definition_default",
    defaultPriority: row.defaultPriority || "normal",

    titleTemplate: row.titleTemplate || "",
    messageTemplate: row.messageTemplate || "",

    channels: Array.isArray(row.channels) && row.channels.length ? row.channels : ["in_app"],
    conditionJson: normalizeNotificationRuleConditionConfig(row.conditionJson),

    isActive: !!row.isActive,
  };
}

function compareValues(a: unknown, b: unknown, dir: SortDir) {
  const direction = dir === "asc" ? 1 : -1;

  if (typeof a === "number" || typeof b === "number") {
    return (Number(a ?? 0) - Number(b ?? 0)) * direction;
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return ((a ? 1 : 0) - (b ? 1 : 0)) * direction;
  }

  return (
    String(a ?? "")
      .toLowerCase()
      .localeCompare(String(b ?? "").toLowerCase()) * direction
  );
}

function sortValue(row: NotificationRuleRow, key: string): unknown {
  switch (key) {
    case "ruleName":
      return row.ruleName;
    case "module":
      return row.module;
    case "eventType":
      return row.eventType;
    case "triggerType":
      return row.triggerType;
    case "workflowStatus":
      return row.workflowStatusLabel;
    case "recipientMode":
      return row.recipientMode;
    case "isActive":
      return row.isActive;
    case "updatedAt":
      return row.updatedAt;
    default:
      return row.ruleName;
  }
}

function TemplateVariableReference() {
  return (
    <details className="section-card" style={{ padding: 14 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        Template Variable Reference
      </summary>

      <div className="section-stack" style={{ marginTop: 12 }}>
        <div className="alert alert-info">
          Use these variables in the Title Template and Message Template fields.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TEMPLATE_VARIABLES.map((v) => (
            <code
              key={v}
              style={{
                display: "inline-flex",
                padding: "4px 8px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--surface-muted)",
                fontSize: 12,
              }}
            >
              {v}
            </code>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function AdminNotificationRulesPage() {
  const [rows, setRows] = useState<NotificationRuleRow[]>([]);
  const [events, setEvents] = useState<EventTypeRow[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatusRow[]>([]);
  const [users, setUsers] = useState<AssignableUserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const [form, setForm] = useState<RuleForm>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("module");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function loadRules() {
    const res = await fetch("/api/platform/notification-rules", {
      cache: "no-store",
      credentials: "include",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as any)?.error || "Failed to load notification rules.");
    }

    setRows(Array.isArray((json as any)?.rows) ? (json as any).rows : []);
  }

  async function loadLookups() {
    const [eventsRes, statusRes, usersRes, rolesRes, departmentsRes] = await Promise.all([
      fetch("/api/platform/event-types?activeOnly=true", {
        cache: "no-store",
        credentials: "include",
      }),
      fetch("/api/design-workflow/statuses", {
        cache: "no-store",
        credentials: "include",
      }),
      fetch("/api/users/assignable?limit=250", {
        cache: "no-store",
        credentials: "include",
      }),
      fetch("/api/lookups/roles", {
        cache: "no-store",
        credentials: "include",
      }),
      fetch("/api/lookups/departments", {
        cache: "no-store",
        credentials: "include",
      }),
    ]);

    const eventsJson = await eventsRes.json().catch(() => ({}));
    if (!eventsRes.ok) {
      throw new Error((eventsJson as any)?.error || "Failed to load event types.");
    }

    const statusJson = await statusRes.json().catch(() => []);
    if (!statusRes.ok) {
      throw new Error((statusJson as any)?.error || "Failed to load Workflow statuses.");
    }

    const usersJson = await usersRes.json().catch(() => ({}));
    if (!usersRes.ok) {
      throw new Error((usersJson as any)?.error || "Failed to load assignable users.");
    }

    const rolesJson = await rolesRes.json().catch(() => ({}));
    if (!rolesRes.ok) {
      throw new Error((rolesJson as any)?.error || "Failed to load roles.");
    }

    const departmentsJson = await departmentsRes.json().catch(() => ({}));
    if (!departmentsRes.ok) {
      throw new Error((departmentsJson as any)?.error || "Failed to load departments.");
    }

    setEvents(
      Array.isArray((eventsJson as any)?.rows) ? ((eventsJson as any).rows as EventTypeRow[]) : []
    );
    setStatuses(Array.isArray(statusJson) ? statusJson : []);
    setUsers(Array.isArray((usersJson as any)?.users) ? (usersJson as any).users : []);
    setRoles(Array.isArray((rolesJson as any)?.options) ? (rolesJson as any).options : []);
    setDepartments(
      Array.isArray((departmentsJson as any)?.departments)
        ? (departmentsJson as any).departments
        : []
    );
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadRules(), loadLookups()]);
    } catch (err: any) {
      setError(err?.message || "Failed to load notification rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [filters, sortBy, sortDir, pageSize]);

  const modules = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.module))).sort();
  }, [events]);

  const filteredEventOptions = useMemo(() => {
    return events
      .filter((e) => !form.module || e.module === form.module)
      .sort((a, b) => a.eventType.localeCompare(b.eventType));
  }, [events, form.module]);

  function setFormValue<K extends keyof RuleForm>(key: K, value: RuleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onChannelChange(channel: string, checked: boolean) {
    setForm((prev) => {
      const next = new Set(prev.channels);

      if (checked) next.add(channel);
      else next.delete(channel);

      return { ...prev, channels: Array.from(next) };
    });
  }

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

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
    setError("");
    setSuccessMsg("");
  }

  function startEditing(row: NotificationRuleRow) {
    setEditingId(row.id);
    setForm(formFromRule(row));
    setError("");
    setSuccessMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitRule(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setSuccessMsg("");

    const msg = validateForm(form);
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);

    try {
      const url = editingId
        ? `/api/platform/notification-rules/${encodeURIComponent(editingId)}`
        : "/api/platform/notification-rules";

      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload(form)),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as any)?.error ||
            `Failed to ${editingId ? "update" : "create"} notification rule.`
        );
      }

      setSuccessMsg(editingId ? "Notification rule updated." : "Notification rule created.");
      resetForm();
      await loadRules();
    } catch (err: any) {
      setError(err?.message || "Failed to save notification rule.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: NotificationRuleRow, nextActive: boolean) {
    const confirmed = window.confirm(
      `${nextActive ? "Reactivate" : "Deactivate"} "${row.ruleName}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const res = await fetch(`/api/platform/notification-rules/${encodeURIComponent(row.id)}`, {
        method: nextActive ? "PUT" : "DELETE",
        headers: nextActive ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: nextActive
          ? JSON.stringify(buildPayload({ ...formFromRule(row), isActive: true }))
          : undefined,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as any)?.error ||
            `Failed to ${nextActive ? "reactivate" : "deactivate"} rule.`
        );
      }

      setSuccessMsg(nextActive ? "Rule reactivated." : "Rule deactivated.");
      await loadRules();

      if (editingId === row.id) resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to update rule status.");
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        filters.ruleName.trim() &&
        !row.ruleName.toLowerCase().includes(filters.ruleName.trim().toLowerCase())
      ) {
        return false;
      }

      if (filters.module.trim() && row.module !== filters.module) return false;
      if (filters.eventType.trim() && row.eventType !== filters.eventType) return false;
      if (filters.triggerType.trim() && row.triggerType !== filters.triggerType) return false;
      if (filters.recipientMode.trim() && row.recipientMode !== filters.recipientMode) return false;

      if (filters.channels.trim() && !row.channels.includes(filters.channels)) return false;

      if (filters.isActive === "true" && !row.isActive) return false;
      if (filters.isActive === "false" && row.isActive) return false;

      return true;
    });
  }, [rows, filters]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const primary = compareValues(sortValue(a, sortBy), sortValue(b, sortBy), sortDir);
      if (primary !== 0) return primary;

      return a.ruleName.localeCompare(b.ruleName);
    });
  }, [filteredRows, sortBy, sortDir]);

  const pagedRows = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, pageIndex, pageSize]);

  const columns: Column<NotificationRuleRow>[] = useMemo(
    () => [
      {
        key: "ruleName",
        header: "RULE",
        sortable: true,
        filterable: true,
        placeholder: "Rule",
        render: (row) => row.ruleName,
        getSearchText: (row) => row.ruleName,
      },
      {
        key: "module",
        header: "MODULE",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.module}
            onChange={(e) => onFilterChange("module", e.target.value)}
          >
            <option value="">All</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ),
        render: (row) => <code>{row.module}</code>,
        getSearchText: (row) => row.module,
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
            {events.map((event) => (
              <option key={event.id} value={event.eventType}>
                {event.eventLabel || event.eventType}
              </option>
            ))}
          </select>
        ),
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{row.eventLabel || row.eventType}</span>
            <code>{row.eventType}</code>
          </div>
        ),
        getSearchText: (row) => `${row.eventLabel || ""} ${row.eventType}`,
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
            {TRIGGER_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ),
        render: (row) => fmtTrigger(row.triggerType),
        getSearchText: (row) => fmtTrigger(row.triggerType),
      },
      {
        key: "workflowStatus",
        header: "STATUS / DURATION",
        sortable: true,
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>{row.workflowStatusLabel || "Any status"}</span>
            {row.durationMinutes ? (
              <span className="text-soft">{row.durationMinutes} minutes</span>
            ) : null}
          </div>
        ),
        getSearchText: (row) =>
          `${row.workflowStatusLabel || "Any status"} ${row.durationMinutes || ""}`,
      },
      {
        key: "recipientMode",
        header: "RECIPIENT",
        sortable: true,
        filterRender: (
          <select
            className="select"
            value={filters.recipientMode}
            onChange={(e) => onFilterChange("recipientMode", e.target.value)}
          >
            <option value="">All</option>
            {RECIPIENT_MODES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ),
        render: (row) => (
          <div style={{ display: "grid", gap: 2 }}>
            <span>
              {RECIPIENT_MODES.find((x) => x.value === row.recipientMode)?.label ||
                row.recipientMode}
            </span>
            <span className="text-soft">{fmtRecipient(row)}</span>
          </div>
        ),
        getSearchText: (row) => `${row.recipientMode} ${fmtRecipient(row)}`,
      },
      {
        key: "channels",
        header: "CHANNELS",
        filterRender: (
          <select
            className="select"
            value={filters.channels}
            onChange={(e) => onFilterChange("channels", e.target.value)}
          >
            <option value="">All</option>
            <option value="in_app">In-App</option>
            <option value="email">Email</option>
          </select>
        ),
        render: (row) => fmtChannels(row.channels),
        getSearchText: (row) => fmtChannels(row.channels),
      },
      {
        key: "isActive",
        header: "STATUS",
        sortable: true,
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
        render: (row) => fmtStatus(row),
        getSearchText: (row) => (row.isActive ? "Active" : "Inactive"),
      },
      {
        key: "edit",
        header: "ACTIONS",
        width: 210,
        render: (row) => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => startEditing(row)}
            >
              Edit
            </button>

            {row.isActive ? (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setActive(row, false)}
              >
                Deactivate
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setActive(row, true)}
              >
                Reactivate
              </button>
            )}
          </div>
        ),
      },
    ],
    [events, filters, modules]
  );

  return (
    <div className="page-shell-wide section-stack">
      <div className="card">
        <div className="page-header">
          <div className="page-header-title-wrap">
            <h1 className="page-title">Admin – Notification Rules</h1>
            <p className="page-subtitle">
              Configure when CAP should create in-app/email notification work items.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/platform/events" className="btn btn-secondary">
              Event Catalog
            </Link>
            <Link href="/admin/platform/notification-rules/evaluate" className="btn btn-secondary">
              Rule Evaluation
            </Link>
            <Link href="/admin/platform/notification-rules/runs" className="btn btn-secondary">
              Rule Run History
            </Link>
            <Link href="/admin" className="btn btn-secondary">
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <form className="card section-stack" onSubmit={submitRule}>
        <div className="section-card-header">
          <div>
            <h2 style={{ margin: 0 }}>
              {editingId ? "Edit Notification Rule" : "Add Notification Rule"}
            </h2>
            <div className="text-soft">
              Event-based and status-duration rules can be narrowed with optional conditions.
            </div>
          </div>

          {editingId ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label">Rule Name *</label>
            <input
              className="input"
              value={form.ruleName}
              onChange={(e) => setFormValue("ruleName", e.target.value)}
              placeholder="PO to Art over 24 hours"
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Module *</label>
            <select
              className="select"
              value={form.module}
              onChange={(e) => {
                const nextModule = e.target.value;
                const firstEvent = events.find((ev) => ev.module === nextModule);

                setForm((prev) => ({
                  ...prev,
                  module: nextModule,
                  eventType: firstEvent?.eventType || "",
                  workflowStatusId:
                    prev.triggerType === "status_duration" ||
                    isWorkflowStatusEvent(firstEvent?.eventType || "")
                      ? prev.workflowStatusId
                      : "",
                }));
              }}
              disabled={saving}
            >
              <option value="">Select module...</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Event Type *</label>
            <select
              className="select"
              value={form.eventType}
              onChange={(e) => {
                const nextEventType = e.target.value;

                setForm((prev) => ({
                  ...prev,
                  eventType: nextEventType,
                  workflowStatusId:
                    prev.triggerType === "status_duration" ||
                    isWorkflowStatusEvent(nextEventType)
                      ? prev.workflowStatusId
                      : "",
                }));
              }}
              disabled={saving}
            >
              <option value="">Select event...</option>
              {filteredEventOptions.map((event) => (
                <option key={event.id} value={event.eventType}>
                  {event.eventLabel || event.eventType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Trigger Type *</label>
            <select
              className="select"
              value={form.triggerType}
              onChange={(e) => {
                const nextTriggerType = e.target.value;

                setForm((prev) => ({
                  ...prev,
                  triggerType: nextTriggerType,
                  durationMinutes:
                    nextTriggerType === "status_duration"
                      ? prev.durationMinutes || "1440"
                      : "",
                  workflowStatusId:
                    nextTriggerType === "status_duration" ||
                    isWorkflowStatusEvent(prev.eventType)
                      ? prev.workflowStatusId
                      : "",
                }));
              }}
              disabled={saving}
            >
              {TRIGGER_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {shouldShowWorkflowStatus(form) ? (
            <div>
              <label className="field-label">
                Workflow Status{isWorkflowStatusRequired(form) ? " *" : ""}
              </label>
              <select
                className="select"
                value={form.workflowStatusId}
                onChange={(e) => setFormValue("workflowStatusId", e.target.value)}
                disabled={saving}
              >
                <option value="">
                  {isWorkflowStatusRequired(form)
                    ? "Select status..."
                    : "Any Workflow status"}
                </option>
                {statuses.map((status) => (
                  <option key={status.id} value={String(status.id)}>
                    {status.label}
                  </option>
                ))}
              </select>

              {!isWorkflowStatusRequired(form) ? (
                <div className="field-help">
                  Optional for event-based status rules. Leave blank to match any Workflow status.
                </div>
              ) : null}
            </div>
          ) : null}

          {form.triggerType === "status_duration" ? (
            <div>
              <label className="field-label">Duration Minutes *</label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) => setFormValue("durationMinutes", e.target.value)}
                disabled={saving}
              />
              <div className="field-help">24 hours = 1440 minutes.</div>
            </div>
          ) : null}

          <div>
            <label className="field-label">Task Type</label>
            <input
              className="input"
              value={form.taskType}
              onChange={(e) => setFormValue("taskType", e.target.value)}
              placeholder="Optional"
              disabled={saving}
            />
          </div>

          <div>
            <label className="field-label">Recipient Mode *</label>
            <select
              className="select"
              value={form.recipientMode}
              onChange={(e) => setFormValue("recipientMode", e.target.value)}
              disabled={saving}
            >
              {RECIPIENT_MODES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {form.recipientMode === "specific_user" ? (
            <div>
              <label className="field-label">Specific User *</label>
              <select
                className="select"
                value={form.recipientUserId}
                onChange={(e) => setFormValue("recipientUserId", e.target.value)}
                disabled={saving}
              >
                <option value="">Select user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || user.username}
                    {user.email ? ` — ${user.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {form.recipientMode === "role" ? (
            <div>
              <label className="field-label">Role *</label>
              <select
                className="select"
                value={form.recipientRole}
                onChange={(e) => setFormValue("recipientRole", e.target.value)}
                disabled={saving}
              >
                <option value="">Select role...</option>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {form.recipientMode === "department" ? (
            <div>
              <label className="field-label">Department *</label>
              <select
                className="select"
                value={form.recipientDepartment}
                onChange={(e) => setFormValue("recipientDepartment", e.target.value)}
                disabled={saving}
              >
                <option value="">Select department...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="field-label">Priority Mode</label>
            <select
              className="select"
              value={form.priorityMode}
              onChange={(e) => setFormValue("priorityMode", e.target.value)}
              disabled={saving}
            >
              {PRIORITY_MODES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Default Priority</label>
            <select
              className="select"
              value={form.defaultPriority}
              onChange={(e) => setFormValue("defaultPriority", e.target.value)}
              disabled={saving}
            >
              {PRIORITIES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Active</label>
            <select
              className="select"
              value={form.isActive ? "true" : "false"}
              onChange={(e) => setFormValue("isActive", e.target.value === "true")}
              disabled={saving}
            >
              <option value="false">Inactive</option>
              <option value="true">Active</option>
            </select>
          </div>

          <div>
            <label className="field-label">Channels *</label>
            <div className="muted-box" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.channels.includes("in_app")}
                  onChange={(e) => onChannelChange("in_app", e.target.checked)}
                  disabled={saving}
                />
                In-App
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.channels.includes("email")}
                  onChange={(e) => onChannelChange("email", e.target.checked)}
                  disabled={saving}
                />
                Email
              </label>
            </div>
          </div>

          {form.recipientMode === "static_email" ||
          form.recipientMode === "static_email_list" ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">Static Recipient Emails *</label>
              <textarea
                className="textarea"
                rows={3}
                value={form.recipientStaticEmails}
                onChange={(e) => setFormValue("recipientStaticEmails", e.target.value)}
                placeholder={"artmanager@capamerica.com\nworkflowalerts@capamerica.com"}
                disabled={saving}
              />
              <div className="field-help">
                Separate emails with commas, semicolons, or new lines.
              </div>
            </div>
          ) : null}

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">CC Static Emails</label>
            <textarea
              className="textarea"
              rows={2}
              value={form.ccStaticEmails}
              onChange={(e) => setFormValue("ccStaticEmails", e.target.value)}
              placeholder="Optional"
              disabled={saving}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">BCC Static Emails</label>
            <textarea
              className="textarea"
              rows={2}
              value={form.bccStaticEmails}
              onChange={(e) => setFormValue("bccStaticEmails", e.target.value)}
              placeholder="Optional"
              disabled={saving}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <NotificationRuleConditionEditor
              value={form.conditionJson}
              onChange={(next) => setFormValue("conditionJson", next)}
              disabled={saving}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <TemplateVariableReference />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Title Template</label>
            <input
              className="input"
              value={form.titleTemplate}
              onChange={(e) => setFormValue("titleTemplate", e.target.value)}
              placeholder="Workflow {{requestNumber}} {{fieldLabel}} changed"
              disabled={saving}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Message Template</label>
            <textarea
              className="textarea"
              rows={4}
              value={form.messageTemplate}
              onChange={(e) => setFormValue("messageTemplate", e.target.value)}
              placeholder="{{actorName}} changed Workflow {{requestNumber}} from {{previousValue}} to {{newValue}}."
              disabled={saving}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
                ? "Save Notification Rule"
                : "Add Notification Rule"}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={resetForm}
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
          emptyText="No notification rules found."
          csvFilename="platform_notification_rules.csv"
          rowToCsv={(row) => ({
            Rule: row.ruleName,
            Module: row.module,
            Event: row.eventType,
            Trigger: row.triggerType,
            "Workflow Status": row.workflowStatusLabel || "Any status",
            "Duration Minutes": row.durationMinutes || "",
            "Recipient Mode": row.recipientMode,
            Recipient: fmtRecipient(row),
            Channels: fmtChannels(row.channels),
            Active: row.isActive ? "Active" : "Inactive",
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
                onClick={loadAll}
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