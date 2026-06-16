// lib/repositories/quickTurnQuoteCalculatorSetupRepo.ts

import { db } from "@/lib/db";

export type QuickTurnSetupResource =
  | "programs"
  | "factories"
  | "base-items"
  | "accessories"
  | "camo-options"
  | "calculators"
  | "calculator-breaks"
  | "fee-types";

export type QuickTurnSetupAuditInput = {
  changedBy?: string | null;
};

export type QuickTurnSetupListOptions = {
  includeInactive?: boolean;
  programId?: string | number | null;
  factoryId?: string | number | null;
  category?: string | null;
  calculatorId?: string | number | null;
  q?: string | null;
};

type FieldType =
  | "text"
  | "nullableText"
  | "int"
  | "nullableInt"
  | "positiveInt"
  | "number"
  | "nullableNumber"
  | "boolean"
  | "json";

type FieldDef = {
  column: string;
  type: FieldType;
  label: string;
  required?: boolean;
  min?: number;
  allowedValues?: string[];
};

type ResourceConfig = {
  table: string;
  idCast: "integer" | "uuid";
  selectSql: string;
  orderBy: string;
  searchableColumns: string[];
  fields: Record<string, FieldDef>;
};

const RESOURCE_CONFIG: Record<QuickTurnSetupResource, ResourceConfig> = {
  programs: {
    table: "public.quick_turn_programs",
    idCast: "integer",
    selectSql: `
      id,
      code,
      name,
      description,
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "sort_order ASC, name ASC",
    searchableColumns: ["code", "name", "description"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      name: { column: "name", type: "text", label: "Name", required: true },
      description: { column: "description", type: "nullableText", label: "Description" },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  factories: {
    table: "public.quick_turn_factories",
    idCast: "integer",
    selectSql: `
      id,
      code,
      name,
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "sort_order ASC, name ASC",
    searchableColumns: ["code", "name"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      name: { column: "name", type: "text", label: "Name", required: true },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  "base-items": {
    table: "public.quick_turn_base_items",
    idCast: "uuid",
    selectSql: `
      id,
      code,
      factory_id AS "factoryId",
      item_code AS "itemCode",
      fabric_description AS "fabricDescription",
      base_price::float8 AS "basePrice",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "sort_order ASC, item_code ASC",
    searchableColumns: ["code", "item_code", "fabric_description"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      factoryId: { column: "factory_id", type: "positiveInt", label: "Factory", required: true },
      itemCode: { column: "item_code", type: "text", label: "Item Code", required: true },
      fabricDescription: { column: "fabric_description", type: "nullableText", label: "Fabric Description" },
      basePrice: { column: "base_price", type: "number", label: "Base Price", required: true, min: 0 },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  accessories: {
    table: "public.quick_turn_accessories",
    idCast: "uuid",
    selectSql: `
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
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "category ASC, sort_order ASC, name ASC",
    searchableColumns: ["code", "category", "name", "pricing_method", "notes"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      programId: { column: "program_id", type: "positiveInt", label: "Program", required: true },
      factoryId: { column: "factory_id", type: "positiveInt", label: "Factory", required: true },
      category: {
        column: "category",
        type: "text",
        label: "Category",
        required: true,
        allowedValues: ["DECORATION", "CLOSURE"],
      },
      name: { column: "name", type: "text", label: "Name", required: true },
      unitPrice: { column: "unit_price", type: "number", label: "Unit Price", required: true, min: 0 },
      pricingMethod: { column: "pricing_method", type: "text", label: "Pricing Method", required: true },
      notes: { column: "notes", type: "nullableText", label: "Notes" },
      inputConfig: { column: "input_config", type: "json", label: "Input Config" },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  "camo-options": {
    table: "public.quick_turn_camo_options",
    idCast: "uuid",
    selectSql: `
      id,
      code,
      factory_id AS "factoryId",
      series,
      supplier,
      unit_price::float8 AS "unitPrice",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "sort_order ASC, series ASC",
    searchableColumns: ["code", "series", "supplier"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      factoryId: { column: "factory_id", type: "positiveInt", label: "Factory", required: true },
      series: { column: "series", type: "text", label: "Series", required: true },
      supplier: { column: "supplier", type: "text", label: "Supplier", required: true },
      unitPrice: { column: "unit_price", type: "number", label: "Unit Price", required: true, min: 0 },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  calculators: {
    table: "public.quick_turn_calculators",
    idCast: "integer",
    selectSql: `
      id,
      code,
      program_id AS "programId",
      factory_id AS "factoryId",
      name,
      display_label AS "displayLabel",
      route_type AS "routeType",
      duties_tax_rate::float8 AS "dutiesTaxRate",
      tariff_rate::float8 AS "tariffRate",
      rebate_rate::float8 AS "rebateRate",
      lead_time_note AS "leadTimeNote",
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "sort_order ASC, name ASC",
    searchableColumns: ["code", "name", "display_label", "route_type", "lead_time_note"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      programId: { column: "program_id", type: "positiveInt", label: "Program", required: true },
      factoryId: { column: "factory_id", type: "positiveInt", label: "Factory", required: true },
      name: { column: "name", type: "text", label: "Name", required: true },
      displayLabel: { column: "display_label", type: "text", label: "Display Label", required: true },
      routeType: {
        column: "route_type",
        type: "text",
        label: "Route Type",
        required: true,
        allowedValues: ["STANDARD", "DDP_MO_AIR", "DDP_DIRECT_AIR"],
      },
      dutiesTaxRate: { column: "duties_tax_rate", type: "number", label: "Duties/Tax Rate", min: 0 },
      tariffRate: { column: "tariff_rate", type: "number", label: "Tariff Rate", min: 0 },
      rebateRate: { column: "rebate_rate", type: "number", label: "Rebate Rate", min: 0 },
      leadTimeNote: { column: "lead_time_note", type: "nullableText", label: "Lead Time Note" },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  "calculator-breaks": {
    table: "public.quick_turn_calculator_breaks",
    idCast: "integer",
    selectSql: `
      id,
      calculator_id AS "calculatorId",
      sort_order AS "sortOrder",
      label,
      min_quantity AS "minQuantity",
      max_quantity AS "maxQuantity",
      management_review_required AS "managementReviewRequired",
      margin_rate::float8 AS "marginRate",
      surcharge_multiplier::float8 AS "surchargeMultiplier",
      air_freight_amount::float8 AS "airFreightAmount",
      ddp_base_amount::float8 AS "ddpBaseAmount",
      ddp_markup_rate::float8 AS "ddpMarkupRate",
      mo_shipping_amount::float8 AS "moShippingAmount",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "calculator_id ASC, sort_order ASC, min_quantity ASC",
    searchableColumns: ["label"],
    fields: {
      calculatorId: { column: "calculator_id", type: "positiveInt", label: "Calculator", required: true },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      label: { column: "label", type: "text", label: "Label", required: true },
      minQuantity: { column: "min_quantity", type: "positiveInt", label: "Min Quantity", required: true },
      maxQuantity: { column: "max_quantity", type: "nullableInt", label: "Max Quantity" },
      managementReviewRequired: { column: "management_review_required", type: "boolean", label: "Management Review" },
      marginRate: { column: "margin_rate", type: "number", label: "Margin Rate", min: 0 },
      surchargeMultiplier: { column: "surcharge_multiplier", type: "number", label: "Surcharge Multiplier", min: 0 },
      airFreightAmount: { column: "air_freight_amount", type: "nullableNumber", label: "Air Freight Amount", min: 0 },
      ddpBaseAmount: { column: "ddp_base_amount", type: "nullableNumber", label: "DDP Base Amount", min: 0 },
      ddpMarkupRate: { column: "ddp_markup_rate", type: "nullableNumber", label: "DDP Markup Rate", min: 0 },
      moShippingAmount: { column: "mo_shipping_amount", type: "nullableNumber", label: "MO Shipping Amount", min: 0 },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
  "fee-types": {
    table: "public.quick_turn_fee_types",
    idCast: "integer",
    selectSql: `
      id,
      code,
      name,
      description,
      sort_order AS "sortOrder",
      is_active AS "isActive",
      created_at AS "createdAt",
      created_by AS "createdBy",
      updated_at AS "updatedAt",
      updated_by AS "updatedBy"
    `,
    orderBy: "sort_order ASC, name ASC",
    searchableColumns: ["code", "name", "description"],
    fields: {
      code: { column: "code", type: "text", label: "Code", required: true },
      name: { column: "name", type: "text", label: "Name", required: true },
      description: { column: "description", type: "nullableText", label: "Description" },
      sortOrder: { column: "sort_order", type: "int", label: "Sort Order" },
      isActive: { column: "is_active", type: "boolean", label: "Active" },
    },
  },
};

function configFor(resource: QuickTurnSetupResource) {
  const config = RESOURCE_CONFIG[resource];
  if (!config) throw new Error("Invalid Quick Turn setup resource.");
  return config;
}

function cleanText(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function cleanBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const token = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "active"].includes(token);
}

function cleanJson(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined || value === "") return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // handled below
    }
    throw new Error("Input Config must be valid JSON object syntax.");
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Input Config must be a JSON object.");
}

function cleanValue(fieldKey: string, field: FieldDef, raw: unknown, forCreate: boolean) {
  const hasValue = raw !== undefined;

  if (!hasValue) {
    if (forCreate && field.required) throw new Error(`${field.label} is required.`);
    return undefined;
  }

  if (field.type === "boolean") return cleanBoolean(raw);

  if (field.type === "json") return cleanJson(raw);

  if (field.type === "text" || field.type === "nullableText") {
    const text = cleanText(raw);
    if (field.required && !text) throw new Error(`${field.label} is required.`);
    if (field.allowedValues?.length && text && !field.allowedValues.includes(text)) {
      throw new Error(`${field.label} must be one of: ${field.allowedValues.join(", ")}.`);
    }
    return field.type === "nullableText" ? text : text ?? "";
  }

  if (field.type === "int" || field.type === "nullableInt" || field.type === "positiveInt") {
    if ((raw === null || raw === undefined || raw === "") && field.type === "nullableInt") return null;
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new Error(`${field.label} must be a whole number.`);
    if (field.type === "positiveInt" && n <= 0) throw new Error(`${field.label} must be greater than zero.`);
    return n;
  }

  if (field.type === "number" || field.type === "nullableNumber") {
    if ((raw === null || raw === undefined || raw === "") && field.type === "nullableNumber") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`${field.label} must be a valid number.`);
    if (typeof field.min === "number" && n < field.min) {
      throw new Error(`${field.label} must be at least ${field.min}.`);
    }
    return n;
  }

  throw new Error(`Unsupported setup field ${fieldKey}.`);
}

function sanitizeInput(resource: QuickTurnSetupResource, input: Record<string, unknown>, forCreate: boolean) {
  const config = configFor(resource);
  const out: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(config.fields)) {
    const value = cleanValue(key, field, input[key], forCreate);
    if (value !== undefined) out[field.column] = value;
  }

  if (resource === "calculator-breaks") {
    const min = out.min_quantity;
    const max = out.max_quantity;
    if (typeof min === "number" && typeof max === "number" && max < min) {
      throw new Error("Max Quantity must be greater than or equal to Min Quantity.");
    }
  }

  return out;
}

function buildSearchWhere(config: ResourceConfig, q: string | null, params: unknown[]) {
  const token = cleanText(q);
  if (!token || !config.searchableColumns.length) return null;

  const placeholders = config.searchableColumns.map((column) => `${column} ILIKE $${params.length + 1}`);
  params.push(`%${token}%`);
  return `(${placeholders.join(" OR ")})`;
}

function addFilter(where: string[], params: unknown[], column: string, value: unknown, cast: "integer" | "text" = "integer") {
  const token = cleanText(value);
  if (!token) return;
  params.push(cast === "integer" ? Number(token) : token);
  where.push(`${column} = $${params.length}::${cast}`);
}

export async function listQuickTurnSetupResource(
  resource: QuickTurnSetupResource,
  options: QuickTurnSetupListOptions = {}
) {
  const config = configFor(resource);
  const params: unknown[] = [];
  const where: string[] = [];

  if (options.includeInactive !== true) {
    where.push("is_active = true");
  }

  if (resource === "base-items" || resource === "camo-options") {
    addFilter(where, params, "factory_id", options.factoryId);
  }

  if (resource === "accessories" || resource === "calculators") {
    addFilter(where, params, "program_id", options.programId);
    addFilter(where, params, "factory_id", options.factoryId);
  }

  if (resource === "accessories") {
    addFilter(where, params, "category", options.category, "text");
  }

  if (resource === "calculator-breaks") {
    addFilter(where, params, "calculator_id", options.calculatorId);
  }

  const searchWhere = buildSearchWhere(config, options.q ?? null, params);
  if (searchWhere) where.push(searchWhere);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT ${config.selectSql} FROM ${config.table} ${whereSql} ORDER BY ${config.orderBy}`,
    params
  );

  return rows;
}

export async function getQuickTurnSetupResourceById(resource: QuickTurnSetupResource, id: string | number) {
  const config = configFor(resource);
  const { rows } = await db.query(
    `SELECT ${config.selectSql} FROM ${config.table} WHERE id = $1::${config.idCast} LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createQuickTurnSetupResource(
  resource: QuickTurnSetupResource,
  input: Record<string, unknown>,
  audit: QuickTurnSetupAuditInput = {}
) {
  const config = configFor(resource);
  const values = sanitizeInput(resource, input, true);

  values.created_by = audit.changedBy ?? null;
  values.updated_by = audit.changedBy ?? null;

  const columns = Object.keys(values);
  const params = Object.values(values).map((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
    return value;
  });
  const placeholders = columns.map((_, index) => `$${index + 1}`);

  const { rows } = await db.query(
    `
    INSERT INTO ${config.table} (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    RETURNING ${config.selectSql}
    `,
    params
  );

  return rows[0];
}

export async function updateQuickTurnSetupResource(
  resource: QuickTurnSetupResource,
  id: string | number,
  input: Record<string, unknown>,
  audit: QuickTurnSetupAuditInput = {}
) {
  const config = configFor(resource);
  const values = sanitizeInput(resource, input, false);

  values.updated_at = "__NOW__";
  values.updated_by = audit.changedBy ?? null;

  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [column, value] of Object.entries(values)) {
    if (column === "updated_at" && value === "__NOW__") {
      assignments.push(`${column} = now()`);
      continue;
    }

    params.push(value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (!assignments.length) {
    return getQuickTurnSetupResourceById(resource, id);
  }

  params.push(id);

  const { rows } = await db.query(
    `
    UPDATE ${config.table}
    SET ${assignments.join(", ")}
    WHERE id = $${params.length}::${config.idCast}
    RETURNING ${config.selectSql}
    `,
    params
  );

  if (!rows[0]) throw new Error("Quick Turn setup record not found.");
  return rows[0];
}

export async function setQuickTurnSetupResourceActive(
  resource: QuickTurnSetupResource,
  id: string | number,
  isActive: boolean,
  audit: QuickTurnSetupAuditInput = {}
) {
  const config = configFor(resource);
  const { rows } = await db.query(
    `
    UPDATE ${config.table}
    SET is_active = $1,
        updated_at = now(),
        updated_by = $2
    WHERE id = $3::${config.idCast}
    RETURNING ${config.selectSql}
    `,
    [isActive, audit.changedBy ?? null, id]
  );

  if (!rows[0]) throw new Error("Quick Turn setup record not found.");
  return rows[0];
}
