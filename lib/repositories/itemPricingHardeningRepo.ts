// lib/repositories/itemPricingHardeningRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import {
  ITEM_PRICING_ENTITY_TYPES,
  ITEM_PRICING_MODULE_NAME,
  PRICE_BOOK_STATUSES,
} from "@/lib/itemPricing/constants";
import type { ItemPricingPriceBook, PriceBookStatus } from "@/lib/itemPricing/types";

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanRequiredText(value: unknown, label: string): string {
  const s = cleanText(value);
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function cleanCode(value: unknown, label: string): string {
  return cleanRequiredText(value, label).toUpperCase().replace(/[\s\-]+/g, "_");
}

function cleanStatus(value: unknown): PriceBookStatus {
  const status = cleanCode(value, "Status") as PriceBookStatus;
  if (!(PRICE_BOOK_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid price book status.");
  return status;
}

function cleanNullableDate(value: unknown, label: string): string | null {
  const s = cleanText(value);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${label} must be in YYYY-MM-DD format.`);
  return s;
}


function cleanLimit(value: unknown): number {
  const n = Number(value ?? 25);
  if (!Number.isInteger(n) || n <= 0) return 25;
  return Math.min(n, 250);
}

function cleanOffset(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

function cleanSortDir(value: unknown): "asc" | "desc" {
  return String(value || "asc").toLowerCase() === "desc" ? "desc" : "asc";
}

function pageResult<T>(rows: T[], total: number, limit: number, offset: number) {
  return { rows, total, pageSize: limit, offset };
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function userName(input: { changedBy?: string | null }) {
  return cleanText(input.changedBy) || "Unknown User";
}

function changedByUserId(input: { changedByUserId?: string | null }) {
  return cleanText(input.changedByUserId);
}

function changedByEmployeeNumber(input: { changedByEmployeeNumber?: number | string | null }) {
  const raw = input.changedByEmployeeNumber;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

async function logHardeningActivity(input: {
  entityType: string;
  entityId: string;
  eventType: string;
  message: string;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
  previousValue?: unknown;
  newValue?: unknown;
  fieldName?: string | null;
}) {
  await createActivityHistory({
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    fieldName: input.fieldName ?? null,
    previousValue: input.previousValue,
    newValue: input.newValue,
    message: input.message,
    module: ITEM_PRICING_MODULE_NAME,
    userId: changedByUserId(input),
    userName: userName(input),
    employeeNumber: changedByEmployeeNumber(input),
  });
}

function priceBookSelectSql() {
  return `
    SELECT
      pb.id,
      pb.code,
      pb.name,
      pb.description,
      pb.status,
      pb.effective_date AS "effectiveDate",
      pb.expiration_date AS "expirationDate",
      pb.is_default AS "isDefault",
      COALESCE(base_counts.item_count, 0)::int AS "itemCount",
      pb.created_at AS "createdAt",
      pb.created_by AS "createdBy",
      pb.updated_at AS "updatedAt",
      pb.updated_by AS "updatedBy",
      pb.is_voided AS "isVoided",
      pb.voided_at AS "voidedAt",
      pb.voided_by AS "voidedBy",
      pb.void_reason AS "voidReason",
      pb.review_requested_at AS "reviewRequestedAt",
      pb.review_requested_by AS "reviewRequestedBy",
      pb.published_at AS "publishedAt",
      pb.published_by AS "publishedBy",
      pb.archived_at AS "archivedAt",
      pb.archived_by AS "archivedBy",
      pb.default_set_at AS "defaultSetAt",
      pb.default_set_by AS "defaultSetBy",
      pb.last_validated_at AS "lastValidatedAt",
      pb.last_validation_status AS "lastValidationStatus",
      pb.last_validation_error_count AS "lastValidationErrorCount",
      pb.last_validation_warning_count AS "lastValidationWarningCount"
    FROM public.item_pricing_price_books pb
    LEFT JOIN (
      SELECT price_book_id, COUNT(DISTINCT item_id)::int AS item_count
      FROM public.item_pricing_item_base_prices
      GROUP BY price_book_id
    ) base_counts ON base_counts.price_book_id = pb.id
  `;
}


export async function listItemPricingPriceBooksForHardening(options: {
  q?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
  sortBy?: string | null;
  sortDir?: string | null;
  includeVoided?: boolean | string | null;
} = {}) {
  const params: any[] = [];
  const where: string[] = [];
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);

  if (!cleanBool(options.includeVoided, false)) {
    where.push(`pb.is_voided = false`);
  }

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(pb.code ILIKE $${params.length} OR pb.name ILIKE $${params.length} OR COALESCE(pb.description, '') ILIKE $${params.length} OR pb.status ILIKE $${params.length})`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortMap: Record<string, string> = {
    code: "pb.code",
    name: "pb.name",
    status: "pb.status",
    effectiveDate: "pb.effective_date",
    expirationDate: "pb.expiration_date",
    updatedAt: "pb.updated_at",
    itemCount: "base_counts.item_count",
    validation: "pb.last_validation_status",
  };
  const sortColumn = sortMap[String(options.sortBy || "updatedAt")] || "pb.updated_at";
  const sortDir = cleanSortDir(options.sortDir);

  const count = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.item_pricing_price_books pb
    ${sqlWhere}
    `,
    params
  );

  params.push(limit, offset);
  const { rows } = await db.query<ItemPricingPriceBook>(
    `
    ${priceBookSelectSql()}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, pb.updated_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function getItemPricingPriceBookForHardening(id: string): Promise<ItemPricingPriceBook | null> {
  const cleanId = cleanRequiredText(id, "Price Book");
  const { rows } = await db.query<ItemPricingPriceBook>(
    `
    ${priceBookSelectSql()}
    WHERE pb.id = $1
    LIMIT 1
    `,
    [cleanId]
  );
  return rows[0] ?? null;
}

export async function updateItemPricingPriceBookLifecycle(input: {
  id: string;
  status: string;
  notes?: string | null;
  setDefault?: boolean | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
}): Promise<ItemPricingPriceBook> {
  const id = cleanRequiredText(input.id, "Price Book");
  const status = cleanStatus(input.status);
  const changedBy = userName(input);
  const setDefault = cleanBool(input.setDefault, status === "PUBLISHED");

  const before = await getItemPricingPriceBookForHardening(id);
  if (!before) throw new Error("Price book not found.");
  if ((before as any).isVoided) throw new Error("Voided price books cannot be updated.");

  if (status === "PUBLISHED") {
    const lastValidationStatus = String((before as any).lastValidationStatus || "").toUpperCase();
    const lastErrorCount = Number((before as any).lastValidationErrorCount || 0);
    const lastValidatedAt = cleanText((before as any).lastValidatedAt);

    if (!lastValidatedAt) throw new Error("Run foundation validation before publishing this price book.");
    if (lastValidationStatus === "FAILED" || lastErrorCount > 0) {
      throw new Error("This price book has validation errors and cannot be published.");
    }
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (status === "PUBLISHED" && setDefault) {
      await client.query(
        `
        UPDATE public.item_pricing_price_books
        SET is_default = false,
            updated_at = now(),
            updated_by = $2
        WHERE id <> $1
          AND is_default = true
        `,
        [id, changedBy]
      );
    }

    await client.query(
      `
      UPDATE public.item_pricing_price_books
      SET status = $2,
          is_default = CASE WHEN $2 = 'PUBLISHED' AND $3::boolean THEN true ELSE is_default END,
          review_requested_at = CASE WHEN $2 = 'REVIEW' THEN now() ELSE review_requested_at END,
          review_requested_by = CASE WHEN $2 = 'REVIEW' THEN $4 ELSE review_requested_by END,
          published_at = CASE WHEN $2 = 'PUBLISHED' THEN now() ELSE published_at END,
          published_by = CASE WHEN $2 = 'PUBLISHED' THEN $4 ELSE published_by END,
          archived_at = CASE WHEN $2 = 'ARCHIVED' THEN now() ELSE archived_at END,
          archived_by = CASE WHEN $2 = 'ARCHIVED' THEN $4 ELSE archived_by END,
          default_set_at = CASE WHEN $2 = 'PUBLISHED' AND $3::boolean THEN now() ELSE default_set_at END,
          default_set_by = CASE WHEN $2 = 'PUBLISHED' AND $3::boolean THEN $4 ELSE default_set_by END,
          updated_at = now(),
          updated_by = $4
      WHERE id = $1
      `,
      [id, status, setDefault, changedBy]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const after = await getItemPricingPriceBookForHardening(id);
  if (!after) throw new Error("Failed to reload price book.");

  await logHardeningActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceBook,
    entityId: id,
    eventType: "status_changed",
    fieldName: "status",
    message: `Price book status changed from ${before.status} to ${after.status}.${cleanText(input.notes) ? ` Notes: ${cleanText(input.notes)}` : ""}`,
    previousValue: before,
    newValue: after,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
  });

  return after;
}

export async function duplicateItemPricingPriceBook(input: {
  sourcePriceBookId: string;
  code: string;
  name: string;
  description?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
}): Promise<ItemPricingPriceBook> {
  const sourcePriceBookId = cleanRequiredText(input.sourcePriceBookId, "Source Price Book");
  const code = cleanCode(input.code, "New Price Book Code");
  const name = cleanRequiredText(input.name, "New Price Book Name");
  const changedBy = userName(input);
  const effectiveDate = cleanNullableDate(input.effectiveDate, "Effective Date");
  const expirationDate = cleanNullableDate(input.expirationDate, "Expiration Date");

  const source = await getItemPricingPriceBookForHardening(sourcePriceBookId);
  if (!source) throw new Error("Source price book not found.");
  if ((source as any).isVoided) throw new Error("Voided price books cannot be duplicated.");

  const client = await db.connect();
  let newId: string | null = null;

  try {
    await client.query("BEGIN");

    const duplicateCheck = await client.query<{ id: string }>(
      `SELECT id FROM public.item_pricing_price_books WHERE upper(code) = upper($1) LIMIT 1`,
      [code]
    );
    if (duplicateCheck.rows[0]) throw new Error("A price book with this code already exists.");

    const inserted = await client.query<{ id: string }>(
      `
      INSERT INTO public.item_pricing_price_books (
        code,
        name,
        description,
        status,
        effective_date,
        expiration_date,
        is_default,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, 'DRAFT', $4, $5, false, $6, $6)
      RETURNING id
      `,
      [code, name, cleanText(input.description) ?? source.description ?? null, effectiveDate, expirationDate, changedBy]
    );

    newId = inserted.rows[0].id;

    await client.query(
      `
      INSERT INTO public.item_pricing_item_base_prices (
        price_book_id,
        item_id,
        blank_eqp_price,
        source_file_name,
        source_sheet_name,
        source_row_number,
        notes,
        created_by,
        updated_by
      )
      SELECT
        $2,
        item_id,
        blank_eqp_price,
        source_file_name,
        source_sheet_name,
        source_row_number,
        notes,
        $3,
        $3
      FROM public.item_pricing_item_base_prices
      WHERE price_book_id = $1
      `,
      [sourcePriceBookId, newId, changedBy]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (!newId) throw new Error("Failed to create duplicate price book.");
  const created = await getItemPricingPriceBookForHardening(newId);
  if (!created) throw new Error("Failed to reload duplicate price book.");

  await logHardeningActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceBook,
    entityId: newId,
    eventType: "created",
    message: `Price book ${created.code} duplicated from ${source.code}.`,
    previousValue: source,
    newValue: created,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
  });

  return created;
}
