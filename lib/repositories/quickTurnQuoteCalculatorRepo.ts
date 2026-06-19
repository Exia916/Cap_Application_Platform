// lib/repositories/quickTurnQuoteCalculatorRepo.ts

import { db } from "@/lib/db";
import { createActivityHistory } from "@/lib/repositories/activityHistoryRepo";
import {
  buildVoidedWhereClause,
  joinWhere,
  pushWhere,
} from "@/lib/repositories/_shared/repoFilters";
import {
  resolveVoidMode,
  type StandardRepoOptions,
} from "@/lib/repositories/_shared/repoTypes";
import { QUICK_TURN_QUOTE_ENTITY_TYPE } from "@/lib/quickTurnQuoteCalculator/constants";

export type SortDir = "asc" | "desc";
export type QuickTurnQuoteStatus = "DRAFT" | "PUBLISHED";

type Queryable = {
  query: <T = any>(
    sql: string,
    params?: any[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
};

export type QuickTurnAuditInput = {
  changedBy?: string | null;
  changedByUserId?: string | null;
  changedByEmployeeNumber?: number | string | null;
};

export type QuickTurnProgram = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnFactory = {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnBaseItem = {
  id: string;
  code: string;
  factoryId: number;
  itemCode: string;
  fabricDescription: string | null;
  basePrice: number;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnAccessory = {
  id: string;
  code: string;
  programId: number;
  factoryId: number;
  category: "DECORATION" | "CLOSURE";
  name: string;
  unitPrice: number;
  pricingMethod: string;
  notes: string | null;
  inputConfig: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnCamoOption = {
  id: string;
  code: string;
  factoryId: number;
  series: string;
  supplier: string;
  unitPrice: number;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnFeeType = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type QuickTurnOverseasCustomerServiceUser = {
  id: string;
  username: string | null;
  displayName: string;
  email: string | null;
  employeeNumber: number | null;
  department: string | null;
};

export type QuickTurnCalculatorBreak = {
  id: number;
  calculatorId: number;
  sortOrder: number;
  label: string;
  minQuantity: number;
  maxQuantity: number | null;
  managementReviewRequired: boolean;
  marginRate: number;
  surchargeMultiplier: number;
  airFreightAmount: number | null;
  ddpBaseAmount: number | null;
  ddpMarkupRate: number | null;
  moShippingAmount: number | null;
  isActive: boolean;
};

export type QuickTurnCalculator = {
  id: number;
  code: string;
  programId: number;
  factoryId: number;
  name: string;
  displayLabel: string;
  routeType: "STANDARD" | "DDP_MO_AIR" | "DDP_DIRECT_AIR";
  dutiesTaxRate: number;
  tariffRate: number;
  rebateRate: number;
  leadTimeNote: string | null;
  sortOrder: number;
  isActive: boolean;
  breaks: QuickTurnCalculatorBreak[];
};

export type QuickTurnLookupPayload = {
  programs: QuickTurnProgram[];
  factories: QuickTurnFactory[];
  baseItems: QuickTurnBaseItem[];
  accessories: QuickTurnAccessory[];
  camoOptions: QuickTurnCamoOption[];
  calculators: QuickTurnCalculator[];
  feeTypes: QuickTurnFeeType[];
};

export type QuickTurnSaveQuoteInput = QuickTurnAuditInput & {
  quoteName: string;
  notes?: string | null;
  workflowSalesOrderNumber?: string | null;
  overseasCustomerServiceUserId?: string | null;
  overseasCustomerServiceNameSnapshot?: string | null;
  overseasCustomerServiceEmailSnapshot?: string | null;
  overseasCustomerServiceEmployeeNumberSnapshot?: number | string | null;
  quoteRebateRate?: number | string | null;
  preparedForCustomerId?: string | number | null;
  preparedForCustomerCodeSnapshot?: string | null;
  preparedForCustomerNameSnapshot?: string | null;
  quotePreparedForDisplay?: string | null;
  programLogoText?: string | null;
  fob?: string | null;
  quoteStatus?: QuickTurnQuoteStatus | null;
  calculation: QuickTurnPersistedCalculation;
};

export type QuickTurnPersistedCalculation = {
  program: {
    id: number;
    code: string;
    name: string;
  };
  factory: {
    id: number;
    code: string;
    name: string;
  };
  generatedAt: string;
  validUntil: string;
  disclaimer: string;
  input: any;
  items: QuickTurnPersistedQuoteItem[];
};

export type QuickTurnPersistedQuoteItem = {
  clientItemId: string;
  sortOrder: number;
  baseItem: {
    id: string | null;
    code: string;
    itemCode: string;
    fabricDescription: string | null;
    basePrice: number;
    isCustomCap?: boolean;
    customCapDescription?: string | null;
  };
  isCustomCap?: boolean;
  customCapDescription?: string | null;
  accessories: Array<{
    id: string;
    code: string;
    category: "DECORATION" | "CLOSURE";
    name: string;
    pricingMethod: string;
    unitPrice: number;
    inputValues: Record<string, unknown>;
    calculatedUnitPrice: number;
    sortOrder: number;
  }>;
  camoOption: {
    id: string;
    code: string;
    series: string;
    supplier: string;
    unitPrice: number;
  } | null;
  fees: Array<{
    feeTypeId: number | null;
    feeCode: string;
    feeName: string;
    amount: number;
    notes: string | null;
    sortOrder: number;
  }>;
  baseUnitPrice: number;
  accessoryUnitTotal: number;
  decoratedUnitCost: number;
  camoUnitPrice: number;
  oneTimeFeeTotal: number;
  notes: string | null;
  calculatorResults: Array<{
    calculator: {
      id: number;
      code: string;
      name: string;
      displayLabel: string;
      routeType: "STANDARD" | "DDP_MO_AIR" | "DDP_DIRECT_AIR";
      dutiesTaxRate: number;
      tariffRate: number;
      rebateRate: number;
      leadTimeNote: string | null;
    };
    breaks: Array<{
      quantityBreakId: number;
      breakLabel: string;
      minQuantity: number;
      maxQuantity: number | null;
      managementReviewRequired: boolean;
      marginRate: number;
      baseMarginRate?: number;
      quoteRebateRate?: number;
      surchargeMultiplier: number;
      airFreightAmount: number | null;
      ddpBaseAmount: number | null;
      ddpMarkupRate: number | null;
      moShippingAmount: number | null;
      surchargedDecoratedCost: number;
      camoUnitPrice: number;
      dutiesTaxAmount: number;
      tariffAmount: number;
      rebateRate: number;
      preMarginCost: number;
      unitPrice: number;
      formulaNotes: string[];
    }>;
  }>;
};

export type QuickTurnSavedQuoteSummaryRow = {
  id: string;
  quoteNumber: string;
  quoteName: string;
  quoteStatus: QuickTurnQuoteStatus;
  workflowSalesOrderNumber: string | null;
  overseasCustomerServiceUserId: string | null;
  overseasCustomerServiceNameSnapshot: string | null;
  overseasCustomerServiceEmailSnapshot: string | null;
  overseasCustomerServiceEmployeeNumberSnapshot: number | null;
  quoteRebateRate: number;
  preparedForCustomerId: string | null;
  preparedForCustomerCodeSnapshot: string | null;
  preparedForCustomerNameSnapshot: string | null;
  quotePreparedForDisplay: string | null;
  programLogoText: string | null;
  fob: string | null;
  sourceQuoteId: string | null;
  sourceQuoteNumber: string | null;
  revisionNumber: number;
  publishedAt: string | null;
  publishedBy: string | null;
  programName: string;
  factoryName: string;
  generatedAt: string;
  validUntil: string;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  itemCount: number;
};

export type QuickTurnQuoteListFilters = StandardRepoOptions & {
  q?: string | null;
  quoteStatus?: QuickTurnQuoteStatus | "" | null;
  sortBy?: string | null;
  sortDir?: SortDir | null;
  limit?: number;
  offset?: number;
};

export type PagedQuickTurnQuoteResult = {
  rows: QuickTurnSavedQuoteSummaryRow[];
  total: number;
  pageSize: number;
  offset: number;
};

export type QuickTurnSavedQuoteDetail = QuickTurnSavedQuoteSummaryRow & {
  programCode: string;
  factoryCode: string;
  disclaimer: string;
  notes: string | null;
  inputSnapshot: unknown;
  resultSnapshot: unknown;
  items: Array<{
    id: string;
    sortOrder: number;
    isCustomCap: boolean;
    customCapDescription: string | null;
    baseItemCode: string;
    baseItemDescription: string | null;
    baseItemPrice: number;
    decoratedUnitCost: number;
    camoCode: string | null;
    camoSeries: string | null;
    camoSupplier: string | null;
    camoUnitPrice: number;
    notes: string | null;
    accessories: Array<{
      id: string;
      category: string;
      code: string;
      name: string;
      pricingMethod: string;
      unitPrice: number;
      inputValues: unknown;
      calculatedUnitPrice: number;
      sortOrder: number;
    }>;
    fees: Array<{
      id: string;
      feeCode: string;
      feeName: string;
      amount: number;
      notes: string | null;
      sortOrder: number;
    }>;
    results: Array<{
      id: string;
      calculatorCode: string;
      calculatorName: string;
      calculatorRouteType: string;
      breakLabel: string;
      minQuantity: number;
      maxQuantity: number | null;
      managementReviewRequired: boolean;
      marginRate: number;
      baseMarginRate?: number;
      quoteRebateRate?: number;
      surchargeMultiplier: number;
      dutiesTaxRate: number;
      tariffRate: number;
      rebateRate: number;
      airFreightAmount: number | null;
      ddpBaseAmount: number | null;
      ddpMarkupRate: number | null;
      moShippingAmount: number | null;
      surchargedDecoratedCost: number;
      camoUnitPrice: number;
      preMarginCost: number;
      unitPrice: number;
    }>;
  }>;
};

const PROGRAM_SELECT = `
  id,
  code,
  name,
  description,
  sort_order AS "sortOrder",
  is_active AS "isActive"
`;

const FACTORY_SELECT = `
  id,
  code,
  name,
  sort_order AS "sortOrder",
  is_active AS "isActive"
`;

const BASE_ITEM_SELECT = `
  id,
  code,
  factory_id AS "factoryId",
  item_code AS "itemCode",
  fabric_description AS "fabricDescription",
  base_price::float8 AS "basePrice",
  sort_order AS "sortOrder",
  is_active AS "isActive"
`;

const ACCESSORY_SELECT = `
  id,
  code,
  program_id AS "programId",
  factory_id AS "factoryId",
  category,
  name,
  unit_price::float8 AS "unitPrice",
  pricing_method AS "pricingMethod",
  notes,
  input_config AS "inputConfig",
  sort_order AS "sortOrder",
  is_active AS "isActive"
`;

const CAMO_SELECT = `
  id,
  code,
  factory_id AS "factoryId",
  series,
  supplier,
  unit_price::float8 AS "unitPrice",
  sort_order AS "sortOrder",
  is_active AS "isActive"
`;

const FEE_TYPE_SELECT = `
  id,
  code,
  name,
  description,
  sort_order AS "sortOrder",
  is_active AS "isActive"
`;

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanRequiredText(value: unknown, label: string): string {
  const s = cleanText(value);
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

function cleanNonNegativeNumber(value: unknown, label: string): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return n;
}

function cleanOptionalUuid(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

function cleanOptionalEmployeeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function cleanOptionalBigintId(value: unknown): string | null {
  const s = cleanText(value);
  if (!s) return null;
  return /^\d+$/.test(s) ? s : null;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function sortDir(value: SortDir | null | undefined): SortDir {
  return value === "desc" ? "desc" : "asc";
}

function limitOffset(inputLimit?: number, inputOffset?: number) {
  const limit = Number.isFinite(Number(inputLimit))
    ? Math.max(1, Math.min(250, Number(inputLimit)))
    : 25;
  const offset = Number.isFinite(Number(inputOffset)) ? Math.max(0, Number(inputOffset)) : 0;
  return { limit, offset };
}

function quoteStatus(value: unknown, fallback: QuickTurnQuoteStatus = "DRAFT"): QuickTurnQuoteStatus {
  return String(value || "").toUpperCase() === "PUBLISHED" ? "PUBLISHED" : fallback;
}

function addDaysAsDateString(date: Date, days: number): string {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

async function getOne<T>(
  queryable: Queryable,
  sql: string,
  params: any[],
  notFoundMessage: string
): Promise<T> {
  const { rows } = await queryable.query<T>(sql, params);
  const row = rows[0];
  if (!row) throw new Error(notFoundMessage);
  return row;
}

function validatePersistedCalculation(calculation: QuickTurnPersistedCalculation) {
  if (!calculation?.items?.length) {
    throw new Error("At least one quote item is required before saving.");
  }

  for (let i = 0; i < calculation.items.length; i += 1) {
    const item = calculation.items[i];
    if (Number(item.baseUnitPrice) < 0) {
      throw new Error(`Quote item ${i + 1} base item cost must be non-negative.`);
    }
    if (Number(item.camoUnitPrice) < 0) {
      throw new Error(`Quote item ${i + 1} camo cost must be non-negative.`);
    }
    if (Number(item.decoratedUnitCost) < 0) {
      throw new Error(`Quote item ${i + 1} decorated unit cost cannot be below zero.`);
    }
  }
}

export async function listQuickTurnLookups(filters?: {
  programId?: number | string | null;
  factoryId?: number | string | null;
  includeInactive?: boolean;
}): Promise<QuickTurnLookupPayload> {
  const includeInactive = filters?.includeInactive === true;
  const programFilter = filters?.programId ? Number(filters.programId) : null;
  const factoryFilter = filters?.factoryId ? Number(filters.factoryId) : null;

  const [programs, factories, baseItems, accessories, camoOptions, calculators, feeTypes] =
    await Promise.all([
      db.query<QuickTurnProgram>(
        `SELECT ${PROGRAM_SELECT} FROM public.quick_turn_programs ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY sort_order ASC, name ASC`
      ),
      db.query<QuickTurnFactory>(
        `SELECT ${FACTORY_SELECT} FROM public.quick_turn_factories ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY sort_order ASC, name ASC`
      ),
      db.query<QuickTurnBaseItem>(
        `
        SELECT ${BASE_ITEM_SELECT}
        FROM public.quick_turn_base_items
        WHERE ($1::integer IS NULL OR factory_id = $1::integer)
          AND ($2::boolean = true OR is_active = true)
        ORDER BY sort_order ASC, item_code ASC
        `,
        [factoryFilter, includeInactive]
      ),
      db.query<QuickTurnAccessory>(
        `
        SELECT ${ACCESSORY_SELECT}
        FROM public.quick_turn_accessories
        WHERE ($1::integer IS NULL OR program_id = $1::integer)
          AND ($2::integer IS NULL OR factory_id = $2::integer)
          AND ($3::boolean = true OR is_active = true)
        ORDER BY category ASC, sort_order ASC, name ASC
        `,
        [programFilter, factoryFilter, includeInactive]
      ),
      db.query<QuickTurnCamoOption>(
        `
        SELECT ${CAMO_SELECT}
        FROM public.quick_turn_camo_options
        WHERE ($1::integer IS NULL OR factory_id = $1::integer)
          AND ($2::boolean = true OR is_active = true)
        ORDER BY sort_order ASC, series ASC
        `,
        [factoryFilter, includeInactive]
      ),
      listQuickTurnCalculatorsWithBreaks({
        programId: programFilter,
        factoryId: factoryFilter,
        includeInactive,
      }),
      db.query<QuickTurnFeeType>(
        `SELECT ${FEE_TYPE_SELECT} FROM public.quick_turn_fee_types ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY sort_order ASC, name ASC`
      ),
    ]);

  return {
    programs: programs.rows,
    factories: factories.rows,
    baseItems: baseItems.rows,
    accessories: accessories.rows,
    camoOptions: camoOptions.rows,
    calculators,
    feeTypes: feeTypes.rows,
  };
}

export async function getActiveProgramByIdOrCode(value?: number | string | null) {
  const token = cleanText(value);
  return getOne<QuickTurnProgram>(
    db,
    `
    SELECT ${PROGRAM_SELECT}
    FROM public.quick_turn_programs
    WHERE is_active = true
      AND (
        ($2::integer IS NOT NULL AND id = $2::integer)
        OR UPPER(code) = UPPER($1)
        OR UPPER(name) = UPPER($1)
      )
    LIMIT 1
    `,
    [token, token && /^\d+$/.test(token) ? Number(token) : null],
    "Invalid Quick Turn program."
  );
}

export async function getActiveFactoryByIdOrCode(value?: number | string | null) {
  const token = cleanText(value);
  return getOne<QuickTurnFactory>(
    db,
    `
    SELECT ${FACTORY_SELECT}
    FROM public.quick_turn_factories
    WHERE is_active = true
      AND (
        ($2::integer IS NOT NULL AND id = $2::integer)
        OR UPPER(code) = UPPER($1)
        OR UPPER(name) = UPPER($1)
      )
    LIMIT 1
    `,
    [token, token && /^\d+$/.test(token) ? Number(token) : null],
    "Invalid Quick Turn factory."
  );
}

export async function getActiveBaseItemById(id: string): Promise<QuickTurnBaseItem> {
  return getOne<QuickTurnBaseItem>(
    db,
    `
    SELECT ${BASE_ITEM_SELECT}
    FROM public.quick_turn_base_items
    WHERE id = $1
      AND is_active = true
    LIMIT 1
    `,
    [id],
    "Invalid or inactive base item."
  );
}

export async function getActiveAccessoriesByIds(ids: string[]): Promise<QuickTurnAccessory[]> {
  if (!ids.length) return [];

  const { rows } = await db.query<QuickTurnAccessory>(
    `
    SELECT ${ACCESSORY_SELECT}
    FROM public.quick_turn_accessories
    WHERE id = ANY($1::uuid[])
      AND is_active = true
    ORDER BY sort_order ASC, name ASC
    `,
    [ids]
  );

  return rows;
}

export async function getActiveCamoOptionById(id: string): Promise<QuickTurnCamoOption> {
  return getOne<QuickTurnCamoOption>(
    db,
    `
    SELECT ${CAMO_SELECT}
    FROM public.quick_turn_camo_options
    WHERE id = $1
      AND is_active = true
    LIMIT 1
    `,
    [id],
    "Invalid or inactive camo option."
  );
}

export async function getActiveFeeTypesByIds(ids: number[]): Promise<QuickTurnFeeType[]> {
  if (!ids.length) return [];

  const { rows } = await db.query<QuickTurnFeeType>(
    `
    SELECT ${FEE_TYPE_SELECT}
    FROM public.quick_turn_fee_types
    WHERE id = ANY($1::integer[])
      AND is_active = true
    ORDER BY sort_order ASC, name ASC
    `,
    [ids]
  );

  return rows;
}

function overseasCsDepartmentWhere(alias = "department") {
  return `REPLACE(REPLACE(UPPER(COALESCE(${alias}, '')), '_', ' '), '-', ' ') IN ('OVERSEAS CUSTOMER SERVICE', 'OVERSEAS CS')`;
}

const OVERSEAS_CS_USER_SELECT = `
  id::text AS id,
  username,
  COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), username) AS "displayName",
  email,
  employee_number AS "employeeNumber",
  department
`;

export async function listQuickTurnOverseasCustomerServiceUsers(q?: string | null): Promise<QuickTurnOverseasCustomerServiceUser[]> {
  const search = cleanText(q);
  const params: any[] = [];
  const where = ["COALESCE(is_active, false) = true", overseasCsDepartmentWhere()];

  if (search) {
    params.push(`%${search}%`);
    where.push(`(display_name ILIKE $${params.length} OR name ILIKE $${params.length} OR username ILIKE $${params.length} OR email ILIKE $${params.length} OR employee_number::text ILIKE $${params.length})`);
  }

  const { rows } = await db.query<QuickTurnOverseasCustomerServiceUser>(
    `
    SELECT ${OVERSEAS_CS_USER_SELECT}
    FROM public.users
    WHERE ${where.join(" AND ")}
    ORDER BY COALESCE(NULLIF(display_name, ''), NULLIF(name, ''), username) ASC
    LIMIT 100
    `,
    params
  );

  return rows;
}

export async function getActiveQuickTurnOverseasCustomerServiceUserById(
  id: string | null | undefined
): Promise<QuickTurnOverseasCustomerServiceUser | null> {
  const userId = cleanOptionalUuid(id);
  if (!userId) return null;

  const { rows } = await db.query<QuickTurnOverseasCustomerServiceUser>(
    `
    SELECT ${OVERSEAS_CS_USER_SELECT}
    FROM public.users
    WHERE id = $1::uuid
      AND COALESCE(is_active, false) = true
      AND ${overseasCsDepartmentWhere()}
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] ?? null;
}

export async function listQuickTurnCalculatorsWithBreaks(filters?: {
  programId?: number | null;
  factoryId?: number | null;
  includeInactive?: boolean;
}): Promise<QuickTurnCalculator[]> {
  const includeInactive = filters?.includeInactive === true;

  const { rows } = await db.query<any>(
    `
    SELECT
      c.id,
      c.code,
      c.program_id AS "programId",
      c.factory_id AS "factoryId",
      c.name,
      c.display_label AS "displayLabel",
      c.route_type AS "routeType",
      c.duties_tax_rate::float8 AS "dutiesTaxRate",
      c.tariff_rate::float8 AS "tariffRate",
      c.rebate_rate::float8 AS "rebateRate",
      c.lead_time_note AS "leadTimeNote",
      c.sort_order AS "sortOrder",
      c.is_active AS "isActive",
      b.id AS "breakId",
      b.sort_order AS "breakSortOrder",
      b.label AS "breakLabel",
      b.min_quantity AS "minQuantity",
      b.max_quantity AS "maxQuantity",
      b.management_review_required AS "managementReviewRequired",
      b.margin_rate::float8 AS "marginRate",
      b.surcharge_multiplier::float8 AS "surchargeMultiplier",
      b.air_freight_amount::float8 AS "airFreightAmount",
      b.ddp_base_amount::float8 AS "ddpBaseAmount",
      b.ddp_markup_rate::float8 AS "ddpMarkupRate",
      b.mo_shipping_amount::float8 AS "moShippingAmount",
      b.is_active AS "breakIsActive"
    FROM public.quick_turn_calculators c
    JOIN public.quick_turn_calculator_breaks b ON b.calculator_id = c.id
    WHERE ($1::integer IS NULL OR c.program_id = $1::integer)
      AND ($2::integer IS NULL OR c.factory_id = $2::integer)
      AND ($3::boolean = true OR c.is_active = true)
      AND ($3::boolean = true OR b.is_active = true)
    ORDER BY c.sort_order ASC, c.id ASC, b.sort_order ASC
    `,
    [filters?.programId ?? null, filters?.factoryId ?? null, includeInactive]
  );

  const byCalculator = new Map<number, QuickTurnCalculator>();

  for (const row of rows) {
    let calculator = byCalculator.get(row.id);

    if (!calculator) {
      calculator = {
        id: row.id,
        code: row.code,
        programId: row.programId,
        factoryId: row.factoryId,
        name: row.name,
        displayLabel: row.displayLabel,
        routeType: row.routeType,
        dutiesTaxRate: row.dutiesTaxRate,
        tariffRate: row.tariffRate,
        rebateRate: row.rebateRate,
        leadTimeNote: row.leadTimeNote,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        breaks: [],
      };
      byCalculator.set(row.id, calculator);
    }

    calculator.breaks.push({
      id: row.breakId,
      calculatorId: row.id,
      sortOrder: row.breakSortOrder,
      label: row.breakLabel,
      minQuantity: row.minQuantity,
      maxQuantity: row.maxQuantity,
      managementReviewRequired: row.managementReviewRequired,
      marginRate: row.marginRate,
      surchargeMultiplier: row.surchargeMultiplier,
      airFreightAmount: row.airFreightAmount,
      ddpBaseAmount: row.ddpBaseAmount,
      ddpMarkupRate: row.ddpMarkupRate,
      moShippingAmount: row.moShippingAmount,
      isActive: row.breakIsActive,
    });
  }

  return Array.from(byCalculator.values());
}

async function insertQuoteSnapshotRows(
  client: Queryable,
  quoteId: string,
  calculation: QuickTurnPersistedCalculation
): Promise<void> {
  for (const item of calculation.items) {
    const isCustomCap = item.isCustomCap === true || item.baseItem.isCustomCap === true;
    const customCapDescription = cleanText(item.customCapDescription ?? item.baseItem.customCapDescription);

    const itemResult = await client.query<{ id: string }>(
      `
      INSERT INTO public.quick_turn_quote_items (
        quote_id,
        sort_order,
        base_item_id,
        is_custom_cap,
        custom_cap_description_snapshot,
        base_item_code_snapshot,
        base_item_description_snapshot,
        base_item_price_snapshot,
        decorated_unit_cost_snapshot,
        camo_option_id,
        camo_code_snapshot,
        camo_series_snapshot,
        camo_supplier_snapshot,
        camo_unit_price_snapshot,
        notes
      )
      VALUES (
        $1, $2, $3::uuid, $4, $5, $6, $7, $8, $9,
        $10::uuid, $11, $12, $13, $14, $15
      )
      RETURNING id
      `,
      [
        quoteId,
        item.sortOrder,
        isCustomCap ? null : cleanOptionalUuid(item.baseItem.id),
        isCustomCap,
        customCapDescription,
        item.baseItem.itemCode || item.baseItem.code,
        isCustomCap ? customCapDescription : item.baseItem.fabricDescription,
        item.baseUnitPrice,
        item.decoratedUnitCost,
        item.camoOption?.id ?? null,
        item.camoOption?.code ?? null,
        item.camoOption?.series ?? null,
        item.camoOption?.supplier ?? null,
        item.camoUnitPrice,
        item.notes,
      ]
    );

    const quoteItemId = itemResult.rows[0].id;

    for (const accessory of item.accessories) {
      await client.query(
        `
        INSERT INTO public.quick_turn_quote_item_accessories (
          quote_item_id,
          accessory_id,
          category_snapshot,
          accessory_code_snapshot,
          accessory_name_snapshot,
          pricing_method_snapshot,
          unit_price_snapshot,
          input_values_snapshot,
          calculated_unit_price_snapshot,
          sort_order
        )
        VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        `,
        [
          quoteItemId,
          accessory.id,
          accessory.category,
          accessory.code,
          accessory.name,
          accessory.pricingMethod,
          accessory.unitPrice,
          toJson(accessory.inputValues),
          accessory.calculatedUnitPrice,
          accessory.sortOrder,
        ]
      );
    }

    for (const fee of item.fees) {
      await client.query(
        `
        INSERT INTO public.quick_turn_quote_item_fees (
          quote_item_id,
          fee_type_id,
          fee_code_snapshot,
          fee_name_snapshot,
          amount_snapshot,
          notes,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          quoteItemId,
          fee.feeTypeId,
          fee.feeCode,
          fee.feeName,
          fee.amount,
          fee.notes,
          fee.sortOrder,
        ]
      );
    }

    for (const calculatorResult of item.calculatorResults) {
      const calculator = calculatorResult.calculator;

      for (const resultBreak of calculatorResult.breaks) {
        await client.query(
          `
          INSERT INTO public.quick_turn_quote_results (
            quote_item_id,
            calculator_id,
            calculator_code_snapshot,
            calculator_name_snapshot,
            calculator_route_type_snapshot,
            quantity_break_id,
            break_label_snapshot,
            min_quantity_snapshot,
            max_quantity_snapshot,
            management_review_required_snapshot,
            margin_rate_snapshot,
            surcharge_multiplier_snapshot,
            duties_tax_rate_snapshot,
            tariff_rate_snapshot,
            rebate_rate_snapshot,
            air_freight_amount_snapshot,
            ddp_base_amount_snapshot,
            ddp_markup_rate_snapshot,
            mo_shipping_amount_snapshot,
            surcharged_decorated_cost_snapshot,
            camo_unit_price_snapshot,
            pre_margin_cost_snapshot,
            unit_price_snapshot
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, $23
          )
          `,
          [
            quoteItemId,
            calculator.id,
            calculator.code,
            calculator.name,
            calculator.routeType,
            resultBreak.quantityBreakId,
            resultBreak.breakLabel,
            resultBreak.minQuantity,
            resultBreak.maxQuantity,
            resultBreak.managementReviewRequired,
            resultBreak.marginRate,
            resultBreak.surchargeMultiplier,
            calculator.dutiesTaxRate,
            calculator.tariffRate,
            calculator.rebateRate,
            resultBreak.airFreightAmount,
            resultBreak.ddpBaseAmount,
            resultBreak.ddpMarkupRate,
            resultBreak.moShippingAmount,
            resultBreak.surchargedDecoratedCost,
            resultBreak.camoUnitPrice,
            resultBreak.preMarginCost,
            resultBreak.unitPrice,
          ]
        );
      }
    }
  }
}

export async function saveQuickTurnQuote(
  input: QuickTurnSaveQuoteInput
): Promise<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }> {
  const quoteName = cleanRequiredText(input.quoteName, "Quote name");
  const notes = cleanText(input.notes);
  const workflowSalesOrderNumber = cleanText(input.workflowSalesOrderNumber);
  const overseasCustomerServiceUserId = cleanOptionalUuid(input.overseasCustomerServiceUserId);
  const overseasCustomerServiceNameSnapshot = cleanText(input.overseasCustomerServiceNameSnapshot);
  const overseasCustomerServiceEmailSnapshot = cleanText(input.overseasCustomerServiceEmailSnapshot);
  const overseasCustomerServiceEmployeeNumberSnapshot = cleanOptionalEmployeeNumber(input.overseasCustomerServiceEmployeeNumberSnapshot);
  const quoteRebateRate = cleanNonNegativeNumber(input.quoteRebateRate, "Rebate rate");
  const preparedForCustomerId = cleanOptionalBigintId(input.preparedForCustomerId);
  const preparedForCustomerCodeSnapshot = cleanText(input.preparedForCustomerCodeSnapshot);
  const preparedForCustomerNameSnapshot = cleanText(input.preparedForCustomerNameSnapshot);
  const quotePreparedForDisplay = cleanText(input.quotePreparedForDisplay) ?? preparedForCustomerNameSnapshot;
  const programLogoText = cleanText(input.programLogoText);
  const fob = cleanText(input.fob) ?? "1 U.S. Final Destination";
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);
  const calculation = input.calculation;
  const status = quoteStatus(input.quoteStatus, "DRAFT");

  validatePersistedCalculation(calculation);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const headerResult = await client.query<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }>(
      `
      INSERT INTO public.quick_turn_quotes (
        quote_name,
        quote_status,
        workflow_sales_order_number,
        overseas_customer_service_user_id,
        overseas_customer_service_name_snapshot,
        overseas_customer_service_email_snapshot,
        overseas_customer_service_employee_number_snapshot,
        quote_rebate_rate,
        prepared_for_customer_id,
        prepared_for_customer_code_snapshot,
        prepared_for_customer_name_snapshot,
        quote_prepared_for_display,
        program_logo_text,
        fob,
        program_id,
        factory_id,
        program_code_snapshot,
        program_name_snapshot,
        factory_code_snapshot,
        factory_name_snapshot,
        generated_at,
        valid_until,
        disclaimer,
        input_snapshot,
        result_snapshot,
        notes,
        created_by,
        created_by_user_id,
        created_by_employee_number,
        updated_by,
        updated_by_user_id
      )
      VALUES (
        $1, $2, $3, $4::uuid, $5, $6, $7, $8, $9::bigint, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21::timestamptz, $22::date, $23,
        $24::jsonb, $25::jsonb,
        $26, $27, $28::uuid, $29, $27, $28::uuid
      )
      RETURNING id, quote_number AS "quoteNumber", quote_status AS "quoteStatus"
      `,
      [
        quoteName,
        status,
        workflowSalesOrderNumber,
        overseasCustomerServiceUserId,
        overseasCustomerServiceNameSnapshot,
        overseasCustomerServiceEmailSnapshot,
        overseasCustomerServiceEmployeeNumberSnapshot,
        quoteRebateRate,
        preparedForCustomerId,
        preparedForCustomerCodeSnapshot,
        preparedForCustomerNameSnapshot,
        quotePreparedForDisplay,
        programLogoText,
        fob,
        calculation.program.id,
        calculation.factory.id,
        calculation.program.code,
        calculation.program.name,
        calculation.factory.code,
        calculation.factory.name,
        calculation.generatedAt,
        calculation.validUntil,
        calculation.disclaimer,
        toJson(calculation.input),
        toJson(calculation),
        notes,
        changedBy,
        changedByUserId,
        changedByEmployeeNumber,
      ]
    );

    const quote = headerResult.rows[0];
    await insertQuoteSnapshotRows(client, quote.id, calculation);

    await client.query("COMMIT");

    await createActivityHistory({
      entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
      entityId: quote.id,
      eventType: status === "DRAFT" ? "draft_created" : "created",
      message: status === "DRAFT"
        ? `Quick Turn draft ${quote.quoteNumber} created.`
        : `Quick Turn quote ${quote.quoteNumber} saved.`,
      module: "Quick Turn Quote Calculator",
      userId: changedByUserId,
      userName: changedBy,
      employeeNumber: changedByEmployeeNumber,
      newValue: {
        quoteNumber: quote.quoteNumber,
        quoteName,
        quoteStatus: status,
        workflowSalesOrderNumber,
        overseasCustomerServiceUserId,
        overseasCustomerServiceNameSnapshot,
        overseasCustomerServiceEmailSnapshot,
        overseasCustomerServiceEmployeeNumberSnapshot,
        quoteRebateRate,
        preparedForCustomerId,
        preparedForCustomerCodeSnapshot,
        preparedForCustomerNameSnapshot,
        quotePreparedForDisplay,
        programLogoText,
        fob,
        itemCount: calculation.items.length,
      },
    });

    return quote;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateDraftQuickTurnQuote(
  id: string,
  input: QuickTurnSaveQuoteInput
): Promise<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }> {
  const quoteName = cleanRequiredText(input.quoteName, "Quote name");
  const notes = cleanText(input.notes);
  const workflowSalesOrderNumber = cleanText(input.workflowSalesOrderNumber);
  const overseasCustomerServiceUserId = cleanOptionalUuid(input.overseasCustomerServiceUserId);
  const overseasCustomerServiceNameSnapshot = cleanText(input.overseasCustomerServiceNameSnapshot);
  const overseasCustomerServiceEmailSnapshot = cleanText(input.overseasCustomerServiceEmailSnapshot);
  const overseasCustomerServiceEmployeeNumberSnapshot = cleanOptionalEmployeeNumber(input.overseasCustomerServiceEmployeeNumberSnapshot);
  const quoteRebateRate = cleanNonNegativeNumber(input.quoteRebateRate, "Rebate rate");
  const preparedForCustomerId = cleanOptionalBigintId(input.preparedForCustomerId);
  const preparedForCustomerCodeSnapshot = cleanText(input.preparedForCustomerCodeSnapshot);
  const preparedForCustomerNameSnapshot = cleanText(input.preparedForCustomerNameSnapshot);
  const quotePreparedForDisplay = cleanText(input.quotePreparedForDisplay) ?? preparedForCustomerNameSnapshot;
  const programLogoText = cleanText(input.programLogoText);
  const fob = cleanText(input.fob) ?? "1 U.S. Final Destination";
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);
  const calculation = input.calculation;

  validatePersistedCalculation(calculation);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{
      quoteNumber: string;
      quoteStatus: QuickTurnQuoteStatus;
      isVoided: boolean;
    }>(
      `
      SELECT quote_number AS "quoteNumber",
             quote_status AS "quoteStatus",
             COALESCE(is_voided, false) AS "isVoided"
      FROM public.quick_turn_quotes
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    const row = existing.rows[0];
    if (!row) throw new Error("Saved Quick Turn quote not found.");
    if (row.isVoided) throw new Error("Voided Quick Turn quotes cannot be edited.");
    if (row.quoteStatus !== "DRAFT") {
      throw new Error("Published Quick Turn quotes are locked. Use Duplicate/Revise to make changes.");
    }

    const headerResult = await client.query<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }>(
      `
      UPDATE public.quick_turn_quotes
      SET quote_name = $2,
          workflow_sales_order_number = $3,
          overseas_customer_service_user_id = $4::uuid,
          overseas_customer_service_name_snapshot = $5,
          overseas_customer_service_email_snapshot = $6,
          overseas_customer_service_employee_number_snapshot = $7,
          quote_rebate_rate = $8,
          prepared_for_customer_id = $9::bigint,
          prepared_for_customer_code_snapshot = $10,
          prepared_for_customer_name_snapshot = $11,
          quote_prepared_for_display = $12,
          program_logo_text = $13,
          fob = $14,
          program_id = $15,
          factory_id = $16,
          program_code_snapshot = $17,
          program_name_snapshot = $18,
          factory_code_snapshot = $19,
          factory_name_snapshot = $20,
          generated_at = $21::timestamptz,
          valid_until = $22::date,
          disclaimer = $23,
          input_snapshot = $24::jsonb,
          result_snapshot = $25::jsonb,
          notes = $26,
          updated_at = now(),
          updated_by = $27,
          updated_by_user_id = $28::uuid
      WHERE id = $1
      RETURNING id, quote_number AS "quoteNumber", quote_status AS "quoteStatus"
      `,
      [
        id,
        quoteName,
        workflowSalesOrderNumber,
        overseasCustomerServiceUserId,
        overseasCustomerServiceNameSnapshot,
        overseasCustomerServiceEmailSnapshot,
        overseasCustomerServiceEmployeeNumberSnapshot,
        quoteRebateRate,
        preparedForCustomerId,
        preparedForCustomerCodeSnapshot,
        preparedForCustomerNameSnapshot,
        quotePreparedForDisplay,
        programLogoText,
        fob,
        calculation.program.id,
        calculation.factory.id,
        calculation.program.code,
        calculation.program.name,
        calculation.factory.code,
        calculation.factory.name,
        calculation.generatedAt,
        calculation.validUntil,
        calculation.disclaimer,
        toJson(calculation.input),
        toJson(calculation),
        notes,
        changedBy,
        changedByUserId,
      ]
    );

    await client.query(`DELETE FROM public.quick_turn_quote_items WHERE quote_id = $1`, [id]);
    await insertQuoteSnapshotRows(client, id, calculation);

    await client.query("COMMIT");

    const saved = headerResult.rows[0];

    await createActivityHistory({
      entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
      entityId: id,
      eventType: "draft_updated",
      message: `Quick Turn draft ${saved.quoteNumber} updated.`,
      module: "Quick Turn Quote Calculator",
      userId: changedByUserId,
      userName: changedBy,
      employeeNumber: changedByEmployeeNumber,
      newValue: {
        quoteNumber: saved.quoteNumber,
        quoteName,
        quoteStatus: "DRAFT",
        workflowSalesOrderNumber,
        overseasCustomerServiceUserId,
        overseasCustomerServiceNameSnapshot,
        overseasCustomerServiceEmailSnapshot,
        overseasCustomerServiceEmployeeNumberSnapshot,
        quoteRebateRate,
        preparedForCustomerId,
        preparedForCustomerCodeSnapshot,
        preparedForCustomerNameSnapshot,
        quotePreparedForDisplay,
        programLogoText,
        fob,
        itemCount: calculation.items.length,
      },
    });

    return saved;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const QUOTE_SORTS: Record<string, string> = {
  quoteNumber: "q.quote_number",
  quoteName: "q.quote_name",
  quoteStatus: "q.quote_status",
  workflowSalesOrderNumber: "q.workflow_sales_order_number",
  overseasCustomerServiceName: "q.overseas_customer_service_name_snapshot",
  quoteRebateRate: "q.quote_rebate_rate",
  quotePreparedForDisplay: "q.quote_prepared_for_display",
  programLogoText: "q.program_logo_text",
  fob: "q.fob",
  programName: "q.program_name_snapshot",
  factoryName: "q.factory_name_snapshot",
  generatedAt: "q.generated_at",
  validUntil: "q.valid_until",
  createdAt: "q.created_at",
  createdBy: "q.created_by",
  updatedAt: "q.updated_at",
};

function savedQuoteSummarySelect() {
  return `
    q.id,
    q.quote_number AS "quoteNumber",
    q.quote_name AS "quoteName",
    q.quote_status AS "quoteStatus",
    q.workflow_sales_order_number AS "workflowSalesOrderNumber",
    q.overseas_customer_service_user_id::text AS "overseasCustomerServiceUserId",
    q.overseas_customer_service_name_snapshot AS "overseasCustomerServiceNameSnapshot",
    q.overseas_customer_service_email_snapshot AS "overseasCustomerServiceEmailSnapshot",
    q.overseas_customer_service_employee_number_snapshot AS "overseasCustomerServiceEmployeeNumberSnapshot",
    q.quote_rebate_rate::float8 AS "quoteRebateRate",
    q.prepared_for_customer_id::text AS "preparedForCustomerId",
    q.prepared_for_customer_code_snapshot AS "preparedForCustomerCodeSnapshot",
    q.prepared_for_customer_name_snapshot AS "preparedForCustomerNameSnapshot",
    q.quote_prepared_for_display AS "quotePreparedForDisplay",
    q.program_logo_text AS "programLogoText",
    q.fob AS fob,
    q.source_quote_id AS "sourceQuoteId",
    sq.quote_number AS "sourceQuoteNumber",
    q.revision_number AS "revisionNumber",
    q.published_at AS "publishedAt",
    q.published_by AS "publishedBy",
    q.program_name_snapshot AS "programName",
    q.factory_name_snapshot AS "factoryName",
    q.generated_at AS "generatedAt",
    q.valid_until AS "validUntil",
    q.created_at AS "createdAt",
    q.created_by AS "createdBy",
    q.updated_at AS "updatedAt",
    q.updated_by AS "updatedBy",
    q.is_voided AS "isVoided",
    q.voided_at AS "voidedAt",
    q.voided_by AS "voidedBy",
    q.void_reason AS "voidReason",
    COUNT(DISTINCT qi.id)::int AS "itemCount"
  `;
}

export async function listSavedQuickTurnQuotes(
  filters: QuickTurnQuoteListFilters = {}
): Promise<PagedQuickTurnQuoteResult> {
  const { limit, offset } = limitOffset(filters.limit, filters.offset);
  const params: any[] = [];
  const where: string[] = [];

  pushWhere(where, buildVoidedWhereClause("q", resolveVoidMode(filters)));

  const status = cleanText(filters.quoteStatus);
  if (status) {
    params.push(status.toUpperCase());
    pushWhere(where, `q.quote_status = $${params.length}`);
  }

  const q = cleanText(filters.q);
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    pushWhere(
      where,
      `(
        q.quote_number ILIKE $${idx}
        OR q.quote_name ILIKE $${idx}
        OR q.workflow_sales_order_number ILIKE $${idx}
        OR q.overseas_customer_service_name_snapshot ILIKE $${idx}
        OR q.overseas_customer_service_email_snapshot ILIKE $${idx}
        OR q.prepared_for_customer_code_snapshot ILIKE $${idx}
        OR q.prepared_for_customer_name_snapshot ILIKE $${idx}
        OR q.quote_prepared_for_display ILIKE $${idx}
        OR q.program_logo_text ILIKE $${idx}
        OR q.fob ILIKE $${idx}
        OR q.program_name_snapshot ILIKE $${idx}
        OR q.factory_name_snapshot ILIKE $${idx}
        OR q.created_by ILIKE $${idx}
        OR sq.quote_number ILIKE $${idx}
      )`
    );
  }

  const whereSql = joinWhere(where);
  const sortBy = QUOTE_SORTS[filters.sortBy || ""] ?? "q.created_at";
  const dir = sortDir(filters.sortDir);

  const countResult = await db.query<{ total: number }>(
    `
    SELECT COUNT(*)::int AS total
    FROM public.quick_turn_quotes q
    LEFT JOIN public.quick_turn_quotes sq ON sq.id = q.source_quote_id
    ${whereSql}
    `,
    params
  );

  const dataParams = [...params, limit, offset];
  const { rows } = await db.query<QuickTurnSavedQuoteSummaryRow>(
    `
    SELECT ${savedQuoteSummarySelect()}
    FROM public.quick_turn_quotes q
    LEFT JOIN public.quick_turn_quotes sq ON sq.id = q.source_quote_id
    LEFT JOIN public.quick_turn_quote_items qi ON qi.quote_id = q.id
    ${whereSql}
    GROUP BY q.id, sq.quote_number
    ORDER BY ${sortBy} ${dir}, q.id DESC
    LIMIT $${dataParams.length - 1}
    OFFSET $${dataParams.length}
    `,
    dataParams
  );

  return {
    rows,
    total: countResult.rows[0]?.total ?? 0,
    pageSize: limit,
    offset,
  };
}

export async function getSavedQuickTurnQuoteById(
  id: string,
  opts: StandardRepoOptions = {}
): Promise<QuickTurnSavedQuoteDetail | null> {
  const voidMode = resolveVoidMode(opts);
  const where = joinWhere(["q.id = $1", buildVoidedWhereClause("q", voidMode)]);

  const headerResult = await db.query<any>(
    `
    SELECT
      ${savedQuoteSummarySelect()},
      q.program_code_snapshot AS "programCode",
      q.factory_code_snapshot AS "factoryCode",
      q.disclaimer,
      q.notes,
      q.input_snapshot AS "inputSnapshot",
      q.result_snapshot AS "resultSnapshot"
    FROM public.quick_turn_quotes q
    LEFT JOIN public.quick_turn_quotes sq ON sq.id = q.source_quote_id
    LEFT JOIN public.quick_turn_quote_items qi ON qi.quote_id = q.id
    ${where}
    GROUP BY q.id, sq.quote_number
    LIMIT 1
    `,
    [id]
  );

  const header = headerResult.rows[0];
  if (!header) return null;

  const itemResult = await db.query<any>(
    `
    SELECT
      id,
      sort_order AS "sortOrder",
      COALESCE(is_custom_cap, false) AS "isCustomCap",
      custom_cap_description_snapshot AS "customCapDescription",
      base_item_code_snapshot AS "baseItemCode",
      base_item_description_snapshot AS "baseItemDescription",
      base_item_price_snapshot::float8 AS "baseItemPrice",
      decorated_unit_cost_snapshot::float8 AS "decoratedUnitCost",
      camo_code_snapshot AS "camoCode",
      camo_series_snapshot AS "camoSeries",
      camo_supplier_snapshot AS "camoSupplier",
      camo_unit_price_snapshot::float8 AS "camoUnitPrice",
      notes
    FROM public.quick_turn_quote_items
    WHERE quote_id = $1
    ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
    [id]
  );

  const itemIds = itemResult.rows.map((x: any) => x.id);

  const [accessoryResult, feeResult, resultRows] = itemIds.length
    ? await Promise.all([
        db.query<any>(
          `
          SELECT
            id,
            quote_item_id AS "quoteItemId",
            category_snapshot AS category,
            accessory_code_snapshot AS code,
            accessory_name_snapshot AS name,
            pricing_method_snapshot AS "pricingMethod",
            unit_price_snapshot::float8 AS "unitPrice",
            input_values_snapshot AS "inputValues",
            calculated_unit_price_snapshot::float8 AS "calculatedUnitPrice",
            sort_order AS "sortOrder"
          FROM public.quick_turn_quote_item_accessories
          WHERE quote_item_id = ANY($1::uuid[])
          ORDER BY sort_order ASC, created_at ASC, id ASC
          `,
          [itemIds]
        ),
        db.query<any>(
          `
          SELECT
            id,
            quote_item_id AS "quoteItemId",
            fee_code_snapshot AS "feeCode",
            fee_name_snapshot AS "feeName",
            amount_snapshot::float8 AS amount,
            notes,
            sort_order AS "sortOrder"
          FROM public.quick_turn_quote_item_fees
          WHERE quote_item_id = ANY($1::uuid[])
          ORDER BY sort_order ASC, created_at ASC, id ASC
          `,
          [itemIds]
        ),
        db.query<any>(
          `
          SELECT
            id,
            quote_item_id AS "quoteItemId",
            calculator_code_snapshot AS "calculatorCode",
            calculator_name_snapshot AS "calculatorName",
            calculator_route_type_snapshot AS "calculatorRouteType",
            break_label_snapshot AS "breakLabel",
            min_quantity_snapshot AS "minQuantity",
            max_quantity_snapshot AS "maxQuantity",
            management_review_required_snapshot AS "managementReviewRequired",
            margin_rate_snapshot::float8 AS "marginRate",
            surcharge_multiplier_snapshot::float8 AS "surchargeMultiplier",
            duties_tax_rate_snapshot::float8 AS "dutiesTaxRate",
            tariff_rate_snapshot::float8 AS "tariffRate",
            rebate_rate_snapshot::float8 AS "rebateRate",
            air_freight_amount_snapshot::float8 AS "airFreightAmount",
            ddp_base_amount_snapshot::float8 AS "ddpBaseAmount",
            ddp_markup_rate_snapshot::float8 AS "ddpMarkupRate",
            mo_shipping_amount_snapshot::float8 AS "moShippingAmount",
            surcharged_decorated_cost_snapshot::float8 AS "surchargedDecoratedCost",
            camo_unit_price_snapshot::float8 AS "camoUnitPrice",
            pre_margin_cost_snapshot::float8 AS "preMarginCost",
            unit_price_snapshot::float8 AS "unitPrice"
          FROM public.quick_turn_quote_results
          WHERE quote_item_id = ANY($1::uuid[])
          ORDER BY calculator_code_snapshot ASC, min_quantity_snapshot ASC, created_at ASC, id ASC
          `,
          [itemIds]
        ),
      ])
    : [{ rows: [] }, { rows: [] }, { rows: [] }];

  const accessoriesByItem = new Map<string, any[]>();
  for (const row of accessoryResult.rows) {
    const arr = accessoriesByItem.get(row.quoteItemId) ?? [];
    arr.push(row);
    accessoriesByItem.set(row.quoteItemId, arr);
  }

  const feesByItem = new Map<string, any[]>();
  for (const row of feeResult.rows) {
    const arr = feesByItem.get(row.quoteItemId) ?? [];
    arr.push(row);
    feesByItem.set(row.quoteItemId, arr);
  }

  const resultsByItem = new Map<string, any[]>();
  for (const row of resultRows.rows) {
    const arr = resultsByItem.get(row.quoteItemId) ?? [];
    arr.push(row);
    resultsByItem.set(row.quoteItemId, arr);
  }

  return {
    ...header,
    items: itemResult.rows.map((item: any) => ({
      ...item,
      accessories: accessoriesByItem.get(item.id) ?? [],
      fees: feesByItem.get(item.id) ?? [],
      results: resultsByItem.get(item.id) ?? [],
    })),
  };
}

export async function publishSavedQuickTurnQuote(
  id: string,
  input: QuickTurnAuditInput
): Promise<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }> {
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<any>(
      `
      SELECT q.id,
             q.quote_number AS "quoteNumber",
             q.quote_name AS "quoteName",
             q.quote_status AS "quoteStatus",
             COALESCE(q.is_voided, false) AS "isVoided",
             EXISTS (SELECT 1 FROM public.quick_turn_quote_items qi WHERE qi.quote_id = q.id) AS "hasItems",
             EXISTS (
               SELECT 1
               FROM public.quick_turn_quote_results qr
               JOIN public.quick_turn_quote_items qi ON qi.id = qr.quote_item_id
               WHERE qi.quote_id = q.id
             ) AS "hasResults"
      FROM public.quick_turn_quotes q
      WHERE q.id = $1
      FOR UPDATE
      `,
      [id]
    );

    const row = existing.rows[0];
    if (!row) throw new Error("Saved Quick Turn quote not found.");
    if (row.isVoided) throw new Error("Voided Quick Turn quotes cannot be published.");
    if (row.quoteStatus !== "DRAFT") throw new Error("Only draft Quick Turn quotes can be published.");
    if (!row.hasItems || !row.hasResults) {
      throw new Error("A draft must have saved calculation snapshots before publishing.");
    }

    const result = await client.query<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }>(
      `
      UPDATE public.quick_turn_quotes
      SET quote_status = 'PUBLISHED',
          published_at = now(),
          published_by = $2,
          published_by_user_id = $3::uuid,
          updated_at = now(),
          updated_by = $2,
          updated_by_user_id = $3::uuid
      WHERE id = $1
      RETURNING id, quote_number AS "quoteNumber", quote_status AS "quoteStatus"
      `,
      [id, changedBy, changedByUserId]
    );

    await client.query("COMMIT");

    const published = result.rows[0];

    await createActivityHistory({
      entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
      entityId: id,
      eventType: "quote_published",
      message: `Quick Turn quote ${published.quoteNumber} published.`,
      module: "Quick Turn Quote Calculator",
      userId: changedByUserId,
      userName: changedBy,
      employeeNumber: changedByEmployeeNumber,
      previousValue: { quoteStatus: "DRAFT" },
      newValue: { quoteStatus: "PUBLISHED" },
    });

    return published;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function refreshedDuplicateCalculation(
  rawCalculation: unknown,
  workflowSalesOrderNumber: string | null
): QuickTurnPersistedCalculation {
  const calculation = rawCalculation as QuickTurnPersistedCalculation;
  validatePersistedCalculation(calculation);

  const now = new Date();
  const generatedAt = now.toISOString();
  const validUntil = addDaysAsDateString(now, 30);
  const inputSnapshot = {
    ...(calculation.input && typeof calculation.input === "object" ? calculation.input : {}),
    workflowSalesOrderNumber,
  };

  return {
    ...calculation,
    generatedAt,
    validUntil,
    input: inputSnapshot,
  };
}

export async function duplicateSavedQuickTurnQuote(
  sourceId: string,
  input: QuickTurnAuditInput & { quoteName?: string | null } = {}
): Promise<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus; revisionNumber: number }> {
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const sourceResult = await client.query<any>(
      `
      SELECT id,
             quote_number AS "quoteNumber",
             quote_name AS "quoteName",
             workflow_sales_order_number AS "workflowSalesOrderNumber",
             overseas_customer_service_user_id::text AS "overseasCustomerServiceUserId",
             overseas_customer_service_name_snapshot AS "overseasCustomerServiceNameSnapshot",
             overseas_customer_service_email_snapshot AS "overseasCustomerServiceEmailSnapshot",
             overseas_customer_service_employee_number_snapshot AS "overseasCustomerServiceEmployeeNumberSnapshot",
             quote_rebate_rate::float8 AS "quoteRebateRate",
             prepared_for_customer_id::text AS "preparedForCustomerId",
             prepared_for_customer_code_snapshot AS "preparedForCustomerCodeSnapshot",
             prepared_for_customer_name_snapshot AS "preparedForCustomerNameSnapshot",
             quote_prepared_for_display AS "quotePreparedForDisplay",
             program_logo_text AS "programLogoText",
             fob,
             result_snapshot AS "resultSnapshot",
             notes,
             COALESCE(is_voided, false) AS "isVoided",
             revision_number AS "revisionNumber"
      FROM public.quick_turn_quotes
      WHERE id = $1
      FOR UPDATE
      `,
      [sourceId]
    );

    const source = sourceResult.rows[0];
    if (!source) throw new Error("Saved Quick Turn quote not found.");
    if (source.isVoided) throw new Error("Voided Quick Turn quotes cannot be duplicated or revised.");

    const nextRevisionResult = await client.query<{ nextRevision: number }>(
      `
      SELECT COALESCE(MAX(revision_number), 0)::int + 1 AS "nextRevision"
      FROM public.quick_turn_quotes
      WHERE source_quote_id = $1
      `,
      [source.id]
    );

    const revisionNumber = Math.max(
      nextRevisionResult.rows[0]?.nextRevision ?? 1,
      Number(source.revisionNumber || 0) + 1
    );
    const quoteName = cleanText(input.quoteName) ?? `${source.quoteName} - Rev ${revisionNumber}`;
    const workflowSalesOrderNumber = cleanText(source.workflowSalesOrderNumber);
    const calculation = refreshedDuplicateCalculation(source.resultSnapshot, workflowSalesOrderNumber);

    const headerResult = await client.query<{ id: string; quoteNumber: string; quoteStatus: QuickTurnQuoteStatus }>(
      `
      INSERT INTO public.quick_turn_quotes (
        quote_name,
        quote_status,
        workflow_sales_order_number,
        overseas_customer_service_user_id,
        overseas_customer_service_name_snapshot,
        overseas_customer_service_email_snapshot,
        overseas_customer_service_employee_number_snapshot,
        quote_rebate_rate,
        prepared_for_customer_id,
        prepared_for_customer_code_snapshot,
        prepared_for_customer_name_snapshot,
        quote_prepared_for_display,
        program_logo_text,
        fob,
        source_quote_id,
        revision_number,
        program_id,
        factory_id,
        program_code_snapshot,
        program_name_snapshot,
        factory_code_snapshot,
        factory_name_snapshot,
        generated_at,
        valid_until,
        disclaimer,
        input_snapshot,
        result_snapshot,
        notes,
        created_by,
        created_by_user_id,
        created_by_employee_number,
        updated_by,
        updated_by_user_id
      )
      VALUES (
        $1, 'DRAFT', $2, $3::uuid, $4, $5, $6, $7, $8::bigint, $9, $10, $11, $12, $13,
        $14::uuid, $15, $16, $17, $18, $19, $20, $21,
        $22::timestamptz, $23::date, $24,
        $25::jsonb, $26::jsonb,
        $27, $28, $29::uuid, $30, $28, $29::uuid
      )
      RETURNING id, quote_number AS "quoteNumber", quote_status AS "quoteStatus"
      `,
      [
        quoteName,
        workflowSalesOrderNumber,
        cleanOptionalUuid(source.overseasCustomerServiceUserId),
        cleanText(source.overseasCustomerServiceNameSnapshot),
        cleanText(source.overseasCustomerServiceEmailSnapshot),
        cleanOptionalEmployeeNumber(source.overseasCustomerServiceEmployeeNumberSnapshot),
        cleanNonNegativeNumber(source.quoteRebateRate, "Rebate rate"),
        cleanOptionalBigintId(source.preparedForCustomerId),
        cleanText(source.preparedForCustomerCodeSnapshot),
        cleanText(source.preparedForCustomerNameSnapshot),
        cleanText(source.quotePreparedForDisplay),
        cleanText(source.programLogoText),
        cleanText(source.fob) ?? "1 U.S. Final Destination",
        source.id,
        revisionNumber,
        calculation.program.id,
        calculation.factory.id,
        calculation.program.code,
        calculation.program.name,
        calculation.factory.code,
        calculation.factory.name,
        calculation.generatedAt,
        calculation.validUntil,
        calculation.disclaimer,
        toJson({
          ...(calculation.input && typeof calculation.input === "object" ? calculation.input : {}),
          workflowSalesOrderNumber,
          overseasCustomerServiceUserId: cleanOptionalUuid(source.overseasCustomerServiceUserId),
          overseasCustomerServiceNameSnapshot: cleanText(source.overseasCustomerServiceNameSnapshot),
          overseasCustomerServiceEmailSnapshot: cleanText(source.overseasCustomerServiceEmailSnapshot),
          overseasCustomerServiceEmployeeNumberSnapshot: cleanOptionalEmployeeNumber(source.overseasCustomerServiceEmployeeNumberSnapshot),
          quoteRebateRate: cleanNonNegativeNumber(source.quoteRebateRate, "Rebate rate"),
          rebatePercent: cleanNonNegativeNumber(source.quoteRebateRate, "Rebate rate") * 100,
        }),
        toJson({
          ...calculation,
          input: {
            ...(calculation.input && typeof calculation.input === "object" ? calculation.input : {}),
            workflowSalesOrderNumber,
            overseasCustomerServiceUserId: cleanOptionalUuid(source.overseasCustomerServiceUserId),
            overseasCustomerServiceNameSnapshot: cleanText(source.overseasCustomerServiceNameSnapshot),
            overseasCustomerServiceEmailSnapshot: cleanText(source.overseasCustomerServiceEmailSnapshot),
            overseasCustomerServiceEmployeeNumberSnapshot: cleanOptionalEmployeeNumber(source.overseasCustomerServiceEmployeeNumberSnapshot),
            quoteRebateRate: cleanNonNegativeNumber(source.quoteRebateRate, "Rebate rate"),
            rebatePercent: cleanNonNegativeNumber(source.quoteRebateRate, "Rebate rate") * 100,
          },
        }),
        source.notes,
        changedBy,
        changedByUserId,
        changedByEmployeeNumber,
      ]
    );

    const duplicate = headerResult.rows[0];
    await insertQuoteSnapshotRows(client, duplicate.id, calculation);

    await client.query("COMMIT");

    await createActivityHistory({
      entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
      entityId: duplicate.id,
      eventType: "quote_duplicated",
      message: `Quick Turn draft ${duplicate.quoteNumber} duplicated/revised from ${source.quoteNumber}.`,
      module: "Quick Turn Quote Calculator",
      userId: changedByUserId,
      userName: changedBy,
      employeeNumber: changedByEmployeeNumber,
      newValue: {
        quoteNumber: duplicate.quoteNumber,
        quoteName,
        quoteStatus: "DRAFT",
        sourceQuoteId: source.id,
        sourceQuoteNumber: source.quoteNumber,
        revisionNumber,
        overseasCustomerServiceUserId: cleanOptionalUuid(source.overseasCustomerServiceUserId),
        overseasCustomerServiceNameSnapshot: cleanText(source.overseasCustomerServiceNameSnapshot),
        quoteRebateRate: cleanNonNegativeNumber(source.quoteRebateRate, "Rebate rate"),
        preparedForCustomerId: cleanOptionalBigintId(source.preparedForCustomerId),
        quotePreparedForDisplay: cleanText(source.quotePreparedForDisplay),
        programLogoText: cleanText(source.programLogoText),
        fob: cleanText(source.fob) ?? "1 U.S. Final Destination",
      },
    });

    return { ...duplicate, revisionNumber };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function voidSavedQuickTurnQuote(
  id: string,
  input: QuickTurnAuditInput & { voidReason?: string | null }
): Promise<void> {
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const reason = cleanText(input.voidReason) ?? "Voided";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);

  const result = await db.query<{ quoteNumber: string; quoteName: string }>(
    `
    UPDATE public.quick_turn_quotes
    SET is_voided = true,
        voided_at = now(),
        voided_by = $2,
        void_reason = $3,
        updated_at = now(),
        updated_by = $2,
        updated_by_user_id = $4::uuid
    WHERE id = $1
      AND COALESCE(is_voided, false) = false
    RETURNING quote_number AS "quoteNumber", quote_name AS "quoteName"
    `,
    [id, changedBy, reason, changedByUserId]
  );

  const row = result.rows[0];
  if (!row) throw new Error("Saved Quick Turn quote was not found or is already voided.");

  await createActivityHistory({
    entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
    entityId: id,
    eventType: "voided",
    message: `Quick Turn quote ${row.quoteNumber} voided.`,
    module: "Quick Turn Quote Calculator",
    userId: changedByUserId,
    userName: changedBy,
    employeeNumber: changedByEmployeeNumber,
    newValue: { reason },
  });
}

export async function unvoidSavedQuickTurnQuote(
  id: string,
  input: QuickTurnAuditInput
): Promise<void> {
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);

  const result = await db.query<{ quoteNumber: string; quoteName: string }>(
    `
    UPDATE public.quick_turn_quotes
    SET is_voided = false,
        voided_at = NULL,
        voided_by = NULL,
        void_reason = NULL,
        updated_at = now(),
        updated_by = $2,
        updated_by_user_id = $3::uuid
    WHERE id = $1
      AND COALESCE(is_voided, false) = true
    RETURNING quote_number AS "quoteNumber", quote_name AS "quoteName"
    `,
    [id, changedBy, changedByUserId]
  );

  const row = result.rows[0];
  if (!row) throw new Error("Saved Quick Turn quote was not found or is not voided.");

  await createActivityHistory({
    entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
    entityId: id,
    eventType: "unvoided",
    message: `Quick Turn quote ${row.quoteNumber} unvoided.`,
    module: "Quick Turn Quote Calculator",
    userId: changedByUserId,
    userName: changedBy,
    employeeNumber: changedByEmployeeNumber,
  });
}

export const quickTurnQuoteCalculatorRepoInternals = {
  cleanNonNegativeNumber,
};
