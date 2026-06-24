// lib/repositories/itemPricingValidationRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import { calculateItemPricingPreview } from "@/lib/repositories/itemPricingRepo";
import {
  ITEM_PRICING_ENTITY_TYPES,
  ITEM_PRICING_MODULE_NAME,
  ITEM_PRICING_SPECIAL_ITEM_CODES,
} from "@/lib/itemPricing/constants";
import type {
  ItemPricingCreateValidationRunInput,
  ItemPricingValidationIssue,
  ItemPricingValidationListOptions,
  ItemPricingValidationPagedResult,
  ItemPricingValidationRun,
  ItemPricingValidationRunDetail,
  ItemPricingValidationSeverity,
  ItemPricingValidationStatus,
} from "@/lib/itemPricing/validationTypes";
import type { SortDir } from "@/lib/itemPricing/types";

type Queryable = {
  query: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
};

type PendingIssue = {
  severity: ItemPricingValidationSeverity;
  issueCode: string;
  entityType?: string | null;
  entityId?: string | null;
  itemId?: string | null;
  itemCode?: string | null;
  ruleSetId?: number | null;
  ruleSetCode?: string | null;
  decorationMethodCode?: string | null;
  quantityBreakCode?: string | null;
  message: string;
  detailsJson?: unknown | null;
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

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(s)) return true;
  if (["false", "0", "no", "n", "off"].includes(s)) return false;
  return fallback;
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
  return String(value || "desc").toLowerCase() === "asc" ? "asc" : "desc";
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

