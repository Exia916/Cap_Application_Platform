import { db } from "@/lib/db";
import type {
  NotificationChannel,
  NotificationPriority,
} from "@/lib/repositories/notificationEventsRepo";

export type NotificationDefinitionRow = {
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

export type UpsertNotificationDefinitionInput = {
  eventType: string;
  module?: string | null;
  description?: string | null;
  isActive?: boolean;
  defaultPriority?: NotificationPriority;
  titleTemplate: string;
  messageTemplate?: string | null;
  channels?: NotificationChannel[];
  updatedBy?: string | null;
};

function normalizeChannels(channels?: NotificationChannel[] | null): NotificationChannel[] {
  const allowed = new Set<NotificationChannel>(["in_app", "email"]);
  const input = channels?.length ? channels : ["in_app"];
  const out: NotificationChannel[] = [];

  for (const channel of input) {
    if (!allowed.has(channel)) continue;
    if (!out.includes(channel)) out.push(channel);
  }

  return out.length ? out : ["in_app"];
}

function selectSql() {
  return `
    SELECT
      id::text AS "id",
      event_type AS "eventType",
      module,
      description,
      is_active AS "isActive",
      default_priority AS "defaultPriority",
      title_template AS "titleTemplate",
      message_template AS "messageTemplate",
      channels,
      created_at AS "createdAt",
      created_by::text AS "createdBy",
      updated_at AS "updatedAt",
      updated_by::text AS "updatedBy"
    FROM public.platform_notification_definitions
  `;
}

export async function getNotificationDefinitionByEventType(
  eventType: string
): Promise<NotificationDefinitionRow | null> {
  const event = String(eventType ?? "").trim();

  if (!event) return null;

  const { rows } = await db.query<NotificationDefinitionRow>(
    `
    ${selectSql()}
    WHERE event_type = $1
    LIMIT 1
    `,
    [event]
  );

  return rows[0] ?? null;
}

export async function listNotificationDefinitions(): Promise<NotificationDefinitionRow[]> {
  const { rows } = await db.query<NotificationDefinitionRow>(
    `
    ${selectSql()}
    ORDER BY module ASC, event_type ASC
    `
  );

  return rows;
}

export async function upsertNotificationDefinition(
  input: UpsertNotificationDefinitionInput
): Promise<NotificationDefinitionRow> {
  const eventType = String(input.eventType ?? "").trim();
  const titleTemplate = String(input.titleTemplate ?? "").trim();

  if (!eventType) {
    throw new Error("eventType is required.");
  }

  if (!titleTemplate) {
    throw new Error("titleTemplate is required.");
  }

  const channels = normalizeChannels(input.channels);

  const { rows } = await db.query<NotificationDefinitionRow>(
    `
    INSERT INTO public.platform_notification_definitions (
      event_type,
      module,
      description,
      is_active,
      default_priority,
      title_template,
      message_template,
      channels,
      updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9)
    ON CONFLICT (event_type)
    DO UPDATE SET
      module = EXCLUDED.module,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      default_priority = EXCLUDED.default_priority,
      title_template = EXCLUDED.title_template,
      message_template = EXCLUDED.message_template,
      channels = EXCLUDED.channels,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING
      id::text AS "id",
      event_type AS "eventType",
      module,
      description,
      is_active AS "isActive",
      default_priority AS "defaultPriority",
      title_template AS "titleTemplate",
      message_template AS "messageTemplate",
      channels,
      created_at AS "createdAt",
      created_by::text AS "createdBy",
      updated_at AS "updatedAt",
      updated_by::text AS "updatedBy"
    `,
    [
      eventType,
      String(input.module ?? "platform").trim() || "platform",
      input.description ?? null,
      input.isActive ?? true,
      input.defaultPriority ?? "normal",
      titleTemplate,
      input.messageTemplate ?? null,
      channels,
      input.updatedBy ?? null,
    ]
  );

  return rows[0]!;
}