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

export type UpdateNotificationDefinitionInput = {
  id: string;
  module?: string | null;
  description?: string | null;
  isActive?: boolean;
  defaultPriority?: NotificationPriority;
  titleTemplate?: string;
  messageTemplate?: string | null;
  channels?: NotificationChannel[];
  updatedBy?: string | null;
};

const VALID_PRIORITIES = new Set<NotificationPriority>([
  "low",
  "normal",
  "high",
  "urgent",
]);

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const s = cleanText(value);
  return s || null;
}

function normalizePriority(value: unknown): NotificationPriority {
  const s = cleanText(value).toLowerCase() as NotificationPriority;
  return VALID_PRIORITIES.has(s) ? s : "normal";
}

function normalizeChannels(channels?: NotificationChannel[] | null): NotificationChannel[] {
  const allowed = new Set<NotificationChannel>(["in_app", "email"]);
  const input = Array.isArray(channels) && channels.length ? channels : ["in_app"];
  const out: NotificationChannel[] = [];

  for (const raw of input) {
    const channel = cleanText(raw).toLowerCase() as NotificationChannel;
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
  const event = cleanText(eventType);

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

export async function getNotificationDefinitionById(
  id: string
): Promise<NotificationDefinitionRow | null> {
  const cleanId = cleanText(id);

  if (!cleanId) return null;

  const { rows } = await db.query<NotificationDefinitionRow>(
    `
    ${selectSql()}
    WHERE id = $1::bigint
    LIMIT 1
    `,
    [cleanId]
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
  const eventType = cleanText(input.eventType);
  const titleTemplate = cleanText(input.titleTemplate);

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
      created_by,
      updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9,$9)
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
      cleanText(input.module) || "platform",
      nullableText(input.description),
      input.isActive ?? true,
      normalizePriority(input.defaultPriority),
      titleTemplate,
      nullableText(input.messageTemplate),
      channels,
      input.updatedBy ?? null,
    ]
  );

  return rows[0]!;
}

export async function updateNotificationDefinitionById(
  input: UpdateNotificationDefinitionInput
): Promise<NotificationDefinitionRow | null> {
  const existing = await getNotificationDefinitionById(input.id);

  if (!existing) {
    return null;
  }

  const nextModule =
    input.module === undefined ? existing.module : cleanText(input.module) || "platform";

  const nextDescription =
    input.description === undefined ? existing.description : nullableText(input.description);

  const nextIsActive =
    input.isActive === undefined ? existing.isActive : !!input.isActive;

  const nextDefaultPriority =
    input.defaultPriority === undefined
      ? existing.defaultPriority
      : normalizePriority(input.defaultPriority);

  const nextTitleTemplate =
    input.titleTemplate === undefined
      ? existing.titleTemplate
      : cleanText(input.titleTemplate);

  if (!nextTitleTemplate) {
    throw new Error("titleTemplate is required.");
  }

  const nextMessageTemplate =
    input.messageTemplate === undefined
      ? existing.messageTemplate
      : nullableText(input.messageTemplate);

  const nextChannels =
    input.channels === undefined
      ? existing.channels
      : normalizeChannels(input.channels);

  const { rows } = await db.query<NotificationDefinitionRow>(
    `
    UPDATE public.platform_notification_definitions
    SET
      module = $2,
      description = $3,
      is_active = $4,
      default_priority = $5,
      title_template = $6,
      message_template = $7,
      channels = $8::text[],
      updated_at = NOW(),
      updated_by = $9
    WHERE id = $1::bigint
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
      input.id,
      nextModule,
      nextDescription,
      nextIsActive,
      nextDefaultPriority,
      nextTitleTemplate,
      nextMessageTemplate,
      nextChannels,
      input.updatedBy ?? null,
    ]
  );

  return rows[0] ?? null;
}