async function logValidationActivity(input: {
  entityType: string;
  entityId: string;
  eventType: string;
  message: string;
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  await createActivityHistory({
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    fieldName: null,
    previousValue: input.previousValue,
    newValue: input.newValue,
    message: input.message,
    module: ITEM_PRICING_MODULE_NAME,
    userId: changedByUserId(input),
    userName: userName(input),
    employeeNumber: changedByEmployeeNumber(input),
  });
}

function pageResult<T>(rows: T[], total: number, limit: number, offset: number) {
  return { rows, total, pageSize: limit, offset };
}

const runSelectSql = `
  SELECT
    vr.id,
    vr.price_book_id AS "priceBookId",
    pb.code AS "priceBookCode",
    pb.name AS "priceBookName",
    vr.validation_type AS "validationType",
    vr.status,
    vr.item_count AS "itemCount",
    vr.issue_count AS "issueCount",
    vr.error_count AS "errorCount",
    vr.warning_count AS "warningCount",
    vr.notes,
    vr.started_at AS "startedAt",
    vr.completed_at AS "completedAt",
    vr.created_at AS "createdAt",
    vr.created_by AS "createdBy"
  FROM public.item_pricing_validation_runs vr
  JOIN public.item_pricing_price_books pb ON pb.id = vr.price_book_id
`;

const issueSelectSql = `
  SELECT
    id,
    validation_run_id AS "validationRunId",
    severity,
    issue_code AS "issueCode",
    entity_type AS "entityType",
    entity_id AS "entityId",
    item_id AS "itemId",
    item_code AS "itemCode",
    rule_set_id AS "ruleSetId",
    rule_set_code AS "ruleSetCode",
    decoration_method_code AS "decorationMethodCode",
    quantity_break_code AS "quantityBreakCode",
    message,
    details_json AS "detailsJson",
    created_at AS "createdAt"
  FROM public.item_pricing_validation_issues
`;

async function resolvePriceBookId(queryable: Queryable, id?: string | null): Promise<string> {
  const cleanId = cleanText(id);
  if (cleanId) {
    const { rows } = await queryable.query<{ id: string }>(
      `SELECT id FROM public.item_pricing_price_books WHERE id = $1 AND is_voided = false LIMIT 1`,
      [cleanId]
    );
    if (!rows[0]) throw new Error("Invalid price book.");
    return rows[0].id;
  }

  const { rows } = await queryable.query<{ id: string }>(
    `
    SELECT id
    FROM public.item_pricing_price_books
    WHERE is_voided = false
    ORDER BY is_default DESC, effective_date DESC NULLS LAST, created_at DESC
    LIMIT 1
    `
  );
  if (!rows[0]) throw new Error("No item pricing price book exists.");
  return rows[0].id;
}

async function addDuplicateRuleRows(issues: PendingIssue[]) {
  const { rows } = await db.query<{
    ruleSetId: number;
    ruleSetCode: string;
    decorationMethodCode: string;
    quantityBreakCode: string;
    rowCount: number;
  }>(
    `
    SELECT
      rs.id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      dm.code AS "decorationMethodCode",
      qb.code AS "quantityBreakCode",
      COUNT(*)::int AS "rowCount"
    FROM public.item_pricing_rule_set_breaks rb
    JOIN public.item_pricing_rule_sets rs ON rs.id = rb.rule_set_id
    JOIN public.item_pricing_decoration_methods dm ON dm.id = rb.decoration_method_id
    JOIN public.item_pricing_quantity_breaks qb ON qb.id = rb.quantity_break_id
    WHERE rb.active = true
    GROUP BY rs.id, rs.code, dm.code, qb.code, qb.sort_order
    HAVING COUNT(*) > 1
    ORDER BY rs.code, dm.code, qb.sort_order
    `
  );

  for (const row of rows) {
    issues.push({
      severity: "ERROR",
      issueCode: "DUPLICATE_ACTIVE_RULE_ROW",
      entityType: ITEM_PRICING_ENTITY_TYPES.ruleSet,
      entityId: String(row.ruleSetId),
      ruleSetId: row.ruleSetId,
      ruleSetCode: row.ruleSetCode,
      decorationMethodCode: row.decorationMethodCode,
      quantityBreakCode: row.quantityBreakCode,
      message: `Duplicate active rule rows found for ${row.ruleSetCode} / ${row.decorationMethodCode} / ${row.quantityBreakCode}.`,
      detailsJson: row,
    });
  }
}

async function addMissingBaseRuleRows(issues: PendingIssue[]) {
  const { rows } = await db.query<{
    ruleSetId: number;
    ruleSetCode: string;
    decorationMethodCode: string;
  }>(
    `
    WITH active_methods AS (
      SELECT DISTINCT rb.rule_set_id, rb.decoration_method_id
      FROM public.item_pricing_rule_set_breaks rb
      WHERE rb.active = true
    )
    SELECT
      rs.id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      dm.code AS "decorationMethodCode"
    FROM active_methods am
    JOIN public.item_pricing_rule_sets rs ON rs.id = am.rule_set_id
    JOIN public.item_pricing_decoration_methods dm ON dm.id = am.decoration_method_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.item_pricing_rule_set_breaks rb
      JOIN public.item_pricing_quantity_breaks qb ON qb.id = rb.quantity_break_id
      WHERE rb.rule_set_id = am.rule_set_id
        AND rb.decoration_method_id = am.decoration_method_id
        AND rb.active = true
        AND qb.code = '2500'
    )
    ORDER BY rs.code, dm.code
    `
  );

  for (const row of rows) {
    issues.push({
      severity: "ERROR",
      issueCode: "MISSING_2500_RULE_ROW",
      entityType: ITEM_PRICING_ENTITY_TYPES.ruleSet,
      entityId: String(row.ruleSetId),
      ruleSetId: row.ruleSetId,
      ruleSetCode: row.ruleSetCode,
      decorationMethodCode: row.decorationMethodCode,
      quantityBreakCode: "2500",
      message: `Missing active 2500+ base rule row for ${row.ruleSetCode} / ${row.decorationMethodCode}.`,
      detailsJson: row,
    });
  }
}

async function addMethodCapabilityIssues(issues: PendingIssue[]) {
  const { rows } = await db.query<{
    ruleSetId: number;
    ruleSetCode: string;
    decorationMethodCode: string;
  }>(
    `
    SELECT DISTINCT
      rs.id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      dm.code AS "decorationMethodCode"
    FROM public.item_pricing_rule_set_breaks rb
    JOIN public.item_pricing_rule_sets rs ON rs.id = rb.rule_set_id
    JOIN public.item_pricing_decoration_methods dm ON dm.id = rb.decoration_method_id
    WHERE rb.active = true
      AND (
        (dm.code = 'BLANK' AND rs.allows_blank = false) OR
        (dm.code = 'FLAT_EMB' AND rs.allows_flat_emb = false) OR
        (dm.code = 'THREE_D_EMB' AND rs.allows_3d_emb = false) OR
        (dm.code = 'KNIT_IN' AND rs.allows_knit_in = false)
      )
    ORDER BY rs.code, dm.code
    `
  );

  for (const row of rows) {
    issues.push({
      severity: "ERROR",
      issueCode: "RULE_METHOD_NOT_ALLOWED",
      entityType: ITEM_PRICING_ENTITY_TYPES.ruleSet,
      entityId: String(row.ruleSetId),
      ruleSetId: row.ruleSetId,
      ruleSetCode: row.ruleSetCode,
      decorationMethodCode: row.decorationMethodCode,
      message: `${row.ruleSetCode} has active ${row.decorationMethodCode} rows but the rule set does not allow that method.`,
      detailsJson: row,
    });
  }
}

async function addItemSetupIssues(priceBookId: string, issues: PendingIssue[]) {
  const missingBase = await db.query<{
    itemId: string;
    itemCode: string;
    ruleSetId: number;
    ruleSetCode: string;
  }>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      rs.id AS "ruleSetId",
      rs.code AS "ruleSetCode"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    WHERE i.is_voided = false
      AND i.active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.item_pricing_item_base_prices bp
        WHERE bp.item_id = i.id
          AND bp.price_book_id = $1
      )
    ORDER BY i.item_code
    `,
    [priceBookId]
  );

  for (const row of missingBase.rows) {
    issues.push({
      severity: "WARNING",
      issueCode: "ACTIVE_ITEM_MISSING_BASE_PRICE",
      entityType: ITEM_PRICING_ENTITY_TYPES.item,
      entityId: row.itemId,
      itemId: row.itemId,
      itemCode: row.itemCode,
      ruleSetId: row.ruleSetId,
      ruleSetCode: row.ruleSetCode,
      message: `${row.itemCode} is active but does not have a Blank EQP base price in this price book.`,
      detailsJson: row,
    });
  }

  const negativeBase = await db.query<{
    itemId: string;
    itemCode: string;
    blankEqpPrice: number;
  }>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      bp.blank_eqp_price::float AS "blankEqpPrice"
    FROM public.item_pricing_item_base_prices bp
    JOIN public.item_pricing_items i ON i.id = bp.item_id
    WHERE bp.price_book_id = $1
      AND bp.blank_eqp_price < 0
    ORDER BY i.item_code
    `,
    [priceBookId]
  );

  for (const row of negativeBase.rows) {
    issues.push({
      severity: "ERROR",
      issueCode: "NEGATIVE_BLANK_EQP",
      entityType: ITEM_PRICING_ENTITY_TYPES.basePrice,
      entityId: row.itemId,
      itemId: row.itemId,
      itemCode: row.itemCode,
      message: `${row.itemCode} has a negative Blank EQP value.`,
      detailsJson: row,
    });
  }

  const inactiveItems = await db.query<{
    itemId: string;
    itemCode: string;
    blankEqpPrice: number;
  }>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      bp.blank_eqp_price::float AS "blankEqpPrice"
    FROM public.item_pricing_item_base_prices bp
    JOIN public.item_pricing_items i ON i.id = bp.item_id
    WHERE bp.price_book_id = $1
      AND i.is_voided = false
      AND i.active = false
    ORDER BY i.item_code
    `,
    [priceBookId]
  );

  for (const row of inactiveItems.rows) {
    issues.push({
      severity: "WARNING",
      issueCode: "INACTIVE_ITEM_HAS_BASE_PRICE",
      entityType: ITEM_PRICING_ENTITY_TYPES.item,
      entityId: row.itemId,
      itemId: row.itemId,
      itemCode: row.itemCode,
      message: `${row.itemCode} is inactive but has a Blank EQP base price in this price book.`,
      detailsJson: row,
    });
  }

  const inactiveRuleSets = await db.query<{
    itemId: string;
    itemCode: string;
    ruleSetId: number;
    ruleSetCode: string;
  }>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      rs.id AS "ruleSetId",
      rs.code AS "ruleSetCode"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    WHERE i.is_voided = false
      AND i.active = true
      AND rs.active = false
    ORDER BY i.item_code
    `
  );

  for (const row of inactiveRuleSets.rows) {
    issues.push({
      severity: "ERROR",
      issueCode: "ACTIVE_ITEM_INACTIVE_RULE_SET",
      entityType: ITEM_PRICING_ENTITY_TYPES.item,
      entityId: row.itemId,
      itemId: row.itemId,
      itemCode: row.itemCode,
      ruleSetId: row.ruleSetId,
      ruleSetCode: row.ruleSetCode,
      message: `${row.itemCode} is active but assigned to inactive rule set ${row.ruleSetCode}.`,
      detailsJson: row,
    });
  }

  const i8507 = await db.query<{
    itemId: string;
    itemCode: string;
    ruleSetId: number;
    ruleSetCode: string;
    allows3d: boolean;
  }>(
    `
    SELECT
      i.id AS "itemId",
      i.item_code AS "itemCode",
      rs.id AS "ruleSetId",
      rs.code AS "ruleSetCode",
      COALESCE(i.allows_3d_emb_override, rs.allows_3d_emb) AS "allows3d"
    FROM public.item_pricing_items i
    JOIN public.item_pricing_rule_sets rs ON rs.id = i.rule_set_id
    WHERE upper(i.item_code) = ANY($1::text[])
      AND i.is_voided = false
      AND COALESCE(i.allows_3d_emb_override, rs.allows_3d_emb) = true
    ORDER BY i.item_code
    `,
    [Array.from(ITEM_PRICING_SPECIAL_ITEM_CODES.premiumNoThreeD)]
  );

  for (const row of i8507.rows) {
    issues.push({
      severity: "ERROR",
      issueCode: "SPECIAL_ITEM_THREE_D_NOT_ALLOWED",
      entityType: ITEM_PRICING_ENTITY_TYPES.item,
      entityId: row.itemId,
      itemId: row.itemId,
      itemCode: row.itemCode,
      ruleSetId: row.ruleSetId,
      ruleSetCode: row.ruleSetCode,
      decorationMethodCode: "THREE_D_EMB",
      message: `${row.itemCode} should not allow 3D pricing.`,
      detailsJson: row,
    });
  }
}

