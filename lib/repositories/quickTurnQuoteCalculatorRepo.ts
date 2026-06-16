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
  input: unknown;
  items: QuickTurnPersistedQuoteItem[];
};

export type QuickTurnPersistedQuoteItem = {
  clientItemId: string;
  sortOrder: number;
  baseItem: {
    id: string;
    code: string;
    itemCode: string;
    fabricDescription: string | null;
    basePrice: number;
  };
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
    calculators: calculators,
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

export async function saveQuickTurnQuote(
  input: QuickTurnSaveQuoteInput
): Promise<{ id: string; quoteNumber: string }> {
  const quoteName = cleanRequiredText(input.quoteName, "Quote name");
  const notes = cleanText(input.notes);
  const changedBy = cleanText(input.changedBy) ?? "Unknown User";
  const changedByUserId = cleanOptionalUuid(input.changedByUserId);
  const changedByEmployeeNumber = cleanOptionalEmployeeNumber(input.changedByEmployeeNumber);
  const calculation = input.calculation;

  if (!calculation?.items?.length) {
    throw new Error("At least one quote item is required before saving.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const headerResult = await client.query<{ id: string; quoteNumber: string }>(
      `
      INSERT INTO public.quick_turn_quotes (
        quote_name,
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
        $1, $2, $3, $4, $5, $6, $7,
        $8::timestamptz, $9::date, $10,
        $11::jsonb, $12::jsonb,
        $13, $14, $15::uuid, $16, $14, $15::uuid
      )
      RETURNING id, quote_number AS "quoteNumber"
      `,
      [
        quoteName,
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

    for (const item of calculation.items) {
      const itemResult = await client.query<{ id: string }>(
        `
        INSERT INTO public.quick_turn_quote_items (
          quote_id,
          sort_order,
          base_item_id,
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
          $1, $2, $3::uuid, $4, $5, $6, $7,
          $8::uuid, $9, $10, $11, $12, $13
        )
        RETURNING id
        `,
        [
          quote.id,
          item.sortOrder,
          item.baseItem.id,
          item.baseItem.itemCode || item.baseItem.code,
          item.baseItem.fabricDescription,
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

    await client.query("COMMIT");

    await createActivityHistory({
      entityType: QUICK_TURN_QUOTE_ENTITY_TYPE,
      entityId: quote.id,
      eventType: "created",
      message: `Quick Turn quote ${quote.quoteNumber} saved.`,
      module: "Quick Turn Quote Calculator",
      userId: changedByUserId,
      userName: changedBy,
      employeeNumber: changedByEmployeeNumber,
      newValue: {
        quoteNumber: quote.quoteNumber,
        quoteName,
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

const QUOTE_SORTS: Record<string, string> = {
  quoteNumber: "q.quote_number",
  quoteName: "q.quote_name",
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

  const q = cleanText(filters.q);
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    pushWhere(
      where,
      `(
        q.quote_number ILIKE $${idx}
        OR q.quote_name ILIKE $${idx}
        OR q.program_name_snapshot ILIKE $${idx}
        OR q.factory_name_snapshot ILIKE $${idx}
        OR q.created_by ILIKE $${idx}
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
    ${whereSql}
    `,
    params
  );

  const dataParams = [...params, limit, offset];
  const { rows } = await db.query<QuickTurnSavedQuoteSummaryRow>(
    `
    SELECT ${savedQuoteSummarySelect()}
    FROM public.quick_turn_quotes q
    LEFT JOIN public.quick_turn_quote_items qi ON qi.quote_id = q.id
    ${whereSql}
    GROUP BY q.id
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
    LEFT JOIN public.quick_turn_quote_items qi ON qi.quote_id = q.id
    ${where}
    GROUP BY q.id
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
