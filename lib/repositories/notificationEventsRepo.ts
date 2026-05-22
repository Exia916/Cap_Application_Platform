import { db } from "@/lib/db";

export type NotificationChannel = "in_app" | "email";
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

type Queryable = {
  query: <T = any>(
    sql: string,
    params?: any[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
};

export type NotificationEventRow = {
  id: string;
  eventType: string;
  module: string | null;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  targetUserId: string | null;
  title: string;
  message: string | null;
  priority: NotificationPriority;
  payload: unknown;
  createdAt: string;
};

export type NotificationDeliveryRow = {
  id: string;
  notificationEventId: string;
  recipientUserId: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  recipientEmail: string | null;
  attemptedAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationInboxRow = {
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
  payload: unknown;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  readAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type CreateNotificationEventInput = {
  eventType: string;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  title: string;
  message?: string | null;
  priority?: NotificationPriority;
  payload?: unknown;
};

export type CreateNotificationDeliveryInput = {
  notificationEventId: string;
  recipientUserId: string;
  channel: NotificationChannel;
  status?: NotificationDeliveryStatus;
  recipientEmail?: string | null;
  attemptedAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  errorMessage?: string | null;
};

export type ListNotificationsForUserArgs = {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

function toJsonOrEmptyObject(v: unknown): string {
  if (v === undefined || v === null) return "{}";
  return JSON.stringify(v);
}

function normalizeLimit(value: unknown, fallback = 50, max = 200): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.trunc(n), max);
}

function normalizeOffset(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

function eventSelectSql() {
  return `
    SELECT
      id::text AS "id",
      event_type AS "eventType",
      module,
      entity_type AS "entityType",
      entity_id AS "entityId",
      actor_user_id::text AS "actorUserId",
      target_user_id::text AS "targetUserId",
      title,
      message,
      priority,
      payload,
      created_at AS "createdAt"
    FROM public.notification_events
  `;
}

function deliverySelectSql() {
  return `
    SELECT
      id::text AS "id",
      notification_event_id::text AS "notificationEventId",
      recipient_user_id::text AS "recipientUserId",
      channel,
      status,
      recipient_email AS "recipientEmail",
      attempted_at AS "attemptedAt",
      delivered_at AS "deliveredAt",
      read_at AS "readAt",
      error_message AS "errorMessage",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM public.notification_deliveries
  `;
}

export async function createNotificationEvent(
  input: CreateNotificationEventInput,
  queryable: Queryable = db
): Promise<NotificationEventRow> {
  const eventType = String(input.eventType ?? "").trim();
  const title = String(input.title ?? "").trim();

  if (!eventType) {
    throw new Error("Notification eventType is required.");
  }

  if (!title) {
    throw new Error("Notification title is required.");
  }

  const priority = input.priority ?? "normal";

  const { rows } = await queryable.query<NotificationEventRow>(
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
      payload
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10::jsonb
    )
    RETURNING
      id::text AS "id",
      event_type AS "eventType",
      module,
      entity_type AS "entityType",
      entity_id AS "entityId",
      actor_user_id::text AS "actorUserId",
      target_user_id::text AS "targetUserId",
      title,
      message,
      priority,
      payload,
      created_at AS "createdAt"
    `,
    [
      eventType,
      input.module ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.actorUserId ?? null,
      input.targetUserId ?? null,
      title,
      input.message ?? null,
      priority,
      toJsonOrEmptyObject(input.payload),
    ]
  );

  return rows[0]!;
}

export async function createNotificationDelivery(
  input: CreateNotificationDeliveryInput,
  queryable: Queryable = db
): Promise<NotificationDeliveryRow> {
  const { rows } = await queryable.query<NotificationDeliveryRow>(
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
      error_message
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9
    )
    ON CONFLICT (notification_event_id, recipient_user_id, channel)
    DO UPDATE SET
      status = EXCLUDED.status,
      recipient_email = EXCLUDED.recipient_email,
      attempted_at = EXCLUDED.attempted_at,
      delivered_at = EXCLUDED.delivered_at,
      read_at = COALESCE(public.notification_deliveries.read_at, EXCLUDED.read_at),
      error_message = EXCLUDED.error_message,
      updated_at = NOW()
    RETURNING
      id::text AS "id",
      notification_event_id::text AS "notificationEventId",
      recipient_user_id::text AS "recipientUserId",
      channel,
      status,
      recipient_email AS "recipientEmail",
      attempted_at AS "attemptedAt",
      delivered_at AS "deliveredAt",
      read_at AS "readAt",
      error_message AS "errorMessage",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    `,
    [
      input.notificationEventId,
      input.recipientUserId,
      input.channel,
      input.status ?? "pending",
      input.recipientEmail ?? null,
      input.attemptedAt ?? null,
      input.deliveredAt ?? null,
      input.readAt ?? null,
      input.errorMessage ?? null,
    ]
  );

  return rows[0]!;
}

export async function getNotificationEventById(
  eventId: string
): Promise<NotificationEventRow | null> {
  const { rows } = await db.query<NotificationEventRow>(
    `
    ${eventSelectSql()}
    WHERE id = $1
    LIMIT 1
    `,
    [eventId]
  );

  return rows[0] ?? null;
}

export async function getNotificationDeliveryById(
  deliveryId: string
): Promise<NotificationDeliveryRow | null> {
  const { rows } = await db.query<NotificationDeliveryRow>(
    `
    ${deliverySelectSql()}
    WHERE id = $1
    LIMIT 1
    `,
    [deliveryId]
  );

  return rows[0] ?? null;
}

export async function listNotificationsForUser(
  args: ListNotificationsForUserArgs
): Promise<NotificationInboxRow[]> {
  const limit = normalizeLimit(args.limit);
  const offset = normalizeOffset(args.offset);

  const params: any[] = [args.userId];
  const where: string[] = [
    `d.recipient_user_id = $1`,
    `d.channel = 'in_app'`,
    `d.status = 'sent'`,
  ];

  if (args.unreadOnly) {
    where.push(`d.read_at IS NULL`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  params.push(offset);
  const offsetParam = `$${params.length}`;

  const { rows } = await db.query<NotificationInboxRow>(
    `
    SELECT
      d.id::text AS "deliveryId",
      e.id::text AS "eventId",
      e.event_type AS "eventType",
      e.module,
      e.entity_type AS "entityType",
      e.entity_id AS "entityId",
      e.actor_user_id::text AS "actorUserId",
      e.target_user_id::text AS "targetUserId",
      e.title,
      e.message,
      e.priority,
      e.payload,
      d.channel,
      d.status,
      d.read_at AS "readAt",
      d.delivered_at AS "deliveredAt",
      d.created_at AS "createdAt"
    FROM public.notification_deliveries d
    INNER JOIN public.notification_events e
      ON e.id = d.notification_event_id
    WHERE ${where.join(" AND ")}
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
    `,
    params
  );

  return rows;
}

export async function countUnreadNotificationsForUser(
  userId: string
): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM public.notification_deliveries
    WHERE recipient_user_id = $1
      AND channel = 'in_app'
      AND status = 'sent'
      AND read_at IS NULL
    `,
    [userId]
  );

  return Number(rows[0]?.count ?? 0);
}

export async function markNotificationRead(input: {
  deliveryId: string;
  userId: string;
}): Promise<NotificationInboxRow | null> {
  const { rows } = await db.query<NotificationInboxRow>(
    `
    WITH updated AS (
      UPDATE public.notification_deliveries
      SET
        read_at = COALESCE(read_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
        AND recipient_user_id = $2
        AND channel = 'in_app'
      RETURNING *
    )
    SELECT
      d.id::text AS "deliveryId",
      e.id::text AS "eventId",
      e.event_type AS "eventType",
      e.module,
      e.entity_type AS "entityType",
      e.entity_id AS "entityId",
      e.actor_user_id::text AS "actorUserId",
      e.target_user_id::text AS "targetUserId",
      e.title,
      e.message,
      e.priority,
      e.payload,
      d.channel,
      d.status,
      d.read_at AS "readAt",
      d.delivered_at AS "deliveredAt",
      d.created_at AS "createdAt"
    FROM updated d
    INNER JOIN public.notification_events e
      ON e.id = d.notification_event_id
    LIMIT 1
    `,
    [input.deliveryId, input.userId]
  );

  return rows[0] ?? null;
}

export async function markAllNotificationsRead(input: {
  userId: string;
}): Promise<{ updatedCount: number }> {
  const res = await db.query(
    `
    UPDATE public.notification_deliveries
    SET
      read_at = NOW(),
      updated_at = NOW()
    WHERE recipient_user_id = $1
      AND channel = 'in_app'
      AND status = 'sent'
      AND read_at IS NULL
    `,
    [input.userId]
  );

  return { updatedCount: res.rowCount ?? 0 };
}