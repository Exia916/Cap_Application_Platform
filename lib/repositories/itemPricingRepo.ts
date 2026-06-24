// lib/repositories/itemPricingRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import {
  ITEM_PRICING_ENTITY_TYPES,
  ITEM_PRICING_MODULE_NAME,
  ITEM_PRICING_SPECIAL_ITEM_CODES,
  PRICE_BOOK_STATUSES,
} from "@/lib/itemPricing/constants";
import { calculateBaseItemPrices, assertCalculationSucceeded } from "@/lib/itemPricing/itemPricingCalculationService";
import type {
  ItemPricingBasePrice,
  ItemPricingBasePriceInput,
  ItemPricingCalculationPreviewInput,
  ItemPricingCalculationResult,
  ItemPricingItem,
  ItemPricingItemInput,
  ItemPricingListOptions,
  ItemPricingPriceBook,
  ItemPricingPriceBookInput,
  ItemPricingRuleRow,
  ItemPricingRuleSet,
  ItemPricingRuleSetDetail,
  ItemPricingRuleSetInput,
  PagedResult,
  PriceBookStatus,
  SortDir,
} from "@/lib/itemPricing/types";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

type IdInput = string | number | null | undefined;

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
  return cleanRequiredText(value, label).toUpperCase().replace(/\s+/g, "_");
}

function cleanNullableDate(value: unknown, label: string): string | null {
  const s = cleanText(value);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${label} must be in YYYY-MM-DD format.`);
  return s;
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function cleanNullableBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  return cleanBool(value);
}

function cleanPositiveInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} must be a valid lookup value.`);
  return n;
}

function cleanInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return n;
}

