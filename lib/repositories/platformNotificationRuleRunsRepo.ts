import { db } from "@/lib/db";

export type PlatformNotificationRuleRunListRow = {
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

export type PlatformNotificationRuleRunDeliveryRow = {
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

export type PlatformNotificationRuleRunDetail = PlatformNotificationRuleRunListRow & {
  eventPayload: Record<string, any> | null;
  deliveries: PlatformNotificationRuleRunDeliveryRow[];
};

export type ListPlatformNotificationRuleRunsArgs = {
  q?: string | null;
  ruleId?: string | null;
  eventType?: string | null;
  triggerType?: string | null;
  deliveryStatus?: string | null;
  entityType?: string | null;
  recipient?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number | null;
  offset?: number | null;
};

export type ListPlatformNotificationRuleRunsResult = {
  rows: PlatformNotificationRuleRunListRow[];
  totalCount: number;
};

function normalizeLimit(value: unknown, fallback = 100, max = 500): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function normalizeOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

function buildWhere(args: ListPlatformNotificationRuleRunsArgs) {
  const where: string[] = [];
  const params: any[] = [];

  const ruleId = String(args.ruleId ?? "").trim();
  if (ruleId && isUuid(ruleId)) {
    params.push(ruleId);
    where.push(`rr.rule_id = $${params.length}::uuid`);
  }

  const eventType = String(args.eventType ?? "").trim();
  if (eventType) {
    params.push(eventType);
    where.push(`rr.event_type = $${params.length}`);
  }

  const triggerType = String(args.triggerType ?? "").trim();
  if (triggerType) {
    params.push(triggerType);
    where.push(`rr.trigger_type = $${params.length}`);
  }

  const entityType = String(args.entityType ?? "").trim();
  if (entityType) {
    params.push(entityType);
    where.push(`rr.entity_type = $${params.length}`);
  }

  const deliveryStatus = String(args.deliveryStatus ?? "").trim();
  if (deliveryStatus) {
    params.push(deliveryStatus);
    where.push(`
      EXISTS (
        SELECT 1
        FROM public.notification_deliveries d_status
        WHERE d_status.notification_event_id = rr.notification_event_id
          AND d_status.status = $${params.length}
      )
    `);
  }

  const recipient = String(args.recipient ?? "").trim();
  if (recipient) {
    params.push(`%${recipient}%`);
    const p = `$${params.length}`;

    where.push(`
      (
        COALESCE(rr.recipient_email, '') ILIKE ${p}
        OR COALESCE(recipient_user.display_name, '') ILIKE ${p}
        OR COALESCE(recipient_user.username, '') ILIKE ${p}
      )
    `);
  }

  const dateFrom = String(args.dateFrom ?? "").trim();
  if (dateFrom) {
    params.push(dateFrom);
    where.push(`rr.triggered_at >= $${params.length}::timestamptz`);
  }

  const dateTo = String(args.dateTo ?? "").trim();
  if (dateTo) {
    params.push(dateTo);
    where.push(`rr.triggered_at <= $${params.length}::timestamptz`);
  }

  const q = String(args.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;

    where.push(`
      (
        COALESCE(r.rule_name, '') ILIKE ${p}
        OR COALESCE(rr.event_type, '') ILIKE ${p}
        OR COALESCE(rr.trigger_type, '') ILIKE ${p}
        OR COALESCE(rr.entity_type, '') ILIKE ${p}
        OR COALESCE(rr.entity_id, '') ILIKE ${p}
        OR COALESCE(req.request_number, '') ILIKE ${p}
        OR COALESCE(e.title, '') ILIKE ${p}
        OR COALESCE(e.message, '') ILIKE ${p}
        OR COALESCE(rr.recipient_email, '') ILIKE ${p}
        OR COALESCE(recipient_user.display_name, '') ILIKE ${p}
        OR COALESCE(recipient_user.username, '') ILIKE ${p}
      )
    `);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function baseFromSql() {
  return `
    FROM public.platform_notification_rule_runs rr
    LEFT JOIN public.platform_notification_rules r
      ON r.id = rr.rule_id
    LEFT JOIN public.notification_events e
      ON e.id = rr.notification_event_id
    LEFT JOIN public.users recipient_user
      ON recipient_user.id = rr.recipient_user_id
    LEFT JOIN public.design_workflow_statuses ws
      ON ws.id = rr.workflow_status_id
    LEFT JOIN public.design_workflow_requests req
      ON rr.entity_type = 'design_workflow_request'
     AND rr.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     AND req.id = rr.entity_id::uuid
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS delivery_count,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.channel), NULL) AS delivery_channels,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.status), NULL) AS delivery_statuses,
        STRING_AGG(DISTINCT NULLIF(d.error_message, ''), ' | ') AS delivery_errors,
        MAX(d.attempted_at) AS last_attempted_at,
        MAX(d.delivered_at) AS last_delivered_at
      FROM public.notification_deliveries d
      WHERE d.notification_event_id = rr.notification_event_id
    ) delivery_summary ON true
  `;
}

function selectListSql() {
  return `
    SELECT
      rr.id::text AS "id",

      rr.rule_id::text AS "ruleId",
      r.rule_name AS "ruleName",

      rr.notification_event_id::text AS "notificationEventId",

      rr.entity_type AS "entityType",
      rr.entity_id AS "entityId",
      COALESCE(req.request_number, rr.entity_id) AS "entityLabel",

      rr.event_type AS "eventType",
      rr.trigger_type AS "triggerType",

      rr.workflow_status_id AS "workflowStatusId",
      ws.label AS "workflowStatusLabel",
      rr.status_entered_at AS "statusEnteredAt",

      rr.recipient_user_id::text AS "recipientUserId",
      COALESCE(recipient_user.display_name, recipient_user.username) AS "recipientUserLabel",
      rr.recipient_email AS "recipientEmail",
      COALESCE(
        COALESCE(recipient_user.display_name, recipient_user.username),
        rr.recipient_email,
        ''
      ) AS "recipientDisplay",

      e.title AS "notificationTitle",
      e.message AS "notificationMessage",
      e.priority AS "notificationPriority",
      e.created_at AS "notificationCreatedAt",

      COALESCE(delivery_summary.delivery_count, 0)::int AS "deliveryCount",
      COALESCE(delivery_summary.delivery_channels, ARRAY[]::text[]) AS "deliveryChannels",
      COALESCE(delivery_summary.delivery_statuses, ARRAY[]::text[]) AS "deliveryStatuses",
      delivery_summary.delivery_errors AS "deliveryErrors",
      delivery_summary.last_attempted_at AS "lastAttemptedAt",
      delivery_summary.last_delivered_at AS "lastDeliveredAt",

      rr.triggered_at AS "triggeredAt",
      COALESCE(rr.metadata, '{}'::jsonb) AS "metadata"
    ${baseFromSql()}
  `;
}

export async function listPlatformNotificationRuleRuns(
  args: ListPlatformNotificationRuleRunsArgs = {}
): Promise<ListPlatformNotificationRuleRunsResult> {
  const { whereSql, params } = buildWhere(args);

  const limit = normalizeLimit(args.limit);
  const offset = normalizeOffset(args.offset);

  const countRes = await db.query<{ totalCount: number }>(
    `
    SELECT COUNT(*)::int AS "totalCount"
    ${baseFromSql()}
    ${whereSql}
    `,
    params
  );

  const dataParams = [...params, limit, offset];

  const { rows } = await db.query<PlatformNotificationRuleRunListRow>(
    `
    ${selectListSql()}
    ${whereSql}
    ORDER BY rr.triggered_at DESC, rr.id DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    dataParams
  );

  return {
    rows,
    totalCount: Number(countRes.rows[0]?.totalCount ?? 0),
  };
}

export async function getPlatformNotificationRuleRunById(
  id: string
): Promise<PlatformNotificationRuleRunDetail | null> {
  const { rows } = await db.query<PlatformNotificationRuleRunListRow>(
    `
    ${selectListSql()}
    WHERE rr.id = $1::uuid
    LIMIT 1
    `,
    [id]
  );

  const row = rows[0];
  if (!row) return null;

  const eventPayloadRes = await db.query<{ payload: Record<string, any> | null }>(
    `
    SELECT payload
    FROM public.notification_events
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [row.notificationEventId]
  );

  const deliveriesRes = await db.query<PlatformNotificationRuleRunDeliveryRow>(
    `
    SELECT
      d.id::text AS "id",
      d.notification_event_id::text AS "notificationEventId",

      d.recipient_user_id::text AS "recipientUserId",
      COALESCE(u.display_name, u.username) AS "recipientUserLabel",
      d.recipient_email AS "recipientEmail",
      d.recipient_kind AS "recipientKind",
      d.recipient_label AS "recipientLabel",

      d.channel,
      d.status,

      d.attempted_at AS "attemptedAt",
      d.delivered_at AS "deliveredAt",
      d.read_at AS "readAt",

      COALESCE(d.attempt_count, 0)::int AS "attemptCount",
      COALESCE(d.max_attempts, 3)::int AS "maxAttempts",
      d.next_attempt_at AS "nextAttemptAt",

      d.error_message AS "errorMessage",
      d.skipped_reason AS "skippedReason",

      d.created_at AS "createdAt",
      d.updated_at AS "updatedAt"
    FROM public.notification_deliveries d
    LEFT JOIN public.users u
      ON u.id = d.recipient_user_id
    WHERE d.notification_event_id = $1::uuid
    ORDER BY d.created_at ASC, d.id ASC
    `,
    [row.notificationEventId]
  );

  return {
    ...row,
    eventPayload: eventPayloadRes.rows[0]?.payload ?? null,
    deliveries: deliveriesRes.rows,
  };
}