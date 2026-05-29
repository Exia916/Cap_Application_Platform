import { db } from "@/lib/db";
import {
  createNotificationForUser,
  type CreateNotificationForUserResult,
} from "@/lib/services/notificationService";
import { getNotificationDefinitionByEventType } from "@/lib/repositories/notificationDefinitionsRepo";
import type {
  NotificationChannel,
  NotificationPriority,
} from "@/lib/repositories/notificationEventsRepo";
import { evaluateNotificationRuleConditions } from "@/lib/services/notificationRuleConditionService";

type Queryable = {
  query: <T = any>(
    sql: string,
    params?: any[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
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
  recipientRole: string | null;
  recipientDepartment: string | null;

  recipientStaticEmails: string[];
  ccStaticEmails: string[];
  bccStaticEmails: string[];

  priorityMode: string;
  defaultPriority: NotificationPriority;

  titleTemplate: string | null;
  messageTemplate: string | null;

  channels: NotificationChannel[];
  conditionJson: Record<string, any> | null;
};

type WorkflowCandidateRow = {
  id: string;
  requestNumber: string;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  poNumber: string | null;
  tapeName: string | null;

  dateRequestCreated: string | null;
  dueDate: string | null;
  customerName: string | null;
  customerCode: string | null;
  binCode: string | null;

  createdByUserId: string | null;
  createdByName: string | null;

  digitizerUserId: string | null;
  digitizerName: string | null;

  designerUserId: string | null;
  designerName: string | null;

  statusId: number;
  statusCode: string;
  statusLabel: string;

  rush: boolean;

  statusEnteredAt: string;
  elapsedMinutes: number;
};

type UserRecipient = {
  kind: "user";
  userId: string;
  label: string | null;
  email: string | null;
};

type StaticEmailRecipient = {
  kind: "static_email";
  email: string;
  label: string | null;
};

type Recipient = UserRecipient | StaticEmailRecipient;

export type EvaluateNotificationRulesInput = {
  dryRun?: boolean;
  limitPerRule?: number;
  ruleId?: string | null;
  now?: Date;
};

export type EvaluateNotificationRulesResult = {
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  lockAcquired: boolean;

  evaluatedRules: number;
  matchedRecords: number;
  candidateRecipients: number;

  createdEvents: number;
  createdDeliveries: number;
  createdRuleRuns: number;

  skippedAlreadyRun: number;
  skippedNoRecipients: number;
  skippedInvalidRecipients: number;
  skippedConditions: number;
  skippedDryRun: number;

  errors: Array<{
    ruleId?: string;
    ruleName?: string;
    entityId?: string;
    recipient?: string;
    message: string;
  }>;

  details: Array<{
    ruleId: string;
    ruleName: string;
    entityId: string;
    requestNumber: string;
    workflowStatusLabel: string;
    statusEnteredAt: string;
    elapsedMinutes: number;
    recipient: string;
    action: "would_create" | "created" | "skipped_duplicate" | "skipped" | "error";
    message?: string;
  }>;
};

const LOCK_KEY = "cap.platform.notification_rules.evaluate";
const ENTITY_TYPE = "design_workflow_request";

function normalizeLimit(value: unknown, fallback = 100, max = 500): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function toDate(value: Date | undefined): Date {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
}

function valueForTemplate(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function renderTemplate(template: string | null | undefined, context: Record<string, unknown>) {
  if (!template) return null;

  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    return valueForTemplate(context[key]);
  });
}

function isEmailEngineEnabled() {
  return String(process.env.CAP_EMAIL_NOTIFICATIONS_ENABLED ?? "")
    .trim()
    .toLowerCase() === "true";
}

function uniqueChannels(channels: NotificationChannel[] | null | undefined): NotificationChannel[] {
  const allowed = new Set<NotificationChannel>(["in_app", "email"]);
  const out: NotificationChannel[] = [];

  for (const channel of channels || []) {
    if (!allowed.has(channel)) continue;
    if (!out.includes(channel)) out.push(channel);
  }

  return out.length ? out : ["in_app"];
}

function uniqueRecipients(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];

  for (const recipient of recipients) {
    const key =
      recipient.kind === "user"
        ? `user:${recipient.userId}`
        : `static:${recipient.email.toLowerCase()}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(recipient);
  }

  return out;
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

function cleanEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function displaySalesOrder(candidate: WorkflowCandidateRow) {
  return (
    candidate.salesOrderDisplay ||
    candidate.salesOrderBase ||
    candidate.salesOrderNumber ||
    ""
  );
}

function buildTemplateContext(
  rule: NotificationRuleRow,
  candidate: WorkflowCandidateRow
): Record<string, unknown> {
  const durationHours =
    rule.durationMinutes && rule.durationMinutes > 0
      ? Math.round((rule.durationMinutes / 60) * 100) / 100
      : "";

  return {
    ruleId: rule.id,
    ruleName: rule.ruleName,

    module: rule.module,
    eventType: rule.eventType,
    eventLabel: rule.eventLabel || rule.eventType,

    requestId: candidate.id,
    requestNumber: candidate.requestNumber,
    sourceRecordLabel: candidate.requestNumber,

    salesOrder: displaySalesOrder(candidate),
    salesOrderNumber: candidate.salesOrderNumber || "",
    salesOrderBase: candidate.salesOrderBase || "",
    salesOrderDisplay: candidate.salesOrderDisplay || "",

    poNumber: candidate.poNumber || "",
    tapeName: candidate.tapeName || "",

    customerName: candidate.customerName || "",
    customerCode: candidate.customerCode || "",

    workflowStatusId: candidate.statusId,
    workflowStatusCode: candidate.statusCode,
    workflowStatusLabel: candidate.statusLabel,

    statusEnteredAt: candidate.statusEnteredAt,
    elapsedMinutes: candidate.elapsedMinutes,

    durationMinutes: rule.durationMinutes || "",
    durationHours,

    createdByName: candidate.createdByName || "",
    digitizerName: candidate.digitizerName || "",
    designerName: candidate.designerName || "",
    binCode: candidate.binCode || "",

    dueDate: candidate.dueDate || "",
    rush: candidate.rush,
  };
}

async function acquireLock(client: Queryable): Promise<boolean> {
  const { rows } = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked`,
    [LOCK_KEY]
  );

  return !!rows[0]?.locked;
}