function cleanMoney(value: unknown, label: string): number {
  if (value === null || value === undefined || value === "") throw new Error(`${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number.`);
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function money2(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

function cleanSortDir(value: unknown): SortDir {
  return String(value || "asc").toLowerCase() === "desc" ? "desc" : "asc";
}

function cleanStatus(value: unknown): PriceBookStatus {
  const s = cleanCode(value || "DRAFT", "Status") as PriceBookStatus;
  if (!(PRICE_BOOK_STATUSES as readonly string[]).includes(s)) {
    throw new Error("Invalid price book status.");
  }
  return s;
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

async function logActivity(input: {
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

async function resolveRuleSetId(queryable: Queryable, input: ItemPricingItemInput): Promise<number> {
  const byId = cleanPositiveInt(input.ruleSetId, "Rule Set");
  if (byId != null) {
    const found = await queryable.query<{ id: number }>(
      `SELECT id FROM public.item_pricing_rule_sets WHERE id = $1 LIMIT 1`,
      [byId]
    );
    if (!found.rows[0]) throw new Error("Invalid rule set.");
    return found.rows[0].id;
  }

  const code = cleanText(input.ruleSetCode);
  if (!code) throw new Error("Rule Set is required.");

  const found = await queryable.query<{ id: number }>(
    `SELECT id FROM public.item_pricing_rule_sets WHERE upper(code) = upper($1) LIMIT 1`,
    [code]
  );

  if (!found.rows[0]) throw new Error("Invalid rule set.");
  return found.rows[0].id;
}

async function resolveDefaultPriceBookId(queryable: Queryable): Promise<string> {
  const { rows } = await queryable.query<{ id: string }>(
    `
    SELECT id
    FROM public.item_pricing_price_books
    WHERE is_voided = false
    ORDER BY is_default DESC, effective_date DESC NULLS LAST, created_at DESC
    LIMIT 1
    `
  );

  if (!rows[0]) throw new Error("No item pricing price book exists. Run the Phase 1 migration first.");
  return rows[0].id;
}

async function resolvePriceBookId(queryable: Queryable, id?: string | null): Promise<string> {
  const clean = cleanText(id);
  if (!clean) return resolveDefaultPriceBookId(queryable);

  const { rows } = await queryable.query<{ id: string }>(
    `SELECT id FROM public.item_pricing_price_books WHERE id = $1 AND is_voided = false LIMIT 1`,
    [clean]
  );

  if (!rows[0]) throw new Error("Invalid price book.");
  return rows[0].id;
}

async function resolveItemId(queryable: Queryable, input: { itemId?: string | null; itemCode?: string | null }): Promise<string> {
  const itemId = cleanText(input.itemId);
  if (itemId) {
    const { rows } = await queryable.query<{ id: string }>(
      `SELECT id FROM public.item_pricing_items WHERE id = $1 AND is_voided = false LIMIT 1`,
      [itemId]
    );
    if (!rows[0]) throw new Error("Invalid item.");
    return rows[0].id;
  }

  const itemCode = cleanText(input.itemCode);
  if (!itemCode) throw new Error("Item is required.");

  const { rows } = await queryable.query<{ id: string }>(
    `SELECT id FROM public.item_pricing_items WHERE upper(item_code) = upper($1) AND is_voided = false LIMIT 1`,
    [itemCode]
  );

  if (!rows[0]) throw new Error("Invalid item.");
  return rows[0].id;
}

function pageResult<T>(rows: T[], total: number, limit: number, offset: number): PagedResult<T> {
  return { rows, total, pageSize: limit, offset };
}

/* -------------------------------------------------------------------------- */
/* Price books                                                                 */
/* -------------------------------------------------------------------------- */

const PRICE_BOOK_SORT_COLUMNS: Record<string, string> = {
  code: "pb.code",
  name: "pb.name",
  status: "pb.status",
  effectiveDate: "pb.effective_date",
  expirationDate: "pb.expiration_date",
  updatedAt: "pb.updated_at",
  itemCount: "base_counts.item_count",
};

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
      pb.created_at AS "createdAt",
      pb.created_by AS "createdBy",
      pb.updated_at AS "updatedAt",
      pb.updated_by AS "updatedBy",
      pb.is_voided AS "isVoided",
      pb.voided_at AS "voidedAt",
      pb.voided_by AS "voidedBy",
      pb.void_reason AS "voidReason",
      COALESCE(base_counts.item_count, 0)::int AS "itemCount"
    FROM public.item_pricing_price_books pb
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS item_count
      FROM public.item_pricing_item_base_prices bp
      WHERE bp.price_book_id = pb.id
    ) base_counts ON true
  `;
}

export async function listItemPricingPriceBooks(
  options: ItemPricingListOptions = {}
): Promise<PagedResult<ItemPricingPriceBook>> {
  const where: string[] = [];
  const params: any[] = [];
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);

  if (!cleanBool(options.includeVoided, false)) where.push("pb.is_voided = false");

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(pb.code ILIKE $${params.length} OR pb.name ILIKE $${params.length} OR COALESCE(pb.description, '') ILIKE $${params.length})`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortColumn = PRICE_BOOK_SORT_COLUMNS[String(options.sortBy || "updatedAt")] || "pb.updated_at";
  const sortDir = cleanSortDir(options.sortDir);

  const count = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.item_pricing_price_books pb ${sqlWhere}`,
    params
  );

  params.push(limit, offset);

  const { rows } = await db.query<ItemPricingPriceBook>(
    `
    ${priceBookSelectSql()}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, pb.code ASC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function getItemPricingPriceBook(id: IdInput): Promise<ItemPricingPriceBook | null> {
  const cleanId = cleanRequiredText(id, "Price Book");
  const { rows } = await db.query<ItemPricingPriceBook>(
    `${priceBookSelectSql()} WHERE pb.id = $1 LIMIT 1`,
    [cleanId]
  );
  return rows[0] ?? null;
}

export async function createItemPricingPriceBook(input: ItemPricingPriceBookInput): Promise<ItemPricingPriceBook> {
  const code = cleanCode(input.code, "Code");
  const name = cleanRequiredText(input.name, "Name");
  const status = cleanStatus(input.status);
  const description = cleanText(input.description);
  const effectiveDate = cleanNullableDate(input.effectiveDate, "Effective Date");
  const expirationDate = cleanNullableDate(input.expirationDate, "Expiration Date");
  const isDefault = cleanBool(input.isDefault, false);
  const changedBy = userName(input);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (isDefault) {
      await client.query(`UPDATE public.item_pricing_price_books SET is_default = false WHERE is_default = true`);
    }

    const { rows } = await client.query<{ id: string }>(
      `
      INSERT INTO public.item_pricing_price_books (
        code, name, description, status, effective_date, expiration_date,
        is_default, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING id
      `,
      [code, name, description, status, effectiveDate, expirationDate, isDefault, changedBy]
    );

    await client.query("COMMIT");

    const created = await getItemPricingPriceBook(rows[0].id);
    if (!created) throw new Error("Failed to reload created price book.");

    await logActivity({
      entityType: ITEM_PRICING_ENTITY_TYPES.priceBook,
      entityId: created.id,
      eventType: "created",
      message: `Price book ${created.code} created.`,
      changedBy: input.changedBy,
      changedByUserId: input.changedByUserId,
      changedByEmployeeNumber: input.changedByEmployeeNumber,
      newValue: created,
    });

    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateItemPricingPriceBook(
  id: IdInput,
  input: ItemPricingPriceBookInput
): Promise<ItemPricingPriceBook> {
  const existing = await getItemPricingPriceBook(id);
  if (!existing) throw new Error("Price book not found.");
  if (existing.isVoided) throw new Error("Voided price books cannot be edited.");

  const code = input.code === undefined ? existing.code : cleanCode(input.code, "Code");
  const name = input.name === undefined ? existing.name : cleanRequiredText(input.name, "Name");
  const status = input.status === undefined ? existing.status : cleanStatus(input.status);
  const description = input.description === undefined ? existing.description : cleanText(input.description);
  const effectiveDate = input.effectiveDate === undefined ? existing.effectiveDate : cleanNullableDate(input.effectiveDate, "Effective Date");
  const expirationDate = input.expirationDate === undefined ? existing.expirationDate : cleanNullableDate(input.expirationDate, "Expiration Date");
  const isDefault = input.isDefault === undefined ? existing.isDefault : cleanBool(input.isDefault, existing.isDefault);
  const changedBy = userName(input);

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    if (isDefault) {
      await client.query(
        `UPDATE public.item_pricing_price_books SET is_default = false WHERE is_default = true AND id <> $1`,
        [existing.id]
      );
    }

    await client.query(
      `
      UPDATE public.item_pricing_price_books
      SET code = $2,
          name = $3,
          description = $4,
          status = $5,
          effective_date = $6,
          expiration_date = $7,
          is_default = $8,
          updated_at = now(),
          updated_by = $9
      WHERE id = $1
      `,
      [existing.id, code, name, description, status, effectiveDate, expirationDate, isDefault, changedBy]
    );

    await client.query("COMMIT");

    const updated = await getItemPricingPriceBook(existing.id);
    if (!updated) throw new Error("Failed to reload updated price book.");

    await logActivity({
      entityType: ITEM_PRICING_ENTITY_TYPES.priceBook,
      entityId: updated.id,
      eventType: "updated",
      message: `Price book ${updated.code} updated.`,
      changedBy: input.changedBy,
      changedByUserId: input.changedByUserId,
      changedByEmployeeNumber: input.changedByEmployeeNumber,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/* Rule sets and rules                                                         */
/* -------------------------------------------------------------------------- */

function ruleSetSelectSql() {
  return `
    SELECT
      rs.id,
      rs.code,
      rs.name,
      rs.description,
      rs.allows_blank AS "allowsBlank",
      rs.allows_flat_emb AS "allowsFlatEmb",
      rs.allows_3d_emb AS "allows3dEmb",
      rs.allows_knit_in AS "allowsKnitIn",
      rs.sort_order AS "sortOrder",
      rs.active,
      rs.created_at AS "createdAt",
      rs.created_by AS "createdBy",
      rs.updated_at AS "updatedAt",
      rs.updated_by AS "updatedBy"
    FROM public.item_pricing_rule_sets rs
  `;
}

export async function listItemPricingRuleSets(
  options: ItemPricingListOptions = {}
): Promise<ItemPricingRuleSet[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (!cleanBool(options.includeInactive, false)) where.push("rs.active = true");

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(rs.code ILIKE $${params.length} OR rs.name ILIKE $${params.length} OR COALESCE(rs.description, '') ILIKE $${params.length})`);
  }

  const { rows } = await db.query<ItemPricingRuleSet>(
    `
    ${ruleSetSelectSql()}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY rs.sort_order ASC, rs.name ASC
    `,
    params
  );

  return rows;
}

export async function listItemPricingDecorationMethods() {
  const { rows } = await db.query(
    `
    SELECT
      id,
      code,
      name,
      description,
      sort_order AS "sortOrder",
      active
    FROM public.item_pricing_decoration_methods
    ORDER BY sort_order ASC, name ASC
    `
  );
  return rows;
}

export async function listItemPricingQuantityBreaks() {
  const { rows } = await db.query(
    `
    SELECT
      id,
      code,
      label,
      min_qty AS "minQty",
      max_qty AS "maxQty",
      sort_order AS "sortOrder",
      active
    FROM public.item_pricing_quantity_breaks
    ORDER BY sort_order ASC, min_qty ASC
    `
  );
  return rows;
}

export async function listRuleSetBreakRows(ruleSetId: number): Promise<ItemPricingRuleRow[]> {
  const { rows } = await db.query<ItemPricingRuleRow>(
    `
    SELECT
      rb.id,
      rb.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      rs.name AS "ruleSetName",
      rb.decoration_method_id AS "decorationMethodId",
      dm.code AS "decorationMethodCode",
      dm.name AS "decorationMethodName",
      rb.quantity_break_id AS "quantityBreakId",
      qb.code AS "quantityBreakCode",
      qb.label AS "quantityBreakLabel",
      qb.min_qty AS "minQty",
      qb.max_qty AS "maxQty",
      qb.sort_order AS "quantityBreakSortOrder",
      rb.base_reference AS "baseReference",
      rb.prior_quantity_break_id AS "priorQuantityBreakId",
      pqb.code AS "priorQuantityBreakCode",
      pqb.label AS "priorQuantityBreakLabel",
      rb.adder_amount::float8 AS "adderAmount",
      rb.calculation_order AS "calculationOrder",
      rb.active,
      rb.notes
    FROM public.item_pricing_rule_set_breaks rb
    JOIN public.item_pricing_rule_sets rs ON rs.id = rb.rule_set_id
    JOIN public.item_pricing_decoration_methods dm ON dm.id = rb.decoration_method_id
    JOIN public.item_pricing_quantity_breaks qb ON qb.id = rb.quantity_break_id
    LEFT JOIN public.item_pricing_quantity_breaks pqb ON pqb.id = rb.prior_quantity_break_id
    WHERE rb.rule_set_id = $1
    ORDER BY dm.sort_order ASC, rb.calculation_order ASC, qb.sort_order ASC
    `,
    [ruleSetId]
  );

  return rows;
}

export async function getItemPricingRuleSet(id: IdInput): Promise<ItemPricingRuleSetDetail | null> {
  const numericId = cleanPositiveInt(id, "Rule Set");
  if (numericId == null) return null;

  const { rows } = await db.query<ItemPricingRuleSet>(
    `${ruleSetSelectSql()} WHERE rs.id = $1 LIMIT 1`,
    [numericId]
  );

  const ruleSet = rows[0];
  if (!ruleSet) return null;

  return {
    ...ruleSet,
    ruleRows: await listRuleSetBreakRows(ruleSet.id),
  };
}

export async function updateItemPricingRuleSet(
  id: IdInput,
  input: ItemPricingRuleSetInput
): Promise<ItemPricingRuleSetDetail> {
  const existing = await getItemPricingRuleSet(id);
  if (!existing) throw new Error("Rule set not found.");

  const changedBy = userName(input);

  await db.query(
    `
    UPDATE public.item_pricing_rule_sets
    SET name = $2,
        description = $3,
        allows_blank = $4,
        allows_flat_emb = $5,
        allows_3d_emb = $6,
        allows_knit_in = $7,
        sort_order = $8,
        active = $9,
        updated_at = now(),
        updated_by = $10
    WHERE id = $1
    `,
    [
      existing.id,
      input.name === undefined ? existing.name : cleanRequiredText(input.name, "Name"),
      input.description === undefined ? existing.description : cleanText(input.description),
      input.allowsBlank === undefined ? existing.allowsBlank : cleanBool(input.allowsBlank, existing.allowsBlank),
      input.allowsFlatEmb === undefined ? existing.allowsFlatEmb : cleanBool(input.allowsFlatEmb, existing.allowsFlatEmb),
      input.allows3dEmb === undefined ? existing.allows3dEmb : cleanBool(input.allows3dEmb, existing.allows3dEmb),
      input.allowsKnitIn === undefined ? existing.allowsKnitIn : cleanBool(input.allowsKnitIn, existing.allowsKnitIn),
      input.sortOrder === undefined ? existing.sortOrder : cleanInt(input.sortOrder, existing.sortOrder),
      input.active === undefined ? existing.active : cleanBool(input.active, existing.active),
      changedBy,
    ]
  );

  const updated = await getItemPricingRuleSet(existing.id);
  if (!updated) throw new Error("Failed to reload updated rule set.");

  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.ruleSet,
    entityId: String(updated.id),
    eventType: "updated",
    message: `Rule set ${updated.code} updated.`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    previousValue: existing,
    newValue: updated,
  });

  return updated;
}

/* -------------------------------------------------------------------------- */
/* Items                                                                       */
/* -------------------------------------------------------------------------- */

const ITEM_SORT_COLUMNS: Record<string, string> = {
  itemCode: "i.item_code",
  itemDescription: "i.item_description",
  productFamily: "i.product_family",
  ruleSet: "rs.name",
  active: "i.active",
  updatedAt: "i.updated_at",
  blankEqpPrice: "bp.blank_eqp_price",
};

function itemSelectSql(includeBasePrice = false) {
  return `
    SELECT
      i.id,
      i.item_code AS "itemCode",
      i.item_description AS "itemDescription",
      i.product_family AS "productFamily",
      i.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      rs.name AS "ruleSetName",
      i.active,
      i.allows_blank_override AS "allowsBlankOverride",
      i.allows_flat_emb_override AS "allowsFlatEmbOverride",
      i.allows_3d_emb_override AS "allows3dEmbOverride",
      i.allows_knit_in_override AS "allowsKnitInOverride",
      COALESCE(i.allows_blank_override, rs.allows_blank) AS "allowsBlank",
      COALESCE(i.allows_flat_emb_override, rs.allows_flat_emb) AS "allowsFlatEmb",
      COALESCE(i.allows_3d_emb_override, rs.allows_3d_emb) AS "allows3dEmb",
      COALESCE(i.allows_knit_in_override, rs.allows_knit_in) AS "allowsKnitIn",
      i.notes,
      i.created_at AS "createdAt",
      i.created_by AS "createdBy",
      i.updated_at AS "updatedAt",
      i.updated_by AS "updatedBy",
      i.is_voided AS "isVoided",
      i.voided_at AS "voidedAt",
      i.voided_by AS "voidedBy",
      i.void_reason AS "voidReason"
      ${includeBasePrice ? `, bp.blank_eqp_price::float8 AS "blankEqpPrice"` : ""}
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
  `;
}

export async function listItemPricingItems(
  options: ItemPricingListOptions = {}
): Promise<PagedResult<ItemPricingItem>> {
  const params: any[] = [];
  const where: string[] = [];
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);
  const includeBasePrice = Boolean(cleanText(options.priceBookId));

  if (!cleanBool(options.includeVoided, false)) where.push("i.is_voided = false");
  if (!cleanBool(options.includeInactive, false)) where.push("i.active = true");

  if (includeBasePrice) {
    params.push(options.priceBookId);
  }

  const ruleSetId = cleanPositiveInt(options.ruleSetId, "Rule Set");
  if (ruleSetId != null) {
    params.push(ruleSetId);
    where.push(`i.rule_set_id = $${params.length}`);
  }

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(i.item_code ILIKE $${params.length} OR COALESCE(i.item_description, '') ILIKE $${params.length} OR COALESCE(i.product_family, '') ILIKE $${params.length} OR rs.name ILIKE $${params.length})`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortColumn = ITEM_SORT_COLUMNS[String(options.sortBy || "itemCode")] || "i.item_code";
  const sortDir = cleanSortDir(options.sortDir);

  const joinBase = includeBasePrice
    ? `LEFT JOIN public.item_pricing_item_base_prices bp ON bp.item_id = i.id AND bp.price_book_id = $1`
    : "";

  const count = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    ${joinBase}
    ${sqlWhere}
    `,
    params
  );

  params.push(limit, offset);

  const { rows } = await db.query<ItemPricingItem>(
    `
    ${itemSelectSql(includeBasePrice)}
    ${joinBase}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, i.item_code ASC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function getItemPricingItem(id: IdInput): Promise<ItemPricingItem | null> {
  const cleanId = cleanRequiredText(id, "Item");
  const { rows } = await db.query<ItemPricingItem>(
    `${itemSelectSql(false)} WHERE i.id = $1 LIMIT 1`,
    [cleanId]
  );
  return rows[0] ?? null;
}

export async function createItemPricingItem(input: ItemPricingItemInput): Promise<ItemPricingItem> {
  const itemCode = cleanRequiredText(input.itemCode, "Item Code").toUpperCase();
  const ruleSetId = await resolveRuleSetId(db, input);
  const changedBy = userName(input);
  const allows3dOverride =
    input.allows3dEmbOverride !== undefined
      ? cleanNullableBool(input.allows3dEmbOverride)
      : ITEM_PRICING_SPECIAL_ITEM_CODES.premiumNoThreeD.has(itemCode)
        ? false
        : null;

  const { rows } = await db.query<{ id: string }>(
    `
    INSERT INTO public.item_pricing_items (
      item_code,
      item_description,
      product_family,
      rule_set_id,
      active,
      allows_blank_override,
      allows_flat_emb_override,
      allows_3d_emb_override,
      allows_knit_in_override,
      notes,
      created_by,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
    RETURNING id
    `,
    [
      itemCode,
      cleanText(input.itemDescription),
      cleanText(input.productFamily),
      ruleSetId,
      input.active === undefined ? true : cleanBool(input.active, true),
      cleanNullableBool(input.allowsBlankOverride),
      cleanNullableBool(input.allowsFlatEmbOverride),
      allows3dOverride,
      cleanNullableBool(input.allowsKnitInOverride),
      cleanText(input.notes),
      changedBy,
    ]
  );

  const created = await getItemPricingItem(rows[0].id);
  if (!created) throw new Error("Failed to reload created item.");

  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.item,
    entityId: created.id,
    eventType: "created",
    message: `Item pricing setup created for ${created.itemCode}.`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    newValue: created,
  });

  return created;
}

export async function updateItemPricingItem(id: IdInput, input: ItemPricingItemInput): Promise<ItemPricingItem> {
  const existing = await getItemPricingItem(id);
  if (!existing) throw new Error("Item not found.");
  if (existing.isVoided) throw new Error("Voided items cannot be edited.");

  const ruleSetId = input.ruleSetId !== undefined || input.ruleSetCode !== undefined
    ? await resolveRuleSetId(db, input)
    : existing.ruleSetId;

  const itemCode = input.itemCode === undefined
    ? existing.itemCode
    : cleanRequiredText(input.itemCode, "Item Code").toUpperCase();

  const changedBy = userName(input);

  await db.query(
    `
    UPDATE public.item_pricing_items
    SET item_code = $2,
        item_description = $3,
        product_family = $4,
        rule_set_id = $5,
        active = $6,
        allows_blank_override = $7,
        allows_flat_emb_override = $8,
        allows_3d_emb_override = $9,
        allows_knit_in_override = $10,
        notes = $11,
        updated_at = now(),
        updated_by = $12
    WHERE id = $1
    `,
    [
      existing.id,
      itemCode,
      input.itemDescription === undefined ? existing.itemDescription : cleanText(input.itemDescription),
      input.productFamily === undefined ? existing.productFamily : cleanText(input.productFamily),
      ruleSetId,
      input.active === undefined ? existing.active : cleanBool(input.active, existing.active),
      input.allowsBlankOverride === undefined ? existing.allowsBlankOverride : cleanNullableBool(input.allowsBlankOverride),
      input.allowsFlatEmbOverride === undefined ? existing.allowsFlatEmbOverride : cleanNullableBool(input.allowsFlatEmbOverride),
      input.allows3dEmbOverride === undefined ? existing.allows3dEmbOverride : cleanNullableBool(input.allows3dEmbOverride),
      input.allowsKnitInOverride === undefined ? existing.allowsKnitInOverride : cleanNullableBool(input.allowsKnitInOverride),
      input.notes === undefined ? existing.notes : cleanText(input.notes),
      changedBy,
    ]
  );

  const updated = await getItemPricingItem(existing.id);
  if (!updated) throw new Error("Failed to reload updated item.");

  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.item,
    entityId: updated.id,
    eventType: "updated",
    message: `Item pricing setup updated for ${updated.itemCode}.`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    previousValue: existing,
    newValue: updated,
  });

  return updated;
}

/* -------------------------------------------------------------------------- */
/* Base prices                                                                 */
/* -------------------------------------------------------------------------- */

const BASE_PRICE_SORT_COLUMNS: Record<string, string> = {
  itemCode: "i.item_code",
  itemDescription: "i.item_description",
  ruleSet: "rs.name",
  blankEqpPrice: "bp.blank_eqp_price",
  updatedAt: "bp.updated_at",
};

function basePriceSelectSql() {
  return `
    SELECT
      bp.id,
      bp.price_book_id AS "priceBookId",
      pb.code AS "priceBookCode",
      pb.name AS "priceBookName",
      bp.item_id AS "itemId",
      i.item_code AS "itemCode",
      i.item_description AS "itemDescription",
      i.rule_set_id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      rs.name AS "ruleSetName",
      bp.blank_eqp_price::float8 AS "blankEqpPrice",
      CASE WHEN COALESCE(i.allows_flat_emb_override, rs.allows_flat_emb) THEN ROUND((bp.blank_eqp_price + 3.00)::numeric, 2)::float8 ELSE NULL END AS "flatEqpPrice",
      CASE WHEN COALESCE(i.allows_3d_emb_override, rs.allows_3d_emb) THEN ROUND((bp.blank_eqp_price + 5.75)::numeric, 2)::float8 ELSE NULL END AS "threeDEqpPrice",
      bp.source_file_name AS "sourceFileName",
      bp.source_sheet_name AS "sourceSheetName",
      bp.source_row_number AS "sourceRowNumber",
      bp.notes,
      bp.created_at AS "createdAt",
      bp.created_by AS "createdBy",
      bp.updated_at AS "updatedAt",
      bp.updated_by AS "updatedBy"
    FROM public.item_pricing_item_base_prices bp
    JOIN public.item_pricing_price_books pb ON pb.id = bp.price_book_id
    JOIN public.item_pricing_items i ON i.id = bp.item_id
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
  `;
}

export async function listItemPricingBasePrices(
  options: ItemPricingListOptions = {}
): Promise<PagedResult<ItemPricingBasePrice>> {
  const priceBookId = await resolvePriceBookId(db, cleanText(options.priceBookId));
  const params: any[] = [priceBookId];
  const where: string[] = ["bp.price_book_id = $1"];
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);

  if (!cleanBool(options.includeVoided, false)) where.push("i.is_voided = false AND pb.is_voided = false");
  if (!cleanBool(options.includeInactive, false)) where.push("i.active = true AND rs.active = true");

  const ruleSetId = cleanPositiveInt(options.ruleSetId, "Rule Set");
  if (ruleSetId != null) {
    params.push(ruleSetId);
    where.push(`i.rule_set_id = $${params.length}`);
  }

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(i.item_code ILIKE $${params.length} OR COALESCE(i.item_description, '') ILIKE $${params.length} OR rs.name ILIKE $${params.length})`);
  }

  const sqlWhere = `WHERE ${where.join(" AND ")}`;
  const sortColumn = BASE_PRICE_SORT_COLUMNS[String(options.sortBy || "itemCode")] || "i.item_code";
  const sortDir = cleanSortDir(options.sortDir);

  const count = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.item_pricing_item_base_prices bp
    JOIN public.item_pricing_price_books pb ON pb.id = bp.price_book_id
    JOIN public.item_pricing_items i ON i.id = bp.item_id
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    ${sqlWhere}
    `,
    params
  );

  params.push(limit, offset);

  const { rows } = await db.query<ItemPricingBasePrice>(
    `
    ${basePriceSelectSql()}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, i.item_code ASC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function upsertItemPricingBasePrice(input: ItemPricingBasePriceInput): Promise<ItemPricingBasePrice> {
  const priceBookId = await resolvePriceBookId(db, input.priceBookId ?? null);
  const itemId = await resolveItemId(db, { itemId: input.itemId ?? null, itemCode: input.itemCode ?? null });
  const blankEqpPrice = cleanMoney(input.blankEqpPrice, "Blank EQP");
  const sourceRowNumber = input.sourceRowNumber === undefined ? null : cleanPositiveInt(input.sourceRowNumber, "Source Row Number");
  const changedBy = userName(input);

  const existing = await db.query<ItemPricingBasePrice>(
    `${basePriceSelectSql()} WHERE bp.price_book_id = $1 AND bp.item_id = $2 LIMIT 1`,
    [priceBookId, itemId]
  );

  const { rows } = await db.query<{ id: string }>(
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
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
    ON CONFLICT (price_book_id, item_id)
    DO UPDATE SET
      blank_eqp_price = EXCLUDED.blank_eqp_price,
      source_file_name = EXCLUDED.source_file_name,
      source_sheet_name = EXCLUDED.source_sheet_name,
      source_row_number = EXCLUDED.source_row_number,
      notes = EXCLUDED.notes,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
    RETURNING id
    `,
    [
      priceBookId,
      itemId,
      blankEqpPrice,
      cleanText(input.sourceFileName),
      cleanText(input.sourceSheetName),
      sourceRowNumber,
      cleanText(input.notes),
      changedBy,
    ]
  );

  const updated = await db.query<ItemPricingBasePrice>(
    `${basePriceSelectSql()} WHERE bp.id = $1 LIMIT 1`,
    [rows[0].id]
  );

  const saved = updated.rows[0];
  if (!saved) throw new Error("Failed to reload base price.");

  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.item,
    entityId: saved.itemId,
    eventType: existing.rows[0] ? "updated" : "created",
    fieldName: "blank_eqp_price",
    message: `${saved.itemCode} Blank EQP set to ${money2(saved.blankEqpPrice)?.toFixed(2)} in ${saved.priceBookCode}.`,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    previousValue: existing.rows[0] ?? null,
    newValue: saved,
  });

  return saved;
}

/* -------------------------------------------------------------------------- */
/* Calculation preview and snapshots                                           */
/* -------------------------------------------------------------------------- */

async function getItemWithPriceForCalculation(input: {
  priceBookId: string;
  itemId?: string | null;
  itemCode?: string | null;
}) {
  const itemId = await resolveItemId(db, { itemId: input.itemId ?? null, itemCode: input.itemCode ?? null });

  const { rows } = await db.query<
    ItemPricingItem & {
      blankEqpPrice: number | null;
      priceBookCode: string | null;
    }
  >(
    `
    ${itemSelectSql(true)}
    LEFT JOIN public.item_pricing_item_base_prices bp
      ON bp.item_id = i.id AND bp.price_book_id = $1
    LEFT JOIN public.item_pricing_price_books pb
      ON pb.id = $1
    WHERE i.id = $2
    LIMIT 1
    `,
    [input.priceBookId, itemId]
  );

  const item = rows[0];
  if (!item) throw new Error("Item not found.");
  return item;
}

export async function calculateItemPricingPreview(
  input: ItemPricingCalculationPreviewInput
): Promise<ItemPricingCalculationResult> {
  const priceBookId = await resolvePriceBookId(db, input.priceBookId ?? null);
  const priceBook = await getItemPricingPriceBook(priceBookId);
  const item = await getItemWithPriceForCalculation({
    priceBookId,
    itemId: input.itemId ?? null,
    itemCode: input.itemCode ?? null,
  });

  const ruleSet = await getItemPricingRuleSet(item.ruleSetId);
  if (!ruleSet) throw new Error("Item rule set not found.");

  const override = input.blankEqpPriceOverride;
  const blankEqpPrice = override !== undefined && override !== null && override !== ""
    ? override
    : item.blankEqpPrice;

  return calculateBaseItemPrices({
    priceBookId,
    priceBookCode: priceBook?.code ?? null,
    itemId: item.id,
    itemCode: item.itemCode,
    itemDescription: item.itemDescription,
    itemActive: item.active,
    ruleSetId: ruleSet.id,
    ruleSetCode: ruleSet.code,
    ruleSetName: ruleSet.name,
    ruleSetActive: ruleSet.active,
    blankEqpPrice,
    allowedMethods: {
      blank: item.allowsBlank,
      flatEmb: item.allowsFlatEmb,
      threeDEmb: item.allows3dEmb,
      knitIn: item.allowsKnitIn,
    },
    requestedMethodCode: input.requestedMethodCode ?? null,
    ruleRows: ruleSet.ruleRows,
  });
}

export async function saveItemPricingCalculatedSnapshot(
  result: ItemPricingCalculationResult,
  input: { changedBy?: string | null } = {}
): Promise<void> {
  assertCalculationSucceeded(result);
  if (!result.priceBook.id) throw new Error("Price book is required to save calculated prices.");
  if (!result.item.id) throw new Error("Item is required to save calculated prices.");
  if (result.blankEqpPrice == null) throw new Error("Blank EQP is required to save calculated prices.");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM public.item_pricing_calculated_prices WHERE price_book_id = $1 AND item_id = $2`,
      [result.priceBook.id, result.item.id]
    );

    for (const method of result.methods) {
      for (const price of method.prices) {
        await client.query(
          `
          INSERT INTO public.item_pricing_calculated_prices (
            price_book_id,
            item_id,
            rule_set_id,
            decoration_method_id,
            quantity_break_id,
            blank_eqp_price,
            calculated_price,
            calculation_trace,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
          `,
          [
            result.priceBook.id,
            result.item.id,
            result.ruleSet.id,
            method.decorationMethodId,
            price.quantityBreakId,
            result.blankEqpPrice,
            price.calculatedPrice,
            JSON.stringify(price.trace),
            cleanText(input.changedBy),
          ]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