async function addCalculationIssues(priceBookId: string, issues: PendingIssue[]) {
  const { rows } = await db.query<{ itemId: string; itemCode: string }>(
    `
    SELECT i.id AS "itemId", i.item_code AS "itemCode"
    FROM public.item_pricing_item_base_prices bp
    JOIN public.item_pricing_items i ON i.id = bp.item_id
    WHERE bp.price_book_id = $1
      AND i.is_voided = false
    ORDER BY i.item_code
    `,
    [priceBookId]
  );

  for (const row of rows) {
    try {
      const result = await calculateItemPricingPreview({ priceBookId, itemId: row.itemId });
      for (const error of result.errors || []) {
        issues.push({
          severity: "ERROR",
          issueCode: "CALCULATION_ERROR",
          entityType: ITEM_PRICING_ENTITY_TYPES.item,
          entityId: row.itemId,
          itemId: row.itemId,
          itemCode: row.itemCode,
          message: `${row.itemCode}: ${error}`,
          detailsJson: { error },
        });
      }
      for (const warning of result.warnings || []) {
        issues.push({
          severity: "WARNING",
          issueCode: "CALCULATION_WARNING",
          entityType: ITEM_PRICING_ENTITY_TYPES.item,
          entityId: row.itemId,
          itemId: row.itemId,
          itemCode: row.itemCode,
          message: `${row.itemCode}: ${warning}`,
          detailsJson: { warning },
        });
      }
    } catch (err: any) {
      issues.push({
        severity: "ERROR",
        issueCode: "CALCULATION_EXCEPTION",
        entityType: ITEM_PRICING_ENTITY_TYPES.item,
        entityId: row.itemId,
        itemId: row.itemId,
        itemCode: row.itemCode,
        message: `${row.itemCode}: ${err?.message || "Calculation failed."}`,
        detailsJson: { error: err?.message || "Calculation failed." },
      });
    }
  }
}