async function releaseLock(client: Queryable): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock(hashtext($1)::bigint)`, [LOCK_KEY]);
}

async function listActiveStatusDurationRules(
  args: {
    ruleId?: string | null;
  },
  queryable: Queryable = db
): Promise<NotificationRuleRow[]> {
  const params: any[] = [];
  const where: string[] = [
    `r.is_active = true`,
    `r.module = 'design_workflow'`,
    `r.trigger_type = 'status_duration'`,
    `r.event_type = 'workflow.status.duration_exceeded'`,
    `r.workflow_status_id IS NOT NULL`,
    `r.duration_minutes IS NOT NULL`,
    `r.duration_minutes > 0`,
  ];

  if (args.ruleId) {
    params.push(args.ruleId);
    where.push(`r.id = $${params.length}::uuid`);
  }

  const { rows } = await queryable.query<NotificationRuleRow>(
    `
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
      COALESCE(r.condition_json, '{}'::jsonb) AS "conditionJson"
    FROM public.platform_notification_rules r
    LEFT JOIN public.platform_event_types et
      ON et.module = r.module
     AND et.event_type = r.event_type
    LEFT JOIN public.design_workflow_statuses ws
      ON ws.id = r.workflow_status_id
    WHERE ${where.join(" AND ")}
    ORDER BY r.updated_at ASC, r.rule_name ASC
    `,
    params
  );

  return rows;
}

async function listWorkflowStatusDurationCandidates(
  rule: NotificationRuleRow,
  args: {
    now: Date;
    limit: number;
  },
  queryable: Queryable = db
): Promise<WorkflowCandidateRow[]> {
  if (!rule.workflowStatusId || !rule.durationMinutes) return [];

  const { rows } = await queryable.query<WorkflowCandidateRow>(
    `
    SELECT
      req.id::text AS "id",
      req.request_number AS "requestNumber",
      req.sales_order_number AS "salesOrderNumber",
      req.sales_order_base AS "salesOrderBase",
      req.sales_order_display AS "salesOrderDisplay",
      req.po_number AS "poNumber",
      req.tape_name AS "tapeName",

      req.date_request_created AS "dateRequestCreated",
      req.due_date::text AS "dueDate",
      req.customer_name AS "customerName",
      req.customer_code AS "customerCode",
      req.bin_code AS "binCode",

      req.created_by_user_id AS "createdByUserId",
      req.created_by_name AS "createdByName",

      req.digitizer_user_id AS "digitizerUserId",
      req.digitizer_name AS "digitizerName",

      req.designer_user_id AS "designerUserId",
      req.designer_name AS "designerName",

      req.status_id AS "statusId",
      ws.code AS "statusCode",
      ws.label AS "statusLabel",

      COALESCE(req.rush, false) AS "rush",

      COALESCE(last_hist.changed_at, req.date_request_created, req.created_at) AS "statusEnteredAt",

      FLOOR(
        EXTRACT(
          EPOCH FROM (
            $3::timestamptz - COALESCE(last_hist.changed_at, req.date_request_created, req.created_at)
          )
        ) / 60
      )::int AS "elapsedMinutes"
    FROM public.design_workflow_requests req
    INNER JOIN public.design_workflow_statuses ws
      ON ws.id = req.status_id
    LEFT JOIN LATERAL (
      SELECT h.changed_at
      FROM public.design_workflow_status_history h
      WHERE h.request_id = req.id
        AND h.status_id = req.status_id
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT 1
    ) last_hist ON true
    WHERE req.status_id = $1
      AND COALESCE(req.is_voided, false) = false
      AND COALESCE(last_hist.changed_at, req.date_request_created, req.created_at)
            <= ($3::timestamptz - ($2::int * INTERVAL '1 minute'))
    ORDER BY
      COALESCE(last_hist.changed_at, req.date_request_created, req.created_at) ASC,
      req.request_number ASC
    LIMIT $4
    `,
    [rule.workflowStatusId, rule.durationMinutes, args.now, args.limit]
  );

  return rows;
}

async function getUserRecipientById(
  userId: string | null | undefined,
  queryable: Queryable = db
): Promise<UserRecipient | null> {
  if (!userId || !isUuid(userId)) return null;

  const { rows } = await queryable.query<{
    id: string;
    label: string | null;
    email: string | null;
  }>(
    `
    SELECT
      id::text AS id,
      COALESCE(display_name, username) AS label,
      email
    FROM public.users
    WHERE id = $1::uuid
      AND COALESCE(is_active, true) = true
    LIMIT 1
    `,
    [userId]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    kind: "user",
    userId: row.id,
    label: row.label,
    email: row.email,
  };
}

async function listUserRecipientsByRole(
  role: string | null,
  queryable: Queryable = db
): Promise<UserRecipient[]> {
  const value = String(role ?? "").trim();
  if (!value) return [];

  const { rows } = await queryable.query<{
    id: string;
    label: string | null;
    email: string | null;
  }>(
    `
    SELECT
      id::text AS id,
      COALESCE(display_name, username) AS label,
      email
    FROM public.users
    WHERE COALESCE(is_active, true) = true
      AND UPPER(role) = UPPER($1)
    ORDER BY display_name ASC NULLS LAST, username ASC
    LIMIT 250
    `,
    [value]
  );

  return rows.map((row) => ({
    kind: "user" as const,
    userId: row.id,
    label: row.label,
    email: row.email,
  }));
}

async function listUserRecipientsByDepartment(
  department: string | null,
  queryable: Queryable = db
): Promise<UserRecipient[]> {
  const value = String(department ?? "").trim();
  if (!value) return [];

  const { rows } = await queryable.query<{
    id: string;
    label: string | null;
    email: string | null;
  }>(
    `
    SELECT
      id::text AS id,
      COALESCE(display_name, username) AS label,
      email
    FROM public.users
    WHERE COALESCE(is_active, true) = true
      AND department ILIKE $1
    ORDER BY display_name ASC NULLS LAST, username ASC
    LIMIT 250
    `,
    [value]
  );

  return rows.map((row) => ({
    kind: "user" as const,
    userId: row.id,
    label: row.label,
    email: row.email,
  }));
}

async function getUserRecipientByBinCode(
  binCode: string | null,
  queryable: Queryable = db
): Promise<UserRecipient | null> {
  const value = String(binCode ?? "").trim();
  if (!value || value.toLowerCase() === "unspecified") return null;

  const { rows } = await queryable.query<{
    id: string;
    label: string | null;
    email: string | null;
  }>(
    `
    SELECT
      id::text AS id,
      COALESCE(display_name, username) AS label,
      email
    FROM public.users
    WHERE COALESCE(is_active, true) = true
      AND (
        display_name ILIKE $1
        OR username ILIKE $1
        OR CAST(employee_number AS text) = $2
      )
    ORDER BY display_name ASC NULLS LAST, username ASC
    LIMIT 1
    `,
    [value, value]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    kind: "user",
    userId: row.id,
    label: row.label,
    email: row.email,
  };
}

async function resolveRecipients(
  rule: NotificationRuleRow,
  candidate: WorkflowCandidateRow,
  queryable: Queryable = db
): Promise<Recipient[]> {
  switch (rule.recipientMode) {
    case "specific_user": {
      const recipient = await getUserRecipientById(rule.recipientUserId, queryable);
      return recipient ? [recipient] : [];
    }

    case "source_created_by": {
      const recipient = await getUserRecipientById(candidate.createdByUserId, queryable);
      return recipient ? [recipient] : [];
    }

    case "workflow_digitizer": {
      const recipient = await getUserRecipientById(candidate.digitizerUserId, queryable);
      return recipient ? [recipient] : [];
    }

    case "workflow_designer": {
      const recipient = await getUserRecipientById(candidate.designerUserId, queryable);
      return recipient ? [recipient] : [];
    }

    case "workflow_bin_user": {
      const recipient = await getUserRecipientByBinCode(candidate.binCode, queryable);
      return recipient ? [recipient] : [];
    }

    case "role":
      return listUserRecipientsByRole(rule.recipientRole, queryable);

    case "department":
      return listUserRecipientsByDepartment(rule.recipientDepartment, queryable);

    case "static_email":
    case "static_email_list": {
      return rule.recipientStaticEmails
        .map((email) => cleanEmail(email))
        .filter(Boolean)
        .map((email) => ({
          kind: "static_email" as const,
          email: email!,
          label: email!,
        }));
    }

    default:
      return [];
  }
}

async function hasRuleRun(input: {
  ruleId: string;
  entityType: string;
  entityId: string;
  workflowStatusId: number | null;
  statusEnteredAt: string | null;
  recipientUserId: string | null;
  recipientEmail: string | null;
}): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.platform_notification_rule_runs rr
      WHERE rr.rule_id = $1::uuid
        AND rr.entity_type = $2
        AND rr.entity_id = $3
        AND rr.trigger_type = 'status_duration'
        AND COALESCE(rr.workflow_status_id, -1) = COALESCE($4::int, -1)
        AND COALESCE(rr.recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE($5::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND lower(COALESCE(rr.recipient_email, '')) = lower(COALESCE($6, ''))
      LIMIT 1
    ) AS exists
    `,
    [
      input.ruleId,
      input.entityType,
      input.entityId,
      input.workflowStatusId,
      input.recipientUserId,
      input.recipientEmail,
    ]
  );

  return !!rows[0]?.exists;
}

