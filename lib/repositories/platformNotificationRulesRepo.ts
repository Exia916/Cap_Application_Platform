import { db } from "@/lib/db";

export type NotificationTriggerType =
  | "event_based"
  | "status_duration"
  | "due_date"
  | "aging";

export type NotificationRecipientMode =
  | "task_assignee"
  | "source_created_by"
  | "workflow_digitizer"
  | "workflow_designer"
  | "workflow_bin_user"
  | "specific_user"
  | "role"
  | "department"
  | "static_email"
  | "static_email_list";

export type NotificationPriorityMode =
  | "definition_default"
  | "rule_default"
  | "source_priority";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "email";

export type PlatformNotificationRuleRow = {
  id: string;

  ruleName: string;
  module: string;
  eventType: string;
  eventLabel: string | null;

  triggerType: NotificationTriggerType;

  workflowStatusId: number | null;
  workflowStatusCode: string | null;
  workflowStatusLabel: string | null;

  taskType: string | null;
  durationMinutes: number | null;

  recipientMode: NotificationRecipientMode;
  recipientUserId: string | null;
  recipientUserName: string | null;
  recipientDisplayName: string | null;
  recipientRole: string | null;
  recipientDepartment: string | null;

  recipientStaticEmails: string[];
  ccStaticEmails: string[];
  bccStaticEmails: string[];

  priorityMode: NotificationPriorityMode;
  defaultPriority: NotificationPriority;

  titleTemplate: string | null;
  messageTemplate: string | null;

  channels: NotificationChannel[];

  conditionJson: Record<string, any>;
  isActive: boolean;

  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type ListPlatformNotificationRulesArgs = {
  q?: string | null;
  module?: string | null;
  eventType?: string | null;
  triggerType?: string | null;
  recipientMode?: string | null;
  activeOnly?: boolean;
};

export type UpsertPlatformNotificationRuleInput = {
  id?: string;

  ruleName: string;
  module: string;
  eventType: string;
  triggerType: NotificationTriggerType;

  workflowStatusId?: number | null;
  taskType?: string | null;
  durationMinutes?: number | null;

  recipientMode: NotificationRecipientMode;
  recipientUserId?: string | null;
  recipientRole?: string | null;
  recipientDepartment?: string | null;

  recipientStaticEmails?: string[] | null;
  ccStaticEmails?: string[] | null;
  bccStaticEmails?: string[] | null;

  priorityMode?: NotificationPriorityMode | null;
  defaultPriority?: NotificationPriority | null;

  titleTemplate?: string | null;
  messageTemplate?: string | null;

  channels?: NotificationChannel[] | null;
  conditionJson?: Record<string, any> | null;

  isActive?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
};

const TRIGGER_TYPES = new Set<NotificationTriggerType>([
  "event_based",
  "status_duration",
  "due_date",
  "aging",
]);

const IMPLEMENTED_TRIGGER_TYPES = new Set<NotificationTriggerType>([
  "event_based",
  "status_duration",
]);

const RECIPIENT_MODES = new Set<NotificationRecipientMode>([
  "task_assignee",
  "source_created_by",
  "workflow_digitizer",
  "workflow_designer",
  "workflow_bin_user",
  "specific_user",
  "role",
  "department",
  "static_email",
  "static_email_list",
]);

const PRIORITY_MODES = new Set<NotificationPriorityMode>([
  "definition_default",
  "rule_default",
  "source_priority",
]);

const PRIORITIES = new Set<NotificationPriority>([
  "low",
  "normal",
  "high",
  "urgent",
]);

const CHANNELS = new Set<NotificationChannel>(["in_app", "email"]);

function selectSql() {
  return `
    SELECT
      r.id::text AS "id",

      r.rule_name AS "ruleName",
      r.module,
      r.event_type AS "eventType",
      et.event_label AS "eventLabel",

      r.trigger_type AS "triggerType",

      r.workflow_status_id AS "workflowStatusId",
      ws.code AS "workflowStatusCode",
      ws.label AS "workflowStatusLabel",

      r.task_type AS "taskType",
      r.duration_minutes AS "durationMinutes",

      r.recipient_mode AS "recipientMode",
      r.recipient_user_id::text AS "recipientUserId",
      u.username AS "recipientUserName",
      u.display_name AS "recipientDisplayName",
      r.recipient_role AS "recipientRole",
      r.recipient_department AS "recipientDepartment",

      COALESCE(r.recipient_static_emails, ARRAY[]::text[]) AS "recipientStaticEmails",
      COALESCE(r.cc_static_emails, ARRAY[]::text[]) AS "ccStaticEmails",
      COALESCE(r.bcc_static_emails, ARRAY[]::text[]) AS "bccStaticEmails",

      r.priority_mode AS "priorityMode",
      r.default_priority AS "defaultPriority",

      r.title_template AS "titleTemplate",
      r.message_template AS "messageTemplate",

      COALESCE(r.channels, ARRAY[]::text[]) AS "channels",

      COALESCE(r.condition_json, '{}'::jsonb) AS "conditionJson",
      r.is_active AS "isActive",

      r.created_at AS "createdAt",
      r.created_by::text AS "createdBy",
      r.updated_at AS "updatedAt",
      r.updated_by::text AS "updatedBy"
    FROM public.platform_notification_rules r
    LEFT JOIN public.platform_event_types et
      ON et.module = r.module
     AND et.event_type = r.event_type
    LEFT JOIN public.design_workflow_statuses ws
      ON ws.id = r.workflow_status_id
    LEFT JOIN public.users u
      ON u.id = r.recipient_user_id
  `;
}

function cleanRequiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function cleanNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeModule(value: unknown): string {
  return cleanRequiredText(value, "Module").toLowerCase();
}

function normalizeEventType(value: unknown): string {
  return cleanRequiredText(value, "Event Type").toLowerCase();
}

function normalizeTriggerType(value: unknown): NotificationTriggerType {
  const triggerType = String(value ?? "").trim() as NotificationTriggerType;

  if (!TRIGGER_TYPES.has(triggerType)) {
    throw new Error("Trigger Type is invalid.");
  }

  if (!IMPLEMENTED_TRIGGER_TYPES.has(triggerType)) {
    throw new Error("Only event_based and status_duration trigger types are enabled in this phase.");
  }

  return triggerType;
}

function normalizeRecipientMode(value: unknown): NotificationRecipientMode {
  const mode = String(value ?? "").trim() as NotificationRecipientMode;

  if (!RECIPIENT_MODES.has(mode)) {
    throw new Error("Recipient Mode is invalid.");
  }

  return mode;
}

function normalizePriorityMode(value: unknown): NotificationPriorityMode {
  const mode = String(value ?? "definition_default").trim() as NotificationPriorityMode;

  if (!PRIORITY_MODES.has(mode)) {
    throw new Error("Priority Mode is invalid.");
  }

  return mode;
}

function normalizePriority(value: unknown): NotificationPriority {
  const priority = String(value ?? "normal").trim() as NotificationPriority;

  if (!PRIORITIES.has(priority)) {
    throw new Error("Default Priority is invalid.");
  }

  return priority;
}

function normalizeChannels(value: unknown): NotificationChannel[] {
  const raw = Array.isArray(value) ? value : ["in_app"];
  const out: NotificationChannel[] = [];

  for (const item of raw) {
    const channel = String(item ?? "").trim() as NotificationChannel;
    if (!CHANNELS.has(channel)) continue;
    if (!out.includes(channel)) out.push(channel);
  }

  return out.length ? out : ["in_app"];
}

function normalizeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of value) {
    const email = String(item ?? "").trim().toLowerCase();
    if (!email) continue;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }

    if (!seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }

  return out;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  return Math.trunc(n);
}

