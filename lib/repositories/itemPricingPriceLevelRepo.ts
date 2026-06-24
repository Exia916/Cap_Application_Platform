// lib/repositories/itemPricingPriceLevelRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { calculateItemPricingPreview } from "@/lib/repositories/itemPricingRepo";
import {
  ITEM_PRICING_ENTITY_TYPES,
  ITEM_PRICING_MODULE_NAME,
  ITEM_PRICING_PRICE_LEVEL_RULE_TYPES,
  ITEM_PRICING_PRICE_LEVEL_TYPES,
  ITEM_PRICING_ROUNDING_MODES,
} from "@/lib/itemPricing/constants";
import { calculatePriceLevelPreview } from "@/lib/itemPricing/itemPricingPriceLevelService";
import type {
  ItemPricingPriceLevel,
  ItemPricingPriceLevelDetail,
  ItemPricingPriceLevelInput,
  ItemPricingPriceLevelListOptions,
  ItemPricingPriceLevelPreviewInput,
  ItemPricingPriceLevelPreviewResult,
  ItemPricingPriceLevelRule,
  ItemPricingPriceLevelRuleInput,
} from "@/lib/itemPricing/priceLevelTypes";
import type { PagedResult, SortDir } from "@/lib/itemPricing/types";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

type AuditInput = {
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

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
  return cleanRequiredText(value, label).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function cleanNullableInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${label} must be valid.`);
  return n;
}

function cleanInt(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return n;
}

function cleanNullableMoney(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number.`);
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
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

function userName(input: AuditInput) {
  return cleanText(input.changedBy) || "Unknown User";
}

function changedByUserId(input: AuditInput) {
  return cleanText(input.changedByUserId);
}