async function insertRuleRun(input: {
  ruleId: string;
  notificationEventId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  triggerType: string;
  workflowStatusId: number | null;
  statusEnteredAt: string | null;
  recipientUserId: string | null;
  recipientEmail: string | null;
  metadata: Record<string, unknown>;
}): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.platform_notification_rule_runs (
      rule_id,
      notification_event_id,
      entity_type,
      entity_id,
      event_type,
      trigger_type,
      workflow_status_id,
      status_entered_at,
      recipient_user_id,
      recipient_email,
      metadata
    )
    VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::timestamptz,
      $9::uuid,
      $10,
      $11::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id::text
    `,
    [
      input.ruleId,
      input.notificationEventId,
      input.entityType,
      input.entityId,
      input.eventType,
      input.triggerType,
      input.workflowStatusId,
      input.statusEnteredAt,
      input.recipientUserId,
      input.recipientEmail,
      JSON.stringify(input.metadata || {}),
    ]
  );

  return !!rows[0];
}

async function createStaticEmailNotification(input: {
  rule: NotificationRuleRow;
  candidate: WorkflowCandidateRow;
  recipient: StaticEmailRecipient;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  payload: Record<string, unknown>;
}): Promise<{ eventId: string; deliveryCount: number }> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const eventRes = await client.query<{ id: string }>(
      `
      INSERT INTO public.notification_events (
        event_type,
        module,
        entity_type,
        entity_id,
        actor_user_id,
        target_user_id,
        title,
        message,
        priority,
        payload,
        notification_rule_id
      )
      VALUES (
        $1,$2,$3,$4,
        NULL,
        NULL,
        $5,$6,$7,$8::jsonb,
        $9::uuid
      )
      RETURNING id::text
      `,
      [
        input.rule.eventType,
        input.rule.module,
        ENTITY_TYPE,
        input.candidate.id,
        input.title,
        input.message,
        input.priority,
        JSON.stringify(input.payload),
        input.rule.id,
      ]
    );

    const eventId = eventRes.rows[0]!.id;

    const emailEnabled = isEmailEngineEnabled();
    const status = emailEnabled ? "pending" : "skipped";
    const errorMessage = emailEnabled
      ? null
      : "Email delivery engine is not enabled. Set CAP_EMAIL_NOTIFICATIONS_ENABLED=true before executing email rules.";

    const deliveryRes = await client.query(
      `
      INSERT INTO public.notification_deliveries (
        notification_event_id,
        recipient_user_id,
        channel,
        status,
        recipient_email,
        attempted_at,
        delivered_at,
        read_at,
        error_message,
        recipient_kind,
        recipient_label,
        attempt_count,
        max_attempts,
        next_attempt_at,
        skipped_reason
      )
      VALUES (
        $1::uuid,
        NULL,
        'email',
        $2,
        $3,
        NULL,
        NULL,
        NULL,
        $4,
        'static_email',
        $5,
        0,
        3,
        NULL,
        $4
      )
      `,
      [
        eventId,
        status,
        input.recipient.email,
        errorMessage,
        input.recipient.label ?? input.recipient.email,
      ]
    );

    await client.query("COMMIT");

    return {
      eventId,
      deliveryCount: deliveryRes.rowCount ?? 0,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createUserNotification(input: {
  rule: NotificationRuleRow;
  candidate: WorkflowCandidateRow;
  recipient: UserRecipient;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  payload: Record<string, unknown>;
}): Promise<{ eventId: string; deliveryCount: number; result: CreateNotificationForUserResult }> {
  const result = await createNotificationForUser({
    eventType: input.rule.eventType,
    module: input.rule.module,
    entityType: ENTITY_TYPE,
    entityId: input.candidate.id,
    actorUserId: null,
    targetUserId: input.recipient.userId,
    title: input.title,
    message: input.message,
    priority: input.priority,
    payload: input.payload,
    channels: input.channels,
  });

  await db.query(
    `
    UPDATE public.notification_events
    SET notification_rule_id = $2::uuid
    WHERE id = $1::uuid
    `,
    [result.event.id, input.rule.id]
  );

  return {
    eventId: result.event.id,
    deliveryCount: result.deliveries.length,
    result,
  };
}

function resolvePriority(
  rule: NotificationRuleRow,
  definitionPriority: NotificationPriority | null | undefined,
  candidate: WorkflowCandidateRow
): NotificationPriority {
  if (rule.priorityMode === "definition_default") {
    return definitionPriority || rule.defaultPriority || "normal";
  }

  if (rule.priorityMode === "source_priority") {
    return candidate.rush ? "urgent" : rule.defaultPriority || "normal";
  }

  return rule.defaultPriority || "normal";
}

export async function evaluateNotificationRules(
  input: EvaluateNotificationRulesInput = {}
): Promise<EvaluateNotificationRulesResult> {
  const dryRun = input.dryRun !== false;
  const now = toDate(input.now);
  const startedAt = new Date();

  const result: EvaluateNotificationRulesResult = {
    dryRun,
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    lockAcquired: false,

    evaluatedRules: 0,
    matchedRecords: 0,
    candidateRecipients: 0,

    createdEvents: 0,
    createdDeliveries: 0,
    createdRuleRuns: 0,

    skippedAlreadyRun: 0,
    skippedNoRecipients: 0,
    skippedInvalidRecipients: 0,
    skippedConditions: 0,
    skippedDryRun: 0,

    errors: [],
    details: [],
  };

  const client = await db.connect();

  try {
    const locked = await acquireLock(client);
    result.lockAcquired = locked;

    if (!locked) {
      result.finishedAt = new Date().toISOString();
      return result;
    }

    const limitPerRule = normalizeLimit(input.limitPerRule, 100, 500);
    const rules = await listActiveStatusDurationRules({ ruleId: input.ruleId }, client);

    result.evaluatedRules = rules.length;

    for (const rule of rules) {
      const definition = await getNotificationDefinitionByEventType(rule.eventType);

      if (definition && !definition.isActive) {
        continue;
      }

      const candidates = await listWorkflowStatusDurationCandidates(
        rule,
        {
          now,
          limit: limitPerRule,
        },
        client
      );

      result.matchedRecords += candidates.length;

      for (const candidate of candidates) {
        const conditionResult = evaluateNotificationRuleConditions(rule.conditionJson, {
          rush: candidate.rush,
          salesOrder: displaySalesOrder(candidate),
          customerName: candidate.customerName,
          dueDate: candidate.dueDate,

          digitizerUserId: candidate.digitizerUserId,
          digitizerName: candidate.digitizerName,

          designerUserId: candidate.designerUserId,
          designerName: candidate.designerName,

          binCode: candidate.binCode,
          now,
        });

        if (!conditionResult.passed) {
          result.skippedConditions += 1;

          result.details.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            entityId: candidate.id,
            requestNumber: candidate.requestNumber,
            workflowStatusLabel: candidate.statusLabel,
            statusEnteredAt: candidate.statusEnteredAt,
            elapsedMinutes: candidate.elapsedMinutes,
            recipient: rule.recipientMode,
            action: "skipped",
            message: `Condition not met: ${conditionResult.failedReasons.join("; ")}`,
          });

          continue;
        }

        let recipients: Recipient[] = [];

        try {
          recipients = uniqueRecipients(await resolveRecipients(rule, candidate, client));
        } catch (err: any) {
          result.errors.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            entityId: candidate.id,
            message: err?.message || "Failed to resolve recipients.",
          });
          continue;
        }

        if (!recipients.length) {
          result.skippedNoRecipients += 1;
          result.details.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            entityId: candidate.id,
            requestNumber: candidate.requestNumber,
            workflowStatusLabel: candidate.statusLabel,
            statusEnteredAt: candidate.statusEnteredAt,
            elapsedMinutes: candidate.elapsedMinutes,
            recipient: rule.recipientMode,
            action: "skipped",
            message: "No recipients resolved for this rule.",
          });
          continue;
        }

        for (const recipient of recipients) {
          result.candidateRecipients += 1;

          const recipientUserId = recipient.kind === "user" ? recipient.userId : null;
          const recipientEmail = recipient.kind === "static_email" ? recipient.email : null;

          const alreadyRun = await hasRuleRun({
            ruleId: rule.id,
            entityType: ENTITY_TYPE,
            entityId: candidate.id,
            workflowStatusId: candidate.statusId,
            statusEnteredAt: candidate.statusEnteredAt,
            recipientUserId,
            recipientEmail,
          });

          if (alreadyRun) {
            result.skippedAlreadyRun += 1;
            result.details.push({
              ruleId: rule.id,
              ruleName: rule.ruleName,
              entityId: candidate.id,
              requestNumber: candidate.requestNumber,
              workflowStatusLabel: candidate.statusLabel,
              statusEnteredAt: candidate.statusEnteredAt,
              elapsedMinutes: candidate.elapsedMinutes,
              recipient:
                recipient.kind === "user"
                  ? recipient.label || recipient.userId
                  : recipient.email,
              action: "skipped_duplicate",
              message: "Rule already ran for this record/status/recipient.",
            });
            continue;
          }

          const templateContext = buildTemplateContext(rule, candidate);

          const fallbackTitle = `${candidate.requestNumber} has been in ${candidate.statusLabel} for over ${rule.durationMinutes} minutes`;
          const fallbackMessage = `Workflow request ${candidate.requestNumber} has been in ${candidate.statusLabel} since ${candidate.statusEnteredAt}.`;

          const title =
            renderTemplate(rule.titleTemplate, templateContext) ||
            renderTemplate(definition?.titleTemplate, templateContext) ||
            fallbackTitle;

          const message =
            renderTemplate(rule.messageTemplate, templateContext) ??
            renderTemplate(definition?.messageTemplate, templateContext) ??
            fallbackMessage;

          const priority = resolvePriority(rule, definition?.defaultPriority, candidate);
          const channels = uniqueChannels(rule.channels);

          const payload = {
            ruleId: rule.id,
            ruleName: rule.ruleName,
            module: rule.module,
            eventType: rule.eventType,
            triggerType: rule.triggerType,

            entityType: ENTITY_TYPE,
            entityId: candidate.id,
            requestNumber: candidate.requestNumber,

            workflowStatusId: candidate.statusId,
            workflowStatusCode: candidate.statusCode,
            workflowStatusLabel: candidate.statusLabel,
            statusEnteredAt: candidate.statusEnteredAt,
            elapsedMinutes: candidate.elapsedMinutes,

            durationMinutes: rule.durationMinutes,
            salesOrder: displaySalesOrder(candidate),
            customerName: candidate.customerName,
            rush: candidate.rush,
          };

          if (dryRun) {
            result.skippedDryRun += 1;
            result.details.push({
              ruleId: rule.id,
              ruleName: rule.ruleName,
              entityId: candidate.id,
              requestNumber: candidate.requestNumber,
              workflowStatusLabel: candidate.statusLabel,
              statusEnteredAt: candidate.statusEnteredAt,
              elapsedMinutes: candidate.elapsedMinutes,
              recipient:
                recipient.kind === "user"
                  ? recipient.label || recipient.userId
                  : recipient.email,
              action: "would_create",
              message: title,
            });
            continue;
          }

          try {
            let eventId = "";
            let deliveryCount = 0;

            if (recipient.kind === "user") {
              const created = await createUserNotification({
                rule,
                candidate,
                recipient,
                title,
                message,
                priority,
                channels,
                payload,
              });

              eventId = created.eventId;
              deliveryCount = created.deliveryCount;
            } else {
              if (!channels.includes("email")) {
                result.skippedInvalidRecipients += 1;
                result.details.push({
                  ruleId: rule.id,
                  ruleName: rule.ruleName,
                  entityId: candidate.id,
                  requestNumber: candidate.requestNumber,
                  workflowStatusLabel: candidate.statusLabel,
                  statusEnteredAt: candidate.statusEnteredAt,
                  elapsedMinutes: candidate.elapsedMinutes,
                  recipient: recipient.email,
                  action: "skipped",
                  message: "Static email recipients require the email channel.",
                });
                continue;
              }

              const created = await createStaticEmailNotification({
                rule,
                candidate,
                recipient,
                title,
                message,
                priority,
                payload,
              });

              eventId = created.eventId;
              deliveryCount = created.deliveryCount;
            }

            const runInserted = await insertRuleRun({
              ruleId: rule.id,
              notificationEventId: eventId,
              entityType: ENTITY_TYPE,
              entityId: candidate.id,
              eventType: rule.eventType,
              triggerType: rule.triggerType,
              workflowStatusId: candidate.statusId,
              statusEnteredAt: candidate.statusEnteredAt,
              recipientUserId,
              recipientEmail,
              metadata: payload,
            });

            result.createdEvents += 1;
            result.createdDeliveries += deliveryCount;

            if (runInserted) {
              result.createdRuleRuns += 1;
            } else {
              result.skippedAlreadyRun += 1;
            }

            result.details.push({
              ruleId: rule.id,
              ruleName: rule.ruleName,
              entityId: candidate.id,
              requestNumber: candidate.requestNumber,
              workflowStatusLabel: candidate.statusLabel,
              statusEnteredAt: candidate.statusEnteredAt,
              elapsedMinutes: candidate.elapsedMinutes,
              recipient:
                recipient.kind === "user"
                  ? recipient.label || recipient.userId
                  : recipient.email,
              action: "created",
              message: title,
            });
          } catch (err: any) {
            result.errors.push({
              ruleId: rule.id,
              ruleName: rule.ruleName,
              entityId: candidate.id,
              recipient:
                recipient.kind === "user"
                  ? recipient.label || recipient.userId
                  : recipient.email,
              message: err?.message || "Failed to create notification.",
            });

            result.details.push({
              ruleId: rule.id,
              ruleName: rule.ruleName,
              entityId: candidate.id,
              requestNumber: candidate.requestNumber,
              workflowStatusLabel: candidate.statusLabel,
              statusEnteredAt: candidate.statusEnteredAt,
              elapsedMinutes: candidate.elapsedMinutes,
              recipient:
                recipient.kind === "user"
                  ? recipient.label || recipient.userId
                  : recipient.email,
              action: "error",
              message: err?.message || "Failed to create notification.",
            });
          }
        }
      }
    }

    result.finishedAt = new Date().toISOString();
    return result;
  } finally {
    if (result.lockAcquired) {
      try {
        await releaseLock(client);
      } catch {
        // ignore unlock errors so the response can still return the evaluation result
      }
    }

    client.release();
  }
}