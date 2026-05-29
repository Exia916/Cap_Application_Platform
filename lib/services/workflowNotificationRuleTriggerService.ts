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
import { isPlatformEmailEnabled } from "@/lib/services/platformEmailService";
import { evaluateNotificationRuleConditions } from "@/lib/services/notificationRuleConditionService";

type WorkflowRuleRow = {
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

type WorkflowSnapshot = {
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
  createdAt: string;
  updatedAt: string;
};

type WorkflowStatusRow = {
  id: number;
  code: string;
  label: string;
};

type Actor = {
  userId?: string | null;
  name?: string | null;
  role?: string | null;
  department?: string | null;
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

type FieldChangeContext = {
  fieldName: string;
  fieldLabel: string;
  previousValue: unknown;
  newValue: unknown;
};

export type WorkflowRuleTriggerResult = {
  eventType: string;
  requestId: string;
  evaluatedRules: number;
  candidateRecipients: number;
  createdEvents: number;
  createdDeliveries: number;
  createdRuleRuns: number;
  skippedNoRecipients: number;
  skippedAlreadyRun: number;
  skippedInvalidRecipients: number;
  skippedConditions: number;
  skippedDefinitionInactive: number;
  errors: Array<{
    ruleId?: string;
    ruleName?: string;
    recipient?: string;
    message: string;
  }>;
};

export type WorkflowStatusChangedInput = {
  requestId: string;
  previousStatusId: number;
  newStatusId: number;
  actor?: Actor | null;
};

export type WorkflowRequestCreatedInput = {
  requestId: string;
  actor?: Actor | null;
};

export type WorkflowFieldChangedInput = {
  requestId: string;
  eventType:
    | "workflow.digitizer.changed"
    | "workflow.designer.changed"
    | "workflow.bin.changed"
    | "workflow.due_date.changed"
    | "workflow.rush.changed";
  fieldName: string;
  fieldLabel: string;
  previousValue: unknown;
  newValue: unknown;
  actor?: Actor | null;
};

const ENTITY_TYPE = "design_workflow_request";

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

function displaySalesOrder(snapshot: WorkflowSnapshot) {
  return (
    snapshot.salesOrderDisplay ||
    snapshot.salesOrderBase ||
    snapshot.salesOrderNumber ||
    ""
  );
}

function resolvePriority(
  rule: WorkflowRuleRow,
  definitionPriority: NotificationPriority | null | undefined,
  snapshot: WorkflowSnapshot
): NotificationPriority {
  if (rule.priorityMode === "definition_default") {
    return definitionPriority || rule.defaultPriority || "normal";
  }

  if (rule.priorityMode === "source_priority") {
    return snapshot.rush ? "urgent" : rule.defaultPriority || "normal";
  }

  return rule.defaultPriority || "normal";
}

function emptyResult(eventType: string, requestId: string): WorkflowRuleTriggerResult {
  return {
    eventType,
    requestId,
    evaluatedRules: 0,
    candidateRecipients: 0,
    createdEvents: 0,
    createdDeliveries: 0,
    createdRuleRuns: 0,
    skippedNoRecipients: 0,
    skippedAlreadyRun: 0,
    skippedInvalidRecipients: 0,
    skippedConditions: 0,
    skippedDefinitionInactive: 0,
    errors: [],
  };
}

function normalizeFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

async function getWorkflowSnapshot(requestId: string): Promise<WorkflowSnapshot | null> {
  const { rows } = await db.query<WorkflowSnapshot>(
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
      req.created_at AS "createdAt",
      req.updated_at AS "updatedAt"
    FROM public.design_workflow_requests req
    INNER JOIN public.design_workflow_statuses ws
      ON ws.id = req.status_id
    WHERE req.id = $1::uuid
      AND COALESCE(req.is_voided, false) = false
    LIMIT 1
    `,
    [requestId]
  );

  return rows[0] ?? null;
}

async function getWorkflowStatus(statusId: number | null | undefined): Promise<WorkflowStatusRow | null> {
  if (!statusId) return null;

  const { rows } = await db.query<WorkflowStatusRow>(
    `
    SELECT
      id,
      code,
      label
    FROM public.design_workflow_statuses
    WHERE id = $1
    LIMIT 1
    `,
    [statusId]
  );

  return rows[0] ?? null;
}

async function getLatestStatusHistoryChangedAt(
  requestId: string,
  statusId: number
): Promise<string | null> {
  const { rows } = await db.query<{ changedAt: string }>(
    `
    SELECT changed_at AS "changedAt"
    FROM public.design_workflow_status_history
    WHERE request_id = $1::uuid
      AND status_id = $2
    ORDER BY changed_at DESC, id DESC
    LIMIT 1
    `,
    [requestId, statusId]
  );

  return rows[0]?.changedAt ?? null;
}

async function listActiveEventRules(args: {
  eventType: string;
  workflowStatusId: number | null;
}): Promise<WorkflowRuleRow[]> {
  const { rows } = await db.query<WorkflowRuleRow>(
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
    WHERE r.is_active = true
      AND r.module = 'design_workflow'
      AND r.trigger_type = 'event_based'
      AND r.event_type = $1
      AND (
        r.workflow_status_id IS NULL
        OR r.workflow_status_id = $2
      )
    ORDER BY
      r.workflow_status_id NULLS FIRST,
      r.rule_name ASC
    `,
    [args.eventType, args.workflowStatusId]
  );

  return rows;
}

async function getUserRecipientById(
  userId: string | null | undefined
): Promise<UserRecipient | null> {
  if (!userId || !isUuid(userId)) return null;

  const { rows } = await db.query<{
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

async function listUserRecipientsByRole(role: string | null): Promise<UserRecipient[]> {
  const value = String(role ?? "").trim();
  if (!value) return [];

  const { rows } = await db.query<{
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

async function listUserRecipientsByDepartment(department: string | null): Promise<UserRecipient[]> {
  const value = String(department ?? "").trim();
  if (!value) return [];

  const { rows } = await db.query<{
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

async function getUserRecipientByBinCode(binCode: string | null): Promise<UserRecipient | null> {
  const value = String(binCode ?? "").trim();
  if (!value || value.toLowerCase() === "unspecified") return null;

  const { rows } = await db.query<{
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
  rule: WorkflowRuleRow,
  snapshot: WorkflowSnapshot
): Promise<Recipient[]> {
  switch (rule.recipientMode) {
    case "specific_user": {
      const recipient = await getUserRecipientById(rule.recipientUserId);
      return recipient ? [recipient] : [];
    }

    case "source_created_by": {
      const recipient = await getUserRecipientById(snapshot.createdByUserId);
      return recipient ? [recipient] : [];
    }

    case "workflow_digitizer": {
      const recipient = await getUserRecipientById(snapshot.digitizerUserId);
      return recipient ? [recipient] : [];
    }

    case "workflow_designer": {
      const recipient = await getUserRecipientById(snapshot.designerUserId);
      return recipient ? [recipient] : [];
    }

    case "workflow_bin_user": {
      const recipient = await getUserRecipientByBinCode(snapshot.binCode);
      return recipient ? [recipient] : [];
    }

    case "role":
      return listUserRecipientsByRole(rule.recipientRole);

    case "department":
      return listUserRecipientsByDepartment(rule.recipientDepartment);

    case "static_email":
    case "static_email_list":
      return rule.recipientStaticEmails
        .map((email) => cleanEmail(email))
        .filter(Boolean)
        .map((email) => ({
          kind: "static_email" as const,
          email: email!,
          label: email!,
        }));

    default:
      return [];
  }
}

function buildTemplateContext(args: {
  rule: WorkflowRuleRow;
  snapshot: WorkflowSnapshot;
  eventType: string;
  eventTimestamp: string;
  previousStatus: WorkflowStatusRow | null;
  newStatus: WorkflowStatusRow | null;
  actor: Actor | null | undefined;
  fieldChange?: FieldChangeContext | null;
}) {
  const {
    rule,
    snapshot,
    eventType,
    eventTimestamp,
    previousStatus,
    newStatus,
    actor,
    fieldChange,
  } = args;

  const previousValue = normalizeFieldValue(fieldChange?.previousValue);
  const newValue = normalizeFieldValue(fieldChange?.newValue);

  return {
    ruleId: rule.id,
    ruleName: rule.ruleName,

    module: rule.module,
    eventType,
    eventLabel: rule.eventLabel || eventType,

    requestId: snapshot.id,
    requestNumber: snapshot.requestNumber,
    sourceRecordLabel: snapshot.requestNumber,

    salesOrder: displaySalesOrder(snapshot),
    salesOrderNumber: snapshot.salesOrderNumber || "",
    salesOrderBase: snapshot.salesOrderBase || "",
    salesOrderDisplay: snapshot.salesOrderDisplay || "",

    poNumber: snapshot.poNumber || "",
    tapeName: snapshot.tapeName || "",

    customerName: snapshot.customerName || "",
    customerCode: snapshot.customerCode || "",

    workflowStatusId: snapshot.statusId,
    workflowStatusCode: snapshot.statusCode,
    workflowStatusLabel: snapshot.statusLabel,

    previousWorkflowStatusId: previousStatus?.id || "",
    previousWorkflowStatusCode: previousStatus?.code || "",
    previousWorkflowStatusLabel: previousStatus?.label || "",

    newWorkflowStatusId: newStatus?.id || snapshot.statusId,
    newWorkflowStatusCode: newStatus?.code || snapshot.statusCode,
    newWorkflowStatusLabel: newStatus?.label || snapshot.statusLabel,

    fieldName: fieldChange?.fieldName || "",
    fieldLabel: fieldChange?.fieldLabel || "",
    previousValue,
    newValue,

    previousDigitizerName:
      fieldChange?.fieldName === "digitizer" ? previousValue : "",
    newDigitizerName:
      fieldChange?.fieldName === "digitizer" ? newValue : "",

    previousDesignerName:
      fieldChange?.fieldName === "designer" ? previousValue : "",
    newDesignerName:
      fieldChange?.fieldName === "designer" ? newValue : "",

    previousBinCode:
      fieldChange?.fieldName === "bin_code" ? previousValue : "",
    newBinCode:
      fieldChange?.fieldName === "bin_code" ? newValue : "",

    previousDueDate:
      fieldChange?.fieldName === "due_date" ? previousValue : "",
    newDueDate:
      fieldChange?.fieldName === "due_date" ? newValue : "",

    previousRush:
      fieldChange?.fieldName === "rush" ? previousValue : "",
    newRush:
      fieldChange?.fieldName === "rush" ? newValue : "",

    eventTimestamp,
    statusChangedAt: eventTimestamp,

    createdByName: snapshot.createdByName || "",
    digitizerName: snapshot.digitizerName || "",
    designerName: snapshot.designerName || "",
    binCode: snapshot.binCode || "",

    dueDate: snapshot.dueDate || "",
    rush: snapshot.rush,

    actorUserId: actor?.userId || "",
    actorName: actor?.name || "",
    actorRole: actor?.role || "",
    actorDepartment: actor?.department || "",
  };
}

async function hasRuleRun(input: {
  ruleId: string;
  entityId: string;
  workflowStatusId: number | null;
  statusEnteredAt: string | null;
  recipientUserId: string | null;
  recipientEmail: string | null;
}) {
  const { rows } = await db.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM public.platform_notification_rule_runs rr
      WHERE rr.rule_id = $1::uuid
        AND rr.entity_type = $2
        AND rr.entity_id = $3
        AND COALESCE(rr.workflow_status_id, -1) = COALESCE($4::int, -1)
        AND COALESCE(rr.status_entered_at, '-infinity'::timestamptz)
          = COALESCE($5::timestamptz, '-infinity'::timestamptz)
        AND COALESCE(rr.recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE($6::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND lower(COALESCE(rr.recipient_email, '')) = lower(COALESCE($7, ''))
      LIMIT 1
    ) AS exists
    `,
    [
      input.ruleId,
      ENTITY_TYPE,
      input.entityId,
      input.workflowStatusId,
      input.statusEnteredAt,
      input.recipientUserId,
      input.recipientEmail,
    ]
  );

  return !!rows[0]?.exists;
}

async function insertRuleRun(input: {
  ruleId: string;
  notificationEventId: string;
  entityId: string;
  eventType: string;
  triggerType: string;
  workflowStatusId: number | null;
  statusEnteredAt: string | null;
  recipientUserId: string | null;
  recipientEmail: string | null;
  metadata: Record<string, unknown>;
}) {
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
      ENTITY_TYPE,
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
  rule: WorkflowRuleRow;
  snapshot: WorkflowSnapshot;
  recipient: StaticEmailRecipient;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  payload: Record<string, unknown>;
}) {
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
        input.snapshot.id,
        input.title,
        input.message,
        input.priority,
        JSON.stringify(input.payload),
        input.rule.id,
      ]
    );

    const eventId = eventRes.rows[0]!.id;
    const emailEnabled = isPlatformEmailEnabled();

    const status = emailEnabled ? "pending" : "skipped";
    const skipMessage = emailEnabled
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
        skipMessage,
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
  rule: WorkflowRuleRow;
  snapshot: WorkflowSnapshot;
  recipient: UserRecipient;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  payload: Record<string, unknown>;
}) {
  const result: CreateNotificationForUserResult = await createNotificationForUser({
    eventType: input.rule.eventType,
    module: input.rule.module,
    entityType: ENTITY_TYPE,
    entityId: input.snapshot.id,
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
  };
}

function buildFallbackTitle(args: {
  eventType: string;
  snapshot: WorkflowSnapshot;
  previousStatus: WorkflowStatusRow | null;
  newStatus: WorkflowStatusRow | null;
  fieldChange?: FieldChangeContext | null;
}) {
  const { eventType, snapshot, previousStatus, newStatus, fieldChange } = args;

  if (eventType === "workflow.request.created") {
    return `Workflow request ${snapshot.requestNumber} was created`;
  }

  if (eventType === "workflow.status.exited") {
    return `Workflow request ${snapshot.requestNumber} exited ${previousStatus?.label || "a status"}`;
  }

  if (eventType === "workflow.status.entered") {
    return `Workflow request ${snapshot.requestNumber} entered ${newStatus?.label || snapshot.statusLabel}`;
  }

  if (eventType === "workflow.status.changed") {
    return `Workflow request ${snapshot.requestNumber} status changed to ${newStatus?.label || snapshot.statusLabel}`;
  }

  if (fieldChange) {
    return `Workflow request ${snapshot.requestNumber} ${fieldChange.fieldLabel} changed`;
  }

  return `Workflow request ${snapshot.requestNumber} updated`;
}

function buildFallbackMessage(args: {
  eventType: string;
  snapshot: WorkflowSnapshot;
  previousStatus: WorkflowStatusRow | null;
  newStatus: WorkflowStatusRow | null;
  actor?: Actor | null;
  fieldChange?: FieldChangeContext | null;
}) {
  const { eventType, snapshot, previousStatus, newStatus, actor, fieldChange } = args;

  if (eventType === "workflow.request.created") {
    return `Workflow request ${snapshot.requestNumber} was created by ${
      actor?.name || snapshot.createdByName || "CAP"
    }.`;
  }

  if (fieldChange) {
    return `Workflow request ${snapshot.requestNumber} ${fieldChange.fieldLabel} changed from "${normalizeFieldValue(
      fieldChange.previousValue
    )}" to "${normalizeFieldValue(fieldChange.newValue)}".`;
  }

  return `Workflow request ${snapshot.requestNumber} changed from ${
    previousStatus?.label || "Unknown"
  } to ${newStatus?.label || snapshot.statusLabel}.`;
}

async function fireWorkflowEventRules(args: {
  requestId: string;
  eventType: string;
  workflowStatusIdForRule: number | null;
  eventTimestamp: string;
  previousStatus: WorkflowStatusRow | null;
  newStatus: WorkflowStatusRow | null;
  actor?: Actor | null;
  fieldChange?: FieldChangeContext | null;
}): Promise<WorkflowRuleTriggerResult> {
  const result = emptyResult(args.eventType, args.requestId);

  const snapshot = await getWorkflowSnapshot(args.requestId);
  if (!snapshot) return result;

  const rules = await listActiveEventRules({
    eventType: args.eventType,
    workflowStatusId: args.workflowStatusIdForRule,
  });

  result.evaluatedRules = rules.length;

  for (const rule of rules) {
    const definition = await getNotificationDefinitionByEventType(rule.eventType);

    if (definition && !definition.isActive) {
      result.skippedDefinitionInactive += 1;
      continue;
    }

    const conditionResult = evaluateNotificationRuleConditions(rule.conditionJson, {
      rush: snapshot.rush,
      salesOrder: displaySalesOrder(snapshot),
      customerName: snapshot.customerName,
      dueDate: snapshot.dueDate,

      digitizerUserId: snapshot.digitizerUserId,
      digitizerName: snapshot.digitizerName,

      designerUserId: snapshot.designerUserId,
      designerName: snapshot.designerName,

      binCode: snapshot.binCode,

      fieldName: args.fieldChange?.fieldName || null,
      previousValue: args.fieldChange?.previousValue,
      newValue: args.fieldChange?.newValue,

      now: new Date(args.eventTimestamp),
    });

    if (!conditionResult.passed) {
      result.skippedConditions += 1;
      continue;
    }

    let recipients: Recipient[] = [];

    try {
      recipients = uniqueRecipients(await resolveRecipients(rule, snapshot));
    } catch (err: any) {
      result.errors.push({
        ruleId: rule.id,
        ruleName: rule.ruleName,
        message: err?.message || "Failed to resolve recipients.",
      });
      continue;
    }

    if (!recipients.length) {
      result.skippedNoRecipients += 1;
      continue;
    }

    const context = buildTemplateContext({
      rule,
      snapshot,
      eventType: args.eventType,
      eventTimestamp: args.eventTimestamp,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
      actor: args.actor,
      fieldChange: args.fieldChange,
    });

    const fallbackTitle = buildFallbackTitle({
      eventType: args.eventType,
      snapshot,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
      fieldChange: args.fieldChange,
    });

    const fallbackMessage = buildFallbackMessage({
      eventType: args.eventType,
      snapshot,
      previousStatus: args.previousStatus,
      newStatus: args.newStatus,
      actor: args.actor,
      fieldChange: args.fieldChange,
    });

    const title =
      renderTemplate(rule.titleTemplate, context) ||
      renderTemplate(definition?.titleTemplate, context) ||
      fallbackTitle;

    const message =
      renderTemplate(rule.messageTemplate, context) ??
      renderTemplate(definition?.messageTemplate, context) ??
      fallbackMessage;

    const priority = resolvePriority(rule, definition?.defaultPriority, snapshot);
    const channels = uniqueChannels(rule.channels);

    const payload = {
      ruleId: rule.id,
      ruleName: rule.ruleName,

      module: rule.module,
      eventType: rule.eventType,
      triggerType: rule.triggerType,

      entityType: ENTITY_TYPE,
      entityId: snapshot.id,
      requestNumber: snapshot.requestNumber,

      workflowStatusId: args.workflowStatusIdForRule,
      workflowStatusLabel:
        args.eventType === "workflow.status.exited"
          ? args.previousStatus?.label || null
          : args.newStatus?.label || snapshot.statusLabel,

      previousWorkflowStatusId: args.previousStatus?.id || null,
      previousWorkflowStatusLabel: args.previousStatus?.label || null,

      newWorkflowStatusId: args.newStatus?.id || null,
      newWorkflowStatusLabel: args.newStatus?.label || null,

      fieldName: args.fieldChange?.fieldName || null,
      fieldLabel: args.fieldChange?.fieldLabel || null,
      previousValue: args.fieldChange?.previousValue ?? null,
      newValue: args.fieldChange?.newValue ?? null,

      eventTimestamp: args.eventTimestamp,
      salesOrder: displaySalesOrder(snapshot),
      customerName: snapshot.customerName,
      rush: snapshot.rush,

      actorUserId: args.actor?.userId || null,
      actorName: args.actor?.name || null,
    };

    for (const recipient of recipients) {
      result.candidateRecipients += 1;

      const recipientUserId = recipient.kind === "user" ? recipient.userId : null;
      const recipientEmail = recipient.kind === "static_email" ? recipient.email : null;

      const alreadyRun = await hasRuleRun({
        ruleId: rule.id,
        entityId: snapshot.id,
        workflowStatusId: args.workflowStatusIdForRule,
        statusEnteredAt: args.eventTimestamp,
        recipientUserId,
        recipientEmail,
      });

      if (alreadyRun) {
        result.skippedAlreadyRun += 1;
        continue;
      }

      try {
        let eventId = "";
        let deliveryCount = 0;

        if (recipient.kind === "user") {
          const created = await createUserNotification({
            rule,
            snapshot,
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
            continue;
          }

          const created = await createStaticEmailNotification({
            rule,
            snapshot,
            recipient,
            title,
            message,
            priority,
            payload,
          });

          eventId = created.eventId;
          deliveryCount = created.deliveryCount;
        }

        result.createdEvents += 1;
        result.createdDeliveries += deliveryCount;

        const runInserted = await insertRuleRun({
          ruleId: rule.id,
          notificationEventId: eventId,
          entityId: snapshot.id,
          eventType: rule.eventType,
          triggerType: rule.triggerType,
          workflowStatusId: args.workflowStatusIdForRule,
          statusEnteredAt: args.eventTimestamp,
          recipientUserId,
          recipientEmail,
          metadata: payload,
        });

        if (runInserted) {
          result.createdRuleRuns += 1;
        } else {
          result.skippedAlreadyRun += 1;
        }
      } catch (err: any) {
        result.errors.push({
          ruleId: rule.id,
          ruleName: rule.ruleName,
          recipient:
            recipient.kind === "user"
              ? recipient.label || recipient.userId
              : recipient.email,
          message: err?.message || "Failed to create notification.",
        });
      }
    }
  }

  return result;
}

export async function fireWorkflowRequestCreatedRules(
  input: WorkflowRequestCreatedInput
): Promise<WorkflowRuleTriggerResult[]> {
  const snapshot = await getWorkflowSnapshot(input.requestId);
  if (!snapshot) return [];

  const enteredAt =
    (await getLatestStatusHistoryChangedAt(input.requestId, snapshot.statusId)) ||
    snapshot.createdAt ||
    new Date().toISOString();

  const currentStatus = await getWorkflowStatus(snapshot.statusId);

  const createdResult = await fireWorkflowEventRules({
    requestId: input.requestId,
    eventType: "workflow.request.created",
    workflowStatusIdForRule: snapshot.statusId,
    eventTimestamp: snapshot.createdAt || enteredAt,
    previousStatus: null,
    newStatus: currentStatus,
    actor: input.actor,
  });

  const enteredResult = await fireWorkflowEventRules({
    requestId: input.requestId,
    eventType: "workflow.status.entered",
    workflowStatusIdForRule: snapshot.statusId,
    eventTimestamp: enteredAt,
    previousStatus: null,
    newStatus: currentStatus,
    actor: input.actor,
  });

  return [createdResult, enteredResult];
}

export async function fireWorkflowStatusChangedRules(
  input: WorkflowStatusChangedInput
): Promise<WorkflowRuleTriggerResult[]> {
  if (!input.requestId || input.previousStatusId === input.newStatusId) {
    return [];
  }

  const changedAt =
    (await getLatestStatusHistoryChangedAt(input.requestId, input.newStatusId)) ||
    new Date().toISOString();

  const previousStatus = await getWorkflowStatus(input.previousStatusId);
  const newStatus = await getWorkflowStatus(input.newStatusId);

  const changedResult = await fireWorkflowEventRules({
    requestId: input.requestId,
    eventType: "workflow.status.changed",
    workflowStatusIdForRule: input.newStatusId,
    eventTimestamp: changedAt,
    previousStatus,
    newStatus,
    actor: input.actor,
  });

  const exitedResult = await fireWorkflowEventRules({
    requestId: input.requestId,
    eventType: "workflow.status.exited",
    workflowStatusIdForRule: input.previousStatusId,
    eventTimestamp: changedAt,
    previousStatus,
    newStatus,
    actor: input.actor,
  });

  const enteredResult = await fireWorkflowEventRules({
    requestId: input.requestId,
    eventType: "workflow.status.entered",
    workflowStatusIdForRule: input.newStatusId,
    eventTimestamp: changedAt,
    previousStatus,
    newStatus,
    actor: input.actor,
  });

  return [changedResult, exitedResult, enteredResult];
}

export async function fireWorkflowFieldChangedRule(
  input: WorkflowFieldChangedInput
): Promise<WorkflowRuleTriggerResult> {
  if (!input.requestId || !input.eventType) {
    return emptyResult(input.eventType || "workflow.field.changed", input.requestId || "");
  }

  const snapshot = await getWorkflowSnapshot(input.requestId);
  if (!snapshot) {
    return emptyResult(input.eventType, input.requestId);
  }

  const currentStatus = await getWorkflowStatus(snapshot.statusId);
  const eventTimestamp = new Date().toISOString();

  return fireWorkflowEventRules({
    requestId: input.requestId,
    eventType: input.eventType,
    workflowStatusIdForRule: snapshot.statusId,
    eventTimestamp,
    previousStatus: currentStatus,
    newStatus: currentStatus,
    actor: input.actor,
    fieldChange: {
      fieldName: input.fieldName,
      fieldLabel: input.fieldLabel,
      previousValue: input.previousValue,
      newValue: input.newValue,
    },
  });
}