function changedByEmployeeNumber(input: AuditInput) {
  const raw = input.changedByEmployeeNumber;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

async function logActivity(input: AuditInput & {
  entityType: string;
  entityId: string;
  eventType: string;
  message: string;
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

function cleanLevelType(value: unknown): string {
  const s = cleanCode(value || "INTERNAL", "Level Type");
  if (!(ITEM_PRICING_PRICE_LEVEL_TYPES as readonly string[]).includes(s)) throw new Error("Invalid price level type.");
  return s;
}

function cleanRuleType(value: unknown): string {
  const s = cleanCode(value || "MULTIPLIER", "Rule Type");
  if (!(ITEM_PRICING_PRICE_LEVEL_RULE_TYPES as readonly string[]).includes(s)) throw new Error("Invalid price level rule type.");
  return s;
}

function cleanRoundingMode(value: unknown): string {
  const s = cleanCode(value || "HALF_UP_2", "Rounding Mode");
  if (!(ITEM_PRICING_ROUNDING_MODES as readonly string[]).includes(s)) throw new Error("Invalid rounding mode.");
  return s;
}

function mapPriceLevel(row: any): ItemPricingPriceLevel {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    levelType: row.level_type,
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null,
    ruleCount: Number(row.rule_count ?? 0),
    activeRuleCount: Number(row.active_rule_count ?? 0),
  };
}

function mapRule(row: any): ItemPricingPriceLevelRule {
  return {
    id: row.id,
    priceLevelId: row.price_level_id,
    priceLevelCode: row.price_level_code,
    priceLevelName: row.price_level_name,
    ruleSetId: row.rule_set_id == null ? null : Number(row.rule_set_id),
    ruleSetCode: row.rule_set_code ?? null,
    ruleSetName: row.rule_set_name ?? null,
    decorationMethodId: row.decoration_method_id == null ? null : Number(row.decoration_method_id),
    decorationMethodCode: row.decoration_method_code ?? null,
    decorationMethodName: row.decoration_method_name ?? null,
    quantityBreakId: row.quantity_break_id == null ? null : Number(row.quantity_break_id),
    quantityBreakCode: row.quantity_break_code ?? null,
    quantityBreakLabel: row.quantity_break_label ?? null,
    ruleType: row.rule_type,
    multiplier: row.multiplier == null ? null : Number(row.multiplier),
    addAmount: row.add_amount == null ? null : Number(row.add_amount),
    percentValue: row.percent_value == null ? null : Number(row.percent_value),
    overridePrice: row.override_price == null ? null : Number(row.override_price),
    minimumPrice: row.minimum_price == null ? null : Number(row.minimum_price),
    maximumPrice: row.maximum_price == null ? null : Number(row.maximum_price),
    roundingMode: row.rounding_mode,
    calculationOrder: Number(row.calculation_order ?? 100),
    active: Boolean(row.active),
    notes: row.notes ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? null,
  };
}

const priceLevelSelect = `
  SELECT
    pl.*,
    COUNT(plr.id)::int AS rule_count,
    COUNT(plr.id) FILTER (WHERE plr.active = true)::int AS active_rule_count
  FROM public.item_pricing_price_levels pl
  LEFT JOIN public.item_pricing_price_level_rules plr ON plr.price_level_id = pl.id
`;

const ruleSelect = `
  SELECT
    plr.*,
    pl.code AS price_level_code,
    pl.name AS price_level_name,
    rs.code AS rule_set_code,
    rs.name AS rule_set_name,
    dm.code AS decoration_method_code,
    dm.name AS decoration_method_name,
    qb.code AS quantity_break_code,
    qb.label AS quantity_break_label
  FROM public.item_pricing_price_level_rules plr
  JOIN public.item_pricing_price_levels pl ON pl.id = plr.price_level_id
  LEFT JOIN public.item_pricing_rule_sets rs ON rs.id = plr.rule_set_id
  LEFT JOIN public.item_pricing_decoration_methods dm ON dm.id = plr.decoration_method_id
  LEFT JOIN public.item_pricing_quantity_breaks qb ON qb.id = plr.quantity_break_id
`;

export async function listItemPricingPriceLevels(options: ItemPricingPriceLevelListOptions = {}): Promise<PagedResult<ItemPricingPriceLevel>> {
  const where: string[] = [];
  const params: any[] = [];

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(pl.code ILIKE $${params.length} OR pl.name ILIKE $${params.length} OR COALESCE(pl.description, '') ILIKE $${params.length})`);
  }

  if (!cleanBool(options.includeInactive, false)) where.push(`pl.active = true`);

  const sortMap: Record<string, string> = {
    code: "pl.code",
    name: "pl.name",
    levelType: "pl.level_type",
    active: "pl.active",
    sortOrder: "pl.sort_order",
    updatedAt: "pl.updated_at",
  };
  const sortBy = sortMap[String(options.sortBy || "sortOrder")] || sortMap.sortOrder;
  const sortDir = cleanSortDir(options.sortDir);
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countSql = `SELECT COUNT(*)::int AS total FROM public.item_pricing_price_levels pl ${whereSql}`;
  const count = await db.query<{ total: number }>(countSql, params);

  params.push(limit, offset);
  const rows = await db.query(
    `
    ${priceLevelSelect}
    ${whereSql}
    GROUP BY pl.id
    ORDER BY ${sortBy} ${sortDir}, pl.code ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params
  );

  return { rows: rows.rows.map(mapPriceLevel), total: Number(count.rows[0]?.total || 0), pageSize: limit, offset };
}

export async function getItemPricingPriceLevel(id: string): Promise<ItemPricingPriceLevelDetail | null> {
  const found = await db.query(`${priceLevelSelect} WHERE pl.id = $1 GROUP BY pl.id LIMIT 1`, [id]);
  if (!found.rows[0]) return null;
  const rules = await listItemPricingPriceLevelRules(id, { includeInactive: true });
  return { ...mapPriceLevel(found.rows[0]), rules };
}

export async function createItemPricingPriceLevel(input: ItemPricingPriceLevelInput): Promise<ItemPricingPriceLevel> {
  const code = cleanCode(input.code, "Code");
  const name = cleanRequiredText(input.name, "Name");
  const levelType = cleanLevelType(input.levelType);
  const active = cleanBool(input.active, true);
  const sortOrder = cleanInt(input.sortOrder, 0);

  const { rows } = await db.query(
    `
    INSERT INTO public.item_pricing_price_levels (code, name, description, level_type, active, sort_order, created_by, updated_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    RETURNING *
    `,
    [code, name, cleanText(input.description), levelType, active, sortOrder, userName(input)]
  );

  const created = mapPriceLevel(rows[0]);
  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceLevel,
    entityId: created.id,
    eventType: "created",
    message: `Price level ${created.code} created.`,
    ...input,
  });
  return created;
}