function normalizeConditionJson(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function normalizeInput(input: UpsertPlatformNotificationRuleInput) {
  const ruleName = cleanRequiredText(input.ruleName, "Rule Name");
  const module = normalizeModule(input.module);
  const eventType = normalizeEventType(input.eventType);
  const triggerType = normalizeTriggerType(input.triggerType);

  const workflowStatusId = normalizeNumber(input.workflowStatusId);
  const durationMinutes = normalizeNumber(input.durationMinutes);

  const recipientMode = normalizeRecipientMode(input.recipientMode);

  let recipientUserId = cleanNullableText(input.recipientUserId);
  let recipientRole = cleanNullableText(input.recipientRole);
  let recipientDepartment = cleanNullableText(input.recipientDepartment);

  const recipientStaticEmails = normalizeEmails(input.recipientStaticEmails);
  const ccStaticEmails = normalizeEmails(input.ccStaticEmails);
  const bccStaticEmails = normalizeEmails(input.bccStaticEmails);

  const priorityMode = normalizePriorityMode(input.priorityMode);
  const defaultPriority = normalizePriority(input.defaultPriority);
  const channels = normalizeChannels(input.channels);

  if (triggerType === "status_duration") {
    if (!workflowStatusId) {
      throw new Error("Workflow Status is required for status-duration rules.");
    }

    if (!durationMinutes || durationMinutes <= 0) {
      throw new Error("Duration Minutes must be greater than zero for status-duration rules.");
    }
  }

  if (triggerType === "event_based") {
    if (input.durationMinutes === null || input.durationMinutes === undefined) {
      // Leave null.
    }
  }

  if (recipientMode === "specific_user") {
    if (!recipientUserId) {
      throw new Error("Specific User is required for this recipient mode.");
    }
  } else {
    recipientUserId = null;
  }

  if (recipientMode === "role") {
    if (!recipientRole) {
      throw new Error("Role is required for this recipient mode.");
    }
  } else {
    recipientRole = null;
  }

  if (recipientMode === "department") {
    if (!recipientDepartment) {
      throw new Error("Department is required for this recipient mode.");
    }
  } else {
    recipientDepartment = null;
  }

  if (recipientMode === "static_email" || recipientMode === "static_email_list") {
    if (recipientStaticEmails.length === 0) {
      throw new Error("At least one static recipient email is required.");
    }
  }

  return {
    ruleName,
    module,
    eventType,
    triggerType,

    workflowStatusId,
    taskType: cleanNullableText(input.taskType),
    durationMinutes,

    recipientMode,
    recipientUserId,
    recipientRole,
    recipientDepartment,

    recipientStaticEmails,
    ccStaticEmails,
    bccStaticEmails,

    priorityMode,
    defaultPriority,

    titleTemplate: cleanNullableText(input.titleTemplate),
    messageTemplate: cleanNullableText(input.messageTemplate),

    channels,
    conditionJson: normalizeConditionJson(input.conditionJson),
    isActive: !!input.isActive,
  };
}

export async function listPlatformNotificationRules(
  args: ListPlatformNotificationRulesArgs = {}
): Promise<PlatformNotificationRuleRow[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (args.activeOnly === true) {
    where.push("r.is_active = true");
  }

  const module = String(args.module ?? "").trim();
  if (module) {
    params.push(module.toLowerCase());
    where.push(`r.module = $${params.length}`);
  }

  const eventType = String(args.eventType ?? "").trim();
  if (eventType) {
    params.push(eventType.toLowerCase());
    where.push(`r.event_type = $${params.length}`);
  }

  const triggerType = String(args.triggerType ?? "").trim();
  if (triggerType) {
    params.push(triggerType);
    where.push(`r.trigger_type = $${params.length}`);
  }

  const recipientMode = String(args.recipientMode ?? "").trim();
  if (recipientMode) {
    params.push(recipientMode);
    where.push(`r.recipient_mode = $${params.length}`);
  }

  const q = String(args.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;

    where.push(`
      (
        r.rule_name ILIKE ${p}
        OR r.module ILIKE ${p}
        OR r.event_type ILIKE ${p}
        OR COALESCE(et.event_label, '') ILIKE ${p}
        OR r.trigger_type ILIKE ${p}
        OR r.recipient_mode ILIKE ${p}
        OR COALESCE(r.recipient_role, '') ILIKE ${p}
        OR COALESCE(r.recipient_department, '') ILIKE ${p}
        OR COALESCE(r.title_template, '') ILIKE ${p}
        OR COALESCE(r.message_template, '') ILIKE ${p}
      )
    `);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await db.query<PlatformNotificationRuleRow>(
    `
    ${selectSql()}
    ${whereSql}
    ORDER BY
      r.module ASC,
      r.event_type ASC,
      r.trigger_type ASC,
      r.rule_name ASC,
      r.updated_at DESC
    `,
    params
  );

  return rows;
}

export async function getPlatformNotificationRuleById(
  id: string
): Promise<PlatformNotificationRuleRow | null> {
  const { rows } = await db.query<PlatformNotificationRuleRow>(
    `
    ${selectSql()}
    WHERE r.id = $1::uuid
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function createPlatformNotificationRule(
  input: UpsertPlatformNotificationRuleInput
): Promise<PlatformNotificationRuleRow> {
  const n = normalizeInput(input);

  const { rows } = await db.query<PlatformNotificationRuleRow>(
    `
    INSERT INTO public.platform_notification_rules (
      rule_name,
      module,
      event_type,
      trigger_type,

      workflow_status_id,
      task_type,
      duration_minutes,

      recipient_mode,
      recipient_user_id,
      recipient_role,
      recipient_department,

      recipient_static_emails,
      cc_static_emails,
      bcc_static_emails,

      priority_mode,
      default_priority,

      title_template,
      message_template,

      channels,
      condition_json,
      is_active,

      created_by,
      updated_by
    )
    VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,
      $8,$9,$10,$11,
      $12::text[],$13::text[],$14::text[],
      $15,$16,
      $17,$18,
      $19::text[],$20::jsonb,$21,
      $22,$23
    )
    RETURNING id::text
    `,
    [
      n.ruleName,
      n.module,
      n.eventType,
      n.triggerType,

      n.workflowStatusId,
      n.taskType,
      n.durationMinutes,

      n.recipientMode,
      n.recipientUserId,
      n.recipientRole,
      n.recipientDepartment,

      n.recipientStaticEmails,
      n.ccStaticEmails,
      n.bccStaticEmails,

      n.priorityMode,
      n.defaultPriority,

      n.titleTemplate,
      n.messageTemplate,

      n.channels,
      JSON.stringify(n.conditionJson),
      n.isActive,

      input.createdBy ?? null,
      input.updatedBy ?? input.createdBy ?? null,
    ]
  );

  return (await getPlatformNotificationRuleById(rows[0]!.id))!;
}

export async function updatePlatformNotificationRule(
  input: UpsertPlatformNotificationRuleInput & { id: string }
): Promise<PlatformNotificationRuleRow | null> {
  const n = normalizeInput(input);

  const { rows } = await db.query<{ id: string }>(
    `
    UPDATE public.platform_notification_rules
    SET
      rule_name = $2,
      module = $3,
      event_type = $4,
      trigger_type = $5,

      workflow_status_id = $6,
      task_type = $7,
      duration_minutes = $8,

      recipient_mode = $9,
      recipient_user_id = $10,
      recipient_role = $11,
      recipient_department = $12,

      recipient_static_emails = $13::text[],
      cc_static_emails = $14::text[],
      bcc_static_emails = $15::text[],

      priority_mode = $16,
      default_priority = $17,

      title_template = $18,
      message_template = $19,

      channels = $20::text[],
      condition_json = $21::jsonb,
      is_active = $22,

      updated_at = NOW(),
      updated_by = $23
    WHERE id = $1::uuid
    RETURNING id::text
    `,
    [
      input.id,

      n.ruleName,
      n.module,
      n.eventType,
      n.triggerType,

      n.workflowStatusId,
      n.taskType,
      n.durationMinutes,

      n.recipientMode,
      n.recipientUserId,
      n.recipientRole,
      n.recipientDepartment,

      n.recipientStaticEmails,
      n.ccStaticEmails,
      n.bccStaticEmails,

      n.priorityMode,
      n.defaultPriority,

      n.titleTemplate,
      n.messageTemplate,

      n.channels,
      JSON.stringify(n.conditionJson),
      n.isActive,

      input.updatedBy ?? null,
    ]
  );

  if (!rows[0]) return null;

  return getPlatformNotificationRuleById(rows[0].id);
}

export async function setPlatformNotificationRuleActive(input: {
  id: string;
  isActive: boolean;
  updatedBy?: string | null;
}): Promise<PlatformNotificationRuleRow | null> {
  const { rows } = await db.query<{ id: string }>(
    `
    UPDATE public.platform_notification_rules
    SET
      is_active = $2,
      updated_at = NOW(),
      updated_by = $3
    WHERE id = $1::uuid
    RETURNING id::text
    `,
    [input.id, input.isActive, input.updatedBy ?? null]
  );

  if (!rows[0]) return null;

  return getPlatformNotificationRuleById(rows[0].id);
}