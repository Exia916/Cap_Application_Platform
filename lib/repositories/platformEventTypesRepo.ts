import { db } from "@/lib/db";

export type PlatformEventTypeRow = {
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

export type ListPlatformEventTypesArgs = {
  q?: string | null;
  module?: string | null;
  eventGroup?: string | null;
  activeOnly?: boolean;
};

export type CreatePlatformEventTypeInput = {
  module: string;
  eventType: string;
  eventLabel: string;
  eventDescription?: string | null;
  eventGroup?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type UpdatePlatformEventTypeInput = {
  id: string;
  eventLabel: string;
  eventDescription?: string | null;
  eventGroup?: string | null;
  sortOrder?: number | null;
  isActive?: boolean;
  updatedBy?: string | null;
};

const EVENT_TYPE_RE = /^[a-z0-9][a-z0-9_.:-]*$/;
const MODULE_RE = /^[a-z0-9][a-z0-9_-]*$/;

function selectSql() {
  return `
    SELECT
      id::text AS "id",
      module,
      event_type AS "eventType",
      event_label AS "eventLabel",
      event_description AS "eventDescription",
      event_group AS "eventGroup",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by::text AS "createdBy",
      updated_at AS "updatedAt",
      updated_by::text AS "updatedBy"
    FROM public.platform_event_types
  `;
}

function cleanNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function cleanRequiredText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function normalizeModule(value: unknown): string {
  const module = cleanRequiredText(value, "Module").toLowerCase();

  if (!MODULE_RE.test(module)) {
    throw new Error("Module may only contain lowercase letters, numbers, underscores, or dashes.");
  }

  return module;
}

function normalizeEventType(value: unknown): string {
  const eventType = cleanRequiredText(value, "Event Type").toLowerCase();

  if (!EVENT_TYPE_RE.test(eventType)) {
    throw new Error(
      "Event Type may only contain lowercase letters, numbers, dots, underscores, dashes, or colons."
    );
  }

  return eventType;
}

function normalizeSortOrder(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  const n = Number(value);
  if (!Number.isFinite(n)) return 0;

  return Math.trunc(n);
}

function normalizeGroup(value: unknown): string {
  return String(value ?? "general").trim() || "general";
}

function isActiveValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return value == null ? true : Boolean(value);
}

export async function listPlatformEventTypes(
  args: ListPlatformEventTypesArgs = {}
): Promise<PlatformEventTypeRow[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (args.activeOnly === true) {
    where.push("is_active = true");
  }

  const module = String(args.module ?? "").trim();
  if (module) {
    params.push(module.toLowerCase());
    where.push(`module = $${params.length}`);
  }

  const eventGroup = String(args.eventGroup ?? "").trim();
  if (eventGroup) {
    params.push(eventGroup);
    where.push(`event_group = $${params.length}`);
  }

  const q = String(args.q ?? "").trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;

    where.push(`
      (
        module ILIKE ${p}
        OR event_type ILIKE ${p}
        OR event_label ILIKE ${p}
        OR COALESCE(event_description, '') ILIKE ${p}
        OR event_group ILIKE ${p}
      )
    `);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await db.query<PlatformEventTypeRow>(
    `
    ${selectSql()}
    ${whereSql}
    ORDER BY
      module ASC,
      event_group ASC,
      sort_order ASC,
      event_label ASC,
      id ASC
    `,
    params
  );

  return rows;
}

export async function getPlatformEventTypeById(
  id: string
): Promise<PlatformEventTypeRow | null> {
  const { rows } = await db.query<PlatformEventTypeRow>(
    `
    ${selectSql()}
    WHERE id = $1::bigint
    LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

export async function createPlatformEventType(
  input: CreatePlatformEventTypeInput
): Promise<PlatformEventTypeRow> {
  const module = normalizeModule(input.module);
  const eventType = normalizeEventType(input.eventType);
  const eventLabel = cleanRequiredText(input.eventLabel, "Event Label");
  const eventGroup = normalizeGroup(input.eventGroup);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const isActive = isActiveValue(input.isActive);

  const { rows } = await db.query<PlatformEventTypeRow>(
    `
    INSERT INTO public.platform_event_types (
      module,
      event_type,
      event_label,
      event_description,
      event_group,
      sort_order,
      is_active,
      created_by,
      updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING
      id::text AS "id",
      module,
      event_type AS "eventType",
      event_label AS "eventLabel",
      event_description AS "eventDescription",
      event_group AS "eventGroup",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by::text AS "createdBy",
      updated_at AS "updatedAt",
      updated_by::text AS "updatedBy"
    `,
    [
      module,
      eventType,
      eventLabel,
      cleanNullableText(input.eventDescription),
      eventGroup,
      sortOrder,
      isActive,
      input.createdBy ?? null,
      input.updatedBy ?? input.createdBy ?? null,
    ]
  );

  return rows[0]!;
}

export async function updatePlatformEventType(
  input: UpdatePlatformEventTypeInput
): Promise<PlatformEventTypeRow | null> {
  const eventLabel = cleanRequiredText(input.eventLabel, "Event Label");
  const eventGroup = normalizeGroup(input.eventGroup);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const isActive = isActiveValue(input.isActive);

  const { rows } = await db.query<PlatformEventTypeRow>(
    `
    UPDATE public.platform_event_types
    SET
      event_label = $2,
      event_description = $3,
      event_group = $4,
      sort_order = $5,
      is_active = $6,
      updated_at = NOW(),
      updated_by = $7
    WHERE id = $1::bigint
    RETURNING
      id::text AS "id",
      module,
      event_type AS "eventType",
      event_label AS "eventLabel",
      event_description AS "eventDescription",
      event_group AS "eventGroup",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by::text AS "createdBy",
      updated_at AS "updatedAt",
      updated_by::text AS "updatedBy"
    `,
    [
      input.id,
      eventLabel,
      cleanNullableText(input.eventDescription),
      eventGroup,
      sortOrder,
      isActive,
      input.updatedBy ?? null,
    ]
  );

  return rows[0] ?? null;
}

export async function setPlatformEventTypeActive(input: {
  id: string;
  isActive: boolean;
  updatedBy?: string | null;
}): Promise<PlatformEventTypeRow | null> {
  const { rows } = await db.query<PlatformEventTypeRow>(
    `
    UPDATE public.platform_event_types
    SET
      is_active = $2,
      updated_at = NOW(),
      updated_by = $3
    WHERE id = $1::bigint
    RETURNING
      id::text AS "id",
      module,
      event_type AS "eventType",
      event_label AS "eventLabel",
      event_description AS "eventDescription",
      event_group AS "eventGroup",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by::text AS "createdBy",
      updated_at AS "updatedAt",
      updated_by::text AS "updatedBy"
    `,
    [input.id, input.isActive, input.updatedBy ?? null]
  );

  return rows[0] ?? null;
}