async function buildValidationIssues(priceBookId: string, includeCalculationCheck: boolean): Promise<{ itemCount: number; issues: PendingIssue[] }> {
  const issues: PendingIssue[] = [];

  const itemCountResult = await db.query<{ count: string }>(
    `
    SELECT COUNT(DISTINCT item_id)::text AS count
    FROM public.item_pricing_item_base_prices
    WHERE price_book_id = $1
    `,
    [priceBookId]
  );

  await addDuplicateRuleRows(issues);
  await addMissingBaseRuleRows(issues);
  await addMethodCapabilityIssues(issues);
  await addItemSetupIssues(priceBookId, issues);
  if (includeCalculationCheck) await addCalculationIssues(priceBookId, issues);

  return {
    itemCount: Number(itemCountResult.rows[0]?.count || 0),
    issues,
  };
}

export async function listItemPricingValidationRuns(
  options: ItemPricingValidationListOptions = {}
): Promise<ItemPricingValidationPagedResult> {
  const params: any[] = [];
  const where: string[] = [];
  const limit = cleanLimit(options.limit);
  const offset = cleanOffset(options.offset);

  const priceBookId = cleanText(options.priceBookId);
  if (priceBookId) {
    params.push(priceBookId);
    where.push(`vr.price_book_id = $${params.length}`);
  }

  const q = cleanText(options.q);
  if (q) {
    params.push(`%${q}%`);
    where.push(`(pb.code ILIKE $${params.length} OR pb.name ILIKE $${params.length} OR vr.status ILIKE $${params.length} OR COALESCE(vr.created_by, '') ILIKE $${params.length})`);
  }

  const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortMap: Record<string, string> = {
    createdAt: "vr.created_at",
    completedAt: "vr.completed_at",
    status: "vr.status",
    errorCount: "vr.error_count",
    warningCount: "vr.warning_count",
    priceBookCode: "pb.code",
  };
  const sortColumn = sortMap[String(options.sortBy || "createdAt")] || "vr.created_at";
  const sortDir = cleanSortDir(options.sortDir);

  const count = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM public.item_pricing_validation_runs vr
    JOIN public.item_pricing_price_books pb ON pb.id = vr.price_book_id
    ${sqlWhere}
    `,
    params
  );

  params.push(limit, offset);
  const { rows } = await db.query<ItemPricingValidationRun>(
    `
    ${runSelectSql}
    ${sqlWhere}
    ORDER BY ${sortColumn} ${sortDir}, vr.created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
    `,
    params
  );

  return pageResult(rows, Number(count.rows[0]?.count || 0), limit, offset);
}

export async function getItemPricingValidationRun(id: string): Promise<ItemPricingValidationRunDetail | null> {
  const cleanId = cleanRequiredText(id, "Validation Run");
  const { rows } = await db.query<ItemPricingValidationRun>(
    `
    ${runSelectSql}
    WHERE vr.id = $1
    LIMIT 1
    `,
    [cleanId]
  );

  if (!rows[0]) return null;

  const issues = await db.query<ItemPricingValidationIssue>(
    `
    ${issueSelectSql}
    WHERE validation_run_id = $1
    ORDER BY CASE WHEN severity = 'ERROR' THEN 0 ELSE 1 END, issue_code, item_code NULLS LAST, id
    `,
    [cleanId]
  );

  return { ...rows[0], issues: issues.rows };
}

export async function createItemPricingValidationRun(
  input: ItemPricingCreateValidationRunInput
): Promise<ItemPricingValidationRunDetail> {
  const priceBookId = await resolvePriceBookId(db, input.priceBookId ?? null);
  const includeCalculationCheck = cleanBool(input.includeCalculationCheck, true);
  const changedBy = userName(input);
  const startedAt = new Date();
  const built = await buildValidationIssues(priceBookId, includeCalculationCheck);

  const errorCount = built.issues.filter((issue) => issue.severity === "ERROR").length;
  const warningCount = built.issues.filter((issue) => issue.severity === "WARNING").length;
  const status: ItemPricingValidationStatus = errorCount > 0 ? "FAILED" : warningCount > 0 ? "WARNINGS" : "PASSED";

  const client = await db.connect();
  let runId: string | null = null;

  try {
    await client.query("BEGIN");

    const inserted = await client.query<{ id: string }>(
      `
      INSERT INTO public.item_pricing_validation_runs (
        price_book_id,
        validation_type,
        status,
        item_count,
        issue_count,
        error_count,
        warning_count,
        notes,
        started_at,
        completed_at,
        created_by
      )
      VALUES ($1, 'FOUNDATION', $2, $3, $4, $5, $6, $7, $8, now(), $9)
      RETURNING id
      `,
      [
        priceBookId,
        status,
        built.itemCount,
        built.issues.length,
        errorCount,
        warningCount,
        cleanText(input.notes),
        startedAt,
        changedBy,
      ]
    );

    runId = inserted.rows[0].id;

    for (const issue of built.issues) {
      await client.query(
        `
        INSERT INTO public.item_pricing_validation_issues (
          validation_run_id,
          severity,
          issue_code,
          entity_type,
          entity_id,
          item_id,
          item_code,
          rule_set_id,
          rule_set_code,
          decoration_method_code,
          quantity_break_code,
          message,
          details_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        `,
        [
          runId,
          issue.severity,
          issue.issueCode,
          issue.entityType ?? null,
          issue.entityId ?? null,
          issue.itemId ?? null,
          issue.itemCode ?? null,
          issue.ruleSetId ?? null,
          issue.ruleSetCode ?? null,
          issue.decorationMethodCode ?? null,
          issue.quantityBreakCode ?? null,
          issue.message,
          issue.detailsJson === undefined || issue.detailsJson === null ? null : JSON.stringify(issue.detailsJson),
        ]
      );
    }

    await client.query(
      `
      UPDATE public.item_pricing_price_books
      SET last_validated_at = now(),
          last_validation_status = $2,
          last_validation_error_count = $3,
          last_validation_warning_count = $4,
          updated_at = now(),
          updated_by = $5
      WHERE id = $1
      `,
      [priceBookId, status, errorCount, warningCount, changedBy]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (!runId) throw new Error("Failed to create validation run.");
  const detail = await getItemPricingValidationRun(runId);
  if (!detail) throw new Error("Failed to reload validation run.");

  await logValidationActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.validationRun,
    entityId: detail.id,
    eventType: "validation_run_created",
    message: `Foundation validation completed for ${detail.priceBookCode}: ${detail.errorCount} error(s), ${detail.warningCount} warning(s).`,
    newValue: detail,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
  });

  await logValidationActivity({
    entityType: ITEM_PRICING_ENTITY_TYPES.priceBook,
    entityId: detail.priceBookId,
    eventType: "validation_run_created",
    message: `Foundation validation completed: ${detail.status} (${detail.errorCount} error(s), ${detail.warningCount} warning(s)).`,
    newValue: {
      validationRunId: detail.id,
      status: detail.status,
      errorCount: detail.errorCount,
      warningCount: detail.warningCount,
    },
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
  });

  return detail;
}