export async function updateItemPricingPriceLevel(id: string, input: ItemPricingPriceLevelInput): Promise<ItemPricingPriceLevel> {
  const existing = await getItemPricingPriceLevel(id);
  if (!existing) throw new Error("Price level not found.");

  const { rows } = await db.query(
    `
    UPDATE public.item_pricing_price_levels
    SET
      name = $2,
      description = $3,
      level_type = $4,
      active = $5,
      sort_order = $6,
      updated_at = now(),
      updated_by = $7
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      cleanRequiredText(input.name ?? existing.name, "Name"),
      input.description === undefined ? existing.description : cleanText(input.description),
      cleanLevelType(input.levelType ?? existing.levelType),
      cleanBool(input.active, existing.active),
      cleanInt(input.sortOrder, existing.sortOrder),
      userName(input),
    ]
  );

  const updated = mapPriceLevel(rows[0]);
  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceLevel,
    entityId: updated.id,
    eventType: "updated",
    message: `Price level ${updated.code} updated.`,
    previousValue: existing,
    newValue: updated,
    ...input,
  });
  return updated;
}

async function ensurePriceLevel(queryable: Queryable, priceLevelId: string): Promise<void> {
  const found = await queryable.query(`SELECT id FROM public.item_pricing_price_levels WHERE id = $1 LIMIT 1`, [priceLevelId]);
  if (!found.rows[0]) throw new Error("Price level not found.");
}

export async function listItemPricingPriceLevelRules(priceLevelId: string, options: { includeInactive?: boolean | string | null } = {}): Promise<ItemPricingPriceLevelRule[]> {
  const params: any[] = [priceLevelId];
  const where = [`plr.price_level_id = $1`];
  if (!cleanBool(options.includeInactive, false)) where.push(`plr.active = true`);

  const { rows } = await db.query(
    `
    ${ruleSelect}
    WHERE ${where.join(" AND ")}
    ORDER BY plr.calculation_order ASC, rs.sort_order NULLS FIRST, dm.sort_order NULLS FIRST, qb.sort_order NULLS FIRST, plr.created_at ASC
    `,
    params
  );
  return rows.map(mapRule);
}

export async function createItemPricingPriceLevelRule(priceLevelId: string, input: ItemPricingPriceLevelRuleInput): Promise<ItemPricingPriceLevelRule> {
  await ensurePriceLevel(db, priceLevelId);
  const ruleType = cleanRuleType(input.ruleType);

  const { rows } = await db.query(
    `
    INSERT INTO public.item_pricing_price_level_rules (
      price_level_id,
      rule_set_id,
      decoration_method_id,
      quantity_break_id,
      rule_type,
      multiplier,
      add_amount,
      percent_value,
      override_price,
      minimum_price,
      maximum_price,
      rounding_mode,
      calculation_order,
      active,
      notes,
      created_by,
      updated_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
    RETURNING *
    `,
    [
      priceLevelId,
      cleanNullableInt(input.ruleSetId, "Rule Set"),
      cleanNullableInt(input.decorationMethodId, "Decoration Method"),
      cleanNullableInt(input.quantityBreakId, "Quantity Break"),
      ruleType,
      cleanNullableMoney(input.multiplier, "Multiplier"),
      cleanNullableMoney(input.addAmount, "Add Amount"),
      cleanNullableMoney(input.percentValue, "Percent Value"),
      cleanNullableMoney(input.overridePrice, "Override Price"),
      cleanNullableMoney(input.minimumPrice, "Minimum Price"),
      cleanNullableMoney(input.maximumPrice, "Maximum Price"),
      cleanRoundingMode(input.roundingMode),
      cleanInt(input.calculationOrder, 100),
      cleanBool(input.active, true),
      cleanText(input.notes),
      userName(input),
    ]
  );

  const detail = await getItemPricingPriceLevelRule(rows[0].id);
  if (!detail) throw new Error("Price level rule was not found after insert.");

  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceLevel,
    entityId: priceLevelId,
    eventType: "price_level_rule_created",
    message: `Price level rule created for ${detail.priceLevelCode}.`,
    newValue: detail,
    ...input,
  });
  return detail;
}

export async function getItemPricingPriceLevelRule(ruleId: string): Promise<ItemPricingPriceLevelRule | null> {
  const { rows } = await db.query(`${ruleSelect} WHERE plr.id = $1 LIMIT 1`, [ruleId]);
  return rows[0] ? mapRule(rows[0]) : null;
}

export async function updateItemPricingPriceLevelRule(ruleId: string, input: ItemPricingPriceLevelRuleInput): Promise<ItemPricingPriceLevelRule> {
  const existing = await getItemPricingPriceLevelRule(ruleId);
  if (!existing) throw new Error("Price level rule not found.");

  const { rows } = await db.query(
    `
    UPDATE public.item_pricing_price_level_rules
    SET
      rule_set_id = $2,
      decoration_method_id = $3,
      quantity_break_id = $4,
      rule_type = $5,
      multiplier = $6,
      add_amount = $7,
      percent_value = $8,
      override_price = $9,
      minimum_price = $10,
      maximum_price = $11,
      rounding_mode = $12,
      calculation_order = $13,
      active = $14,
      notes = $15,
      updated_at = now(),
      updated_by = $16
    WHERE id = $1
    RETURNING *
    `,
    [
      ruleId,
      input.ruleSetId === undefined ? existing.ruleSetId : cleanNullableInt(input.ruleSetId, "Rule Set"),
      input.decorationMethodId === undefined ? existing.decorationMethodId : cleanNullableInt(input.decorationMethodId, "Decoration Method"),
      input.quantityBreakId === undefined ? existing.quantityBreakId : cleanNullableInt(input.quantityBreakId, "Quantity Break"),
      input.ruleType === undefined ? existing.ruleType : cleanRuleType(input.ruleType),
      input.multiplier === undefined ? existing.multiplier : cleanNullableMoney(input.multiplier, "Multiplier"),
      input.addAmount === undefined ? existing.addAmount : cleanNullableMoney(input.addAmount, "Add Amount"),
      input.percentValue === undefined ? existing.percentValue : cleanNullableMoney(input.percentValue, "Percent Value"),
      input.overridePrice === undefined ? existing.overridePrice : cleanNullableMoney(input.overridePrice, "Override Price"),
      input.minimumPrice === undefined ? existing.minimumPrice : cleanNullableMoney(input.minimumPrice, "Minimum Price"),
      input.maximumPrice === undefined ? existing.maximumPrice : cleanNullableMoney(input.maximumPrice, "Maximum Price"),
      input.roundingMode === undefined ? existing.roundingMode : cleanRoundingMode(input.roundingMode),
      input.calculationOrder === undefined ? existing.calculationOrder : cleanInt(input.calculationOrder, existing.calculationOrder),
      input.active === undefined ? existing.active : cleanBool(input.active, existing.active),
      input.notes === undefined ? existing.notes : cleanText(input.notes),
      userName(input),
    ]
  );

  const updated = await getItemPricingPriceLevelRule(rows[0].id);
  if (!updated) throw new Error("Price level rule was not found after update.");

  await logActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceLevel,
    entityId: updated.priceLevelId,
    eventType: "price_level_rule_updated",
    message: `Price level rule updated for ${updated.priceLevelCode}.`,
    previousValue: existing,
    newValue: updated,
    ...input,
  });
  return updated;
}

export async function calculateItemPricingPriceLevelPreview(input: ItemPricingPriceLevelPreviewInput): Promise<ItemPricingPriceLevelPreviewResult> {
  const priceLevelId = cleanRequiredText(input.priceLevelId, "Price Level");
  const level = await getItemPricingPriceLevel(priceLevelId);
  if (!level) throw new Error("Price level not found.");

  const baseCalculation = await calculateItemPricingPreview(input);
  return calculatePriceLevelPreview({
    baseCalculation,
    priceLevel: level,
    rules: level.rules,
  });
}
