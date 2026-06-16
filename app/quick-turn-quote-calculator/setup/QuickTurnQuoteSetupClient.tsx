// app/quick-turn-quote-calculator/setup/QuickTurnQuoteSetupClient.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ResourceKey =
  | "programs"
  | "factories"
  | "base-items"
  | "accessories"
  | "camo-options"
  | "calculators"
  | "calculator-breaks"
  | "fee-types";

type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "programSelect"
  | "factorySelect"
  | "calculatorSelect"
  | "categorySelect"
  | "routeTypeSelect"
  | "pricingMethodSelect"
  | "inputRequirements"
  | "json";

type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  step?: string;
  helper?: string;
};

type ResourceDef = {
  key: ResourceKey;
  label: string;
  description: string;
  endpoint: string;
  idType: "number" | "uuid";
  fields: FieldDef[];
  columns: Array<{ key: string; label: string; format?: "money" | "rate" | "bool" | "program" | "factory" | "calculator" | "json" }>;
};

type SetupRows = Record<ResourceKey, Array<Record<string, any>>>;

const EMPTY_ROWS: SetupRows = {
  programs: [],
  factories: [],
  "base-items": [],
  accessories: [],
  "camo-options": [],
  calculators: [],
  "calculator-breaks": [],
  "fee-types": [],
};

const RESOURCE_DEFS: ResourceDef[] = [
  {
    key: "programs",
    label: "Programs",
    description: "Quote programs such as Quick Turn. Phase 1 has Quick Turn only.",
    endpoint: "/api/quick-turn-quote-calculator/setup/programs",
    idType: "number",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true, placeholder: "QUICK_TURN" },
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Quick Turn" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "sortOrder", label: "Sort" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "factories",
    label: "Factories",
    description: "Factory list. Phase 1 has J&F only, but this keeps future factories expandable.",
    endpoint: "/api/quick-turn-quote-calculator/setup/factories",
    idType: "number",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true, placeholder: "JF" },
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "J&F" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "sortOrder", label: "Sort" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "base-items",
    label: "Base Items",
    description: "J&F item pricing used as the starting cap/item cost before decorations, closure, and calculator logic.",
    endpoint: "/api/quick-turn-quote-calculator/setup/base-items",
    idType: "uuid",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true, placeholder: "JF_I1000" },
      { key: "factoryId", label: "Factory", kind: "factorySelect", required: true },
      { key: "itemCode", label: "Item Code", kind: "text", required: true, placeholder: "i1000" },
      { key: "fabricDescription", label: "Fabric Description", kind: "textarea" },
      { key: "basePrice", label: "Base Price", kind: "number", required: true, step: "0.000001" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "itemCode", label: "Item" },
      { key: "fabricDescription", label: "Description" },
      { key: "factoryId", label: "Factory", format: "factory" },
      { key: "basePrice", label: "Base Price", format: "money" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "accessories",
    label: "Accessories / Closures",
    description: "Decorations, variable-price additions, and closures. Category controls whether it appears as a decoration or closure.",
    endpoint: "/api/quick-turn-quote-calculator/setup/accessories",
    idType: "uuid",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true, placeholder: "FLAT_EMBROIDERY" },
      { key: "programId", label: "Program", kind: "programSelect", required: true },
      { key: "factoryId", label: "Factory", kind: "factorySelect", required: true },
      { key: "category", label: "Category", kind: "categorySelect", required: true },
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "unitPrice", label: "Unit Price", kind: "number", required: true, step: "0.000001" },
      { key: "pricingMethod", label: "Pricing Method", kind: "pricingMethodSelect", required: true },
      { key: "inputConfig", label: "Required Quote Inputs", kind: "inputRequirements", helper: "Choose which extra fields the user must enter when this option is selected." },
      { key: "notes", label: "Notes", kind: "textarea" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "category", label: "Category" },
      { key: "name", label: "Name" },
      { key: "pricingMethod", label: "Method" },
      { key: "unitPrice", label: "Unit Price", format: "money" },
      { key: "inputConfig", label: "Inputs", format: "json" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "camo-options",
    label: "Camo Options",
    description: "Camo charges added after calculator surcharge, not included in decorated item cost before surcharge.",
    endpoint: "/api/quick-turn-quote-calculator/setup/camo-options",
    idType: "uuid",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true },
      { key: "factoryId", label: "Factory", kind: "factorySelect", required: true },
      { key: "series", label: "Series", kind: "text", required: true },
      { key: "supplier", label: "Supplier", kind: "text", required: true },
      { key: "unitPrice", label: "Unit Price", kind: "number", required: true, step: "0.000001" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "series", label: "Series" },
      { key: "supplier", label: "Supplier" },
      { key: "factoryId", label: "Factory", format: "factory" },
      { key: "unitPrice", label: "Unit Price", format: "money" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "calculators",
    label: "Calculators",
    description: "Calculator-level values such as duties/taxes, tariff, rebate, route type, and lead-time notes.",
    endpoint: "/api/quick-turn-quote-calculator/setup/calculators",
    idType: "number",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true, placeholder: "STANDARD_QT" },
      { key: "programId", label: "Program", kind: "programSelect", required: true },
      { key: "factoryId", label: "Factory", kind: "factorySelect", required: true },
      { key: "name", label: "Name", kind: "text", required: true },
      { key: "displayLabel", label: "Display Label", kind: "text", required: true },
      { key: "routeType", label: "Route Type", kind: "routeTypeSelect", required: true },
      { key: "dutiesTaxRate", label: "Duties / Tax Rate", kind: "number", step: "0.000001", helper: "Use decimal form. Example: 0.08 for 8%." },
      { key: "tariffRate", label: "Tariff Rate", kind: "number", step: "0.000001", helper: "Use decimal form. Example: 0.145 for 14.5%." },
      { key: "rebateRate", label: "Rebate Rate", kind: "number", step: "0.000001", helper: "Use decimal form." },
      { key: "leadTimeNote", label: "Lead Time Note", kind: "textarea" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "routeType", label: "Route" },
      { key: "dutiesTaxRate", label: "Duties", format: "rate" },
      { key: "tariffRate", label: "Tariff", format: "rate" },
      { key: "rebateRate", label: "Rebate", format: "rate" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "calculator-breaks",
    label: "Calculator Breaks / Rates",
    description: "Quantity break setup, surcharge, margins, freight, DDP add-ons, and MO shipping values.",
    endpoint: "/api/quick-turn-quote-calculator/setup/calculator-breaks",
    idType: "number",
    fields: [
      { key: "calculatorId", label: "Calculator", kind: "calculatorSelect", required: true },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "label", label: "Break Label", kind: "text", required: true, placeholder: "1–72" },
      { key: "minQuantity", label: "Min Quantity", kind: "number", required: true, step: "1" },
      { key: "maxQuantity", label: "Max Quantity", kind: "number", step: "1", helper: "Leave blank for open-ended final range." },
      { key: "managementReviewRequired", label: "Management Review Required", kind: "checkbox" },
      { key: "marginRate", label: "Margin Rate", kind: "number", step: "0.000001", helper: "Use decimal form. Example: 0.28 for 28%." },
      { key: "surchargeMultiplier", label: "Surcharge Multiplier", kind: "number", step: "0.000001" },
      { key: "airFreightAmount", label: "Air Freight Amount", kind: "number", step: "0.000001" },
      { key: "ddpBaseAmount", label: "DDP Base Amount", kind: "number", step: "0.000001" },
      { key: "ddpMarkupRate", label: "DDP Markup Rate", kind: "number", step: "0.000001", helper: "Use decimal form." },
      { key: "moShippingAmount", label: "MO Shipping Amount", kind: "number", step: "0.000001" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "calculatorId", label: "Calculator", format: "calculator" },
      { key: "label", label: "Break" },
      { key: "surchargeMultiplier", label: "Surcharge" },
      { key: "marginRate", label: "Margin", format: "rate" },
      { key: "airFreightAmount", label: "Air" },
      { key: "ddpBaseAmount", label: "DDP" },
      { key: "moShippingAmount", label: "MO Ship" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    key: "fee-types",
    label: "Fee Types",
    description: "One-time fee types such as mold fees. These do not affect calculated unit price.",
    endpoint: "/api/quick-turn-quote-calculator/setup/fee-types",
    idType: "number",
    fields: [
      { key: "code", label: "Code", kind: "text", required: true, placeholder: "MOLD_FEE" },
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Mold Fee" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "sortOrder", label: "Sort Order", kind: "number", step: "1" },
      { key: "isActive", label: "Active", kind: "checkbox" },
    ],
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "isActive", label: "Active", format: "bool" },
    ],
  },
];

const RESOURCE_BY_KEY = new Map(RESOURCE_DEFS.map((def) => [def.key, def]));


type InputRequirementKey =
  | "requiresStitchCount"
  | "requiresEmbroideryType"
  | "requiresColorCount"
  | "requiresPanelCount"
  | "requiresRowCount";

type InputConfigShape = Partial<Record<InputRequirementKey, boolean>> & {
  embroideryTypes?: string[];
};

const INPUT_REQUIREMENT_OPTIONS: Array<{ key: InputRequirementKey; label: string; helper: string }> = [
  { key: "requiresStitchCount", label: "Stitch Count", helper: "Shows a stitch count field on the calculator." },
  { key: "requiresEmbroideryType", label: "Embroidery Type", helper: "Shows Flat Embroidery / 3-D Embroidery selection." },
  { key: "requiresColorCount", label: "Color Count", helper: "Shows a color count field." },
  { key: "requiresPanelCount", label: "Panel Count", helper: "Shows a panel count field." },
  { key: "requiresRowCount", label: "Row Count", helper: "Shows a row count field." },
];

const PRICING_METHOD_RECOMMENDED_INPUTS: Record<string, InputConfigShape> = {
  FLAT_PER_UNIT: {},
  PER_1000_STITCHES: { requiresStitchCount: true },
  BASE_PLUS_EMBROIDERY_STITCHES: {
    requiresStitchCount: true,
    requiresEmbroideryType: true,
    embroideryTypes: ["FLAT_EMBROIDERY", "3_D_EMBROIDERY"],
  },
  EMBROIDERY_WITH_MERROWED_AND_STITCHES: {
    requiresStitchCount: true,
    requiresEmbroideryType: true,
    embroideryTypes: ["FLAT_EMBROIDERY", "3_D_EMBROIDERY"],
  },
  PER_COLOR: { requiresColorCount: true },
  PRINTED_APPLIQUE: { requiresColorCount: true },
  PER_PANEL_PER_COLOR: { requiresPanelCount: true, requiresColorCount: true },
  PER_PANEL: { requiresPanelCount: true },
  PER_ROW: { requiresRowCount: true },
  FLAT_WITH_MERROWED: {},
};

function parseInputConfig(raw: unknown): InputConfigShape {
  if (!raw) return {};
  if (typeof raw === "object") return raw as InputConfigShape;

  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function stringifyInputConfig(config: InputConfigShape): string {
  const clean: InputConfigShape = {};
  for (const option of INPUT_REQUIREMENT_OPTIONS) {
    if (config[option.key]) clean[option.key] = true;
  }
  if (clean.requiresEmbroideryType) {
    clean.embroideryTypes = ["FLAT_EMBROIDERY", "3_D_EMBROIDERY"];
  }
  return JSON.stringify(clean, null, 2);
}

function hasNoInputRequirements(config: InputConfigShape): boolean {
  return !INPUT_REQUIREMENT_OPTIONS.some((option) => Boolean(config[option.key]));
}

function recommendedInputConfigFor(pricingMethod: string): InputConfigShape {
  return PRICING_METHOD_RECOMMENDED_INPUTS[pricingMethod] || {};
}

function inputConfigDisplayParts(value: unknown): string[] {
  const config = parseInputConfig(value);
  const parts: string[] = [];

  if (config.requiresStitchCount) parts.push("Stitch Count");
  if (config.requiresEmbroideryType) parts.push("Embroidery Type");
  if (config.requiresColorCount) parts.push("Color Count");
  if (config.requiresPanelCount) parts.push("Panel Count");
  if (config.requiresRowCount) parts.push("Row Count");

  return parts;
}

function emptyForm(def: ResourceDef, rows: SetupRows): Record<string, any> {
  const form: Record<string, any> = {};

  for (const field of def.fields) {
    if (field.kind === "checkbox") {
      form[field.key] = true;
    } else if (field.kind === "json" || field.kind === "inputRequirements") {
      form[field.key] = "{}";
    } else if (field.kind === "programSelect") {
      form[field.key] = rows.programs[0]?.id ? String(rows.programs[0].id) : "";
    } else if (field.kind === "factorySelect") {
      form[field.key] = rows.factories[0]?.id ? String(rows.factories[0].id) : "";
    } else if (field.kind === "calculatorSelect") {
      form[field.key] = rows.calculators[0]?.id ? String(rows.calculators[0].id) : "";
    } else if (field.kind === "categorySelect") {
      form[field.key] = "DECORATION";
    } else if (field.kind === "routeTypeSelect") {
      form[field.key] = "STANDARD";
    } else if (field.kind === "pricingMethodSelect") {
      form[field.key] = "FLAT_PER_UNIT";
    } else if (field.key === "sortOrder") {
      form[field.key] = "0";
    } else if (field.key === "surchargeMultiplier") {
      form[field.key] = "1";
    } else {
      form[field.key] = "";
    }
  }

  return form;
}

function formFromRow(def: ResourceDef, row: Record<string, any>): Record<string, any> {
  const form: Record<string, any> = {};

  for (const field of def.fields) {
    const value = row[field.key];
    if (field.kind === "checkbox") {
      form[field.key] = Boolean(value);
    } else if (field.kind === "json" || field.kind === "inputRequirements") {
      form[field.key] = JSON.stringify(value ?? {}, null, 2);
    } else {
      form[field.key] = value === null || value === undefined ? "" : String(value);
    }
  }

  return form;
}

function normalizeForSave(def: ResourceDef, form: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {};

  for (const field of def.fields) {
    const value = form[field.key];
    if (field.kind === "checkbox") {
      payload[field.key] = Boolean(value);
    } else if (field.kind === "json" || field.kind === "inputRequirements") {
      payload[field.key] = value || "{}";
    } else if (field.kind === "number") {
      payload[field.key] = value === "" || value === null || value === undefined ? null : Number(value);
    } else if (["programSelect", "factorySelect", "calculatorSelect"].includes(field.kind)) {
      payload[field.key] = value === "" || value === null || value === undefined ? null : Number(value);
    } else {
      payload[field.key] = value === "" ? null : value;
    }
  }

  return payload;
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatRate(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function displayValue(
  row: Record<string, any>,
  column: ResourceDef["columns"][number],
  rows: SetupRows
) {
  const value = row[column.key];

  if (column.format === "bool") return value ? "Active" : "Inactive";
  if (column.format === "money") return formatMoney(value);
  if (column.format === "rate") return formatRate(value);
  if (column.format === "program") return rows.programs.find((x) => String(x.id) === String(value))?.name || value || "—";
  if (column.format === "factory") return rows.factories.find((x) => String(x.id) === String(value))?.name || value || "—";
  if (column.format === "calculator") return rows.calculators.find((x) => String(x.id) === String(value))?.name || value || "—";
  if (column.format === "json") {
    const parts = inputConfigDisplayParts(value);
    if (!parts.length) return "—";
    return (
      <div className="qt-setup-chip-list">
        {parts.map((part) => (
          <span key={part} className="record-pill record-pill-neutral qt-setup-chip">
            {part}
          </span>
        ))}
      </div>
    );
  }

  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function rowMatches(row: Record<string, any>, q: string) {
  const token = q.trim().toLowerCase();
  if (!token) return true;
  return JSON.stringify(row).toLowerCase().includes(token);
}

export default function QuickTurnQuoteSetupClient() {
  const [activeKey, setActiveKey] = useState<ResourceKey>("base-items");
  const [rows, setRows] = useState<SetupRows>(EMPTY_ROWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");

  const activeDef = RESOURCE_BY_KEY.get(activeKey)!;

  const filteredRows = useMemo(() => {
    return (rows[activeKey] || []).filter((row) => rowMatches(row, q));
  }, [activeKey, q, rows]);

  async function loadResource(def: ResourceDef) {
    const res = await fetch(`${def.endpoint}?includeInactive=true`, {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to load ${def.label}.`);
    return data.rows || [];
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const entries = await Promise.all(
        RESOURCE_DEFS.map(async (def) => [def.key, await loadResource(def)] as const)
      );
      const nextRows = { ...EMPTY_ROWS } as SetupRows;
      for (const [key, value] of entries) nextRows[key] = value;
      setRows(nextRows);
      setForm(emptyForm(activeDef, nextRows));
    } catch (err: any) {
      setError(err?.message || "Failed to load Quick Turn setup data.");
    } finally {
      setLoading(false);
    }
  }

  async function reloadActive() {
    const next = await loadResource(activeDef);
    setRows((prev) => ({ ...prev, [activeKey]: next }));
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEditing(null);
    setForm(emptyForm(activeDef, rows));
    setQ("");
    setMessage(null);
    setError(null);
  }, [activeKey]);

  function updateField(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePricingMethod(value: string) {
    setForm((prev) => {
      const currentConfig = parseInputConfig(prev.inputConfig);
      const next: Record<string, any> = { ...prev, pricingMethod: value };

      // For a new/blank accessory setup, pre-fill the most common required inputs
      // for the selected pricing method so users do not need to know JSON.
      if (hasNoInputRequirements(currentConfig)) {
        next.inputConfig = stringifyInputConfig(recommendedInputConfigFor(value));
      }

      return next;
    });
  }

  function updateInputRequirement(key: InputRequirementKey, checked: boolean) {
    setForm((prev) => {
      const current = parseInputConfig(prev.inputConfig);
      const next = { ...current, [key]: checked };
      if (!checked && key === "requiresEmbroideryType") {
        delete next.embroideryTypes;
      }
      return { ...prev, inputConfig: stringifyInputConfig(next) };
    });
  }

  function applyRecommendedInputRequirements() {
    const recommended = recommendedInputConfigFor(String(form.pricingMethod || ""));
    updateField("inputConfig", stringifyInputConfig(recommended));
  }

  function startCreate() {
    setEditing(null);
    setForm(emptyForm(activeDef, rows));
    setMessage(null);
    setError(null);
  }

  function startEdit(row: Record<string, any>) {
    setEditing(row);
    setForm(formFromRow(activeDef, row));
    setMessage(null);
    setError(null);
  }

  async function saveForm() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const payload = normalizeForSave(activeDef, form);
      const url = editing ? `${activeDef.endpoint}/${editing.id}` : activeDef.endpoint;
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Failed to save setup record.");

      await reloadActive();
      setEditing(null);
      setForm(emptyForm(activeDef, rows));
      setMessage(`${activeDef.label} record saved.`);
    } catch (err: any) {
      setError(err?.message || "Failed to save setup record.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: Record<string, any>) {
    const nextActive = !row.isActive;
    const label = nextActive ? "reactivate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${label} this ${activeDef.label} record?`)) return;

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const res = await fetch(`${activeDef.endpoint}/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Failed to update active status.");

      await reloadActive();
      setMessage(`${activeDef.label} record ${nextActive ? "reactivated" : "deactivated"}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to update active status.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: FieldDef) {
    const value = form[field.key];
    const commonLabel = (
      <span>
        {field.label} {field.required ? <strong>*</strong> : null}
      </span>
    );

    if (field.kind === "textarea" || field.kind === "json") {
      return (
        <label key={field.key}>
          {commonLabel}
          <textarea
            className="textarea"
            value={value || ""}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={field.kind === "json" ? 5 : 3}
          />
          {field.helper ? <small>{field.helper}</small> : null}
        </label>
      );
    }

    if (field.kind === "inputRequirements") {
      const config = parseInputConfig(value);
      const recommended = recommendedInputConfigFor(String(form.pricingMethod || ""));
      const recommendedParts = inputConfigDisplayParts(recommended);

      return (
        <div key={field.key} className="qt-input-requirements">
          <div>
            <span className="qt-setup-field-label">{commonLabel}</span>
            {field.helper ? <small>{field.helper}</small> : null}
          </div>

          <div className="qt-input-checkbox-grid">
            {INPUT_REQUIREMENT_OPTIONS.map((option) => (
              <label key={option.key} className="qt-input-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(config[option.key])}
                  onChange={(e) => updateInputRequirement(option.key, e.target.checked)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.helper}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="qt-input-recommendation-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={applyRecommendedInputRequirements}>
              Apply Recommended Inputs
            </button>
            <small>
              Recommended for this pricing method: {recommendedParts.length ? recommendedParts.join(", ") : "No extra inputs"}.
            </small>
          </div>
        </div>
      );
    }

    if (field.kind === "checkbox") {
      return (
        <label key={field.key}>
          <span>{field.label}</span>
          <select
            className="select"
            value={value ? "true" : "false"}
            onChange={(e) => updateField(field.key, e.target.value === "true")}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      );
    }

    if (field.kind === "programSelect") {
      return (
        <label key={field.key}>
          {commonLabel}
          <select className="select" value={value || ""} onChange={(e) => updateField(field.key, e.target.value)}>
            <option value="">Select program…</option>
            {rows.programs.map((program) => (
              <option key={program.id} value={String(program.id)}>
                {program.name} ({program.code})
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.kind === "factorySelect") {
      return (
        <label key={field.key}>
          {commonLabel}
          <select className="select" value={value || ""} onChange={(e) => updateField(field.key, e.target.value)}>
            <option value="">Select factory…</option>
            {rows.factories.map((factory) => (
              <option key={factory.id} value={String(factory.id)}>
                {factory.name} ({factory.code})
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.kind === "calculatorSelect") {
      return (
        <label key={field.key}>
          {commonLabel}
          <select className="select" value={value || ""} onChange={(e) => updateField(field.key, e.target.value)}>
            <option value="">Select calculator…</option>
            {rows.calculators.map((calculator) => (
              <option key={calculator.id} value={String(calculator.id)}>
                {calculator.name} ({calculator.code})
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.kind === "categorySelect") {
      return (
        <label key={field.key}>
          {commonLabel}
          <select className="select" value={value || ""} onChange={(e) => updateField(field.key, e.target.value)}>
            <option value="DECORATION">Decoration</option>
            <option value="CLOSURE">Closure</option>
          </select>
        </label>
      );
    }

    if (field.kind === "routeTypeSelect") {
      return (
        <label key={field.key}>
          {commonLabel}
          <select className="select" value={value || ""} onChange={(e) => updateField(field.key, e.target.value)}>
            <option value="STANDARD">Standard QT</option>
            <option value="DDP_MO_AIR">DDP MO Air QT</option>
            <option value="DDP_DIRECT_AIR">DDP Direct Air QT</option>
          </select>
        </label>
      );
    }

    if (field.kind === "pricingMethodSelect") {
      return (
        <label key={field.key}>
          {commonLabel}
          <select className="select" value={value || ""} onChange={(e) => updatePricingMethod(e.target.value)}>
            <option value="FLAT_PER_UNIT">Flat Per Unit</option>
            <option value="PER_1000_STITCHES">Per 1,000 Stitches</option>
            <option value="BASE_PLUS_EMBROIDERY_STITCHES">Base + Embroidery Stitches</option>
            <option value="EMBROIDERY_WITH_MERROWED_AND_STITCHES">Embroidery + Merrowed + Stitches</option>
            <option value="PER_COLOR">Per Color</option>
            <option value="PRINTED_APPLIQUE">Printed Applique</option>
            <option value="PER_PANEL_PER_COLOR">Per Panel / Per Color</option>
            <option value="PER_PANEL">Per Panel</option>
            <option value="PER_ROW">Per Row</option>
            <option value="FLAT_WITH_MERROWED">Flat + Merrowed Edge</option>
          </select>
        </label>
      );
    }

    return (
      <label key={field.key}>
        {commonLabel}
        <input
          className="input"
          type={field.kind === "number" ? "number" : "text"}
          step={field.step || (field.kind === "number" ? "any" : undefined)}
          value={value || ""}
          onChange={(e) => updateField(field.key, e.target.value)}
          placeholder={field.placeholder}
        />
        {field.helper ? <small>{field.helper}</small> : null}
      </label>
    );
  }

  if (loading) {
    return (
      <main className="page-shell-wide">
        <div className="card">Loading Quick Turn setup…</div>
      </main>
    );
  }

  return (
    <main className="page-shell-wide">
      <div className="page-header">
        <div className="page-header-title-wrap">
          <h1 className="page-title">Quick Turn Setup</h1>
          <p className="page-subtitle">
            Maintain Quick Turn programs, factories, pricing, calculator rates, and one-time fee types.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/quick-turn-quote-calculator" className="btn btn-secondary">
            Calculator
          </Link>
          <Link href="/quick-turn-quote-calculator/saved" className="btn btn-secondary">
            Saved Quotes
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <section className="section-card">
        <div className="record-section-header">
          <h2 className="record-section-title">Setup Area</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RESOURCE_DEFS.map((def) => (
            <button
              key={def.key}
              type="button"
              className={activeKey === def.key ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={() => setActiveKey(def.key)}
            >
              {def.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">{activeDef.label}</h2>
            <p className="page-subtitle">{activeDef.description}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={startCreate} disabled={saving}>
            New {activeDef.label}
          </button>
        </div>

        <div className="record-meta-grid">
          {activeDef.fields.map(renderField)}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={saveForm} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Record"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={startCreate} disabled={saving}>
            Clear
          </button>
          {editing ? <span className="record-pill record-pill-info">Editing ID: {editing.id}</span> : null}
        </div>
      </section>

      <section className="section-card">
        <div className="record-section-header">
          <div>
            <h2 className="record-section-title">Current Records</h2>
            <p className="page-subtitle">Inactive records remain available for saved quote history, but are hidden from new quote selection.</p>
          </div>
          <label>
            <span>Search this setup area</span>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records…" />
          </label>
        </div>

        <div className="qt-setup-table-wrap">
          <table className="data-table qt-setup-table">
            <thead>
              <tr>
                {activeDef.columns.map((column) => (
                  <th key={column.key} className={`qt-setup-col-${column.key}`}>{column.label}</th>
                ))}
                <th className="qt-setup-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={activeDef.columns.length + 1}>No records found.</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={String(row.id)}>
                    {activeDef.columns.map((column) => (
                      <td key={column.key} className={`qt-setup-col-${column.key}`}>{displayValue(row, column, rows)}</td>
                    ))}
                    <td className="qt-setup-actions-col">
                      <div className="qt-setup-row-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={row.isActive ? "btn btn-danger btn-sm" : "btn btn-secondary btn-sm"}
                          onClick={() => toggleActive(row)}
                        >
                          {row.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx global>{`
        .qt-setup-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .qt-setup-table {
          min-width: 1120px;
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: auto;
        }

        .qt-setup-table th,
        .qt-setup-table td {
          padding: 10px 12px;
          line-height: 1.35;
          vertical-align: top;
          white-space: normal;
        }

        .qt-setup-table th {
          white-space: nowrap;
        }

        .qt-setup-col-description,
        .qt-setup-col-fabricDescription,
        .qt-setup-col-leadTimeNote,
        .qt-setup-col-notes {
          min-width: 260px;
          max-width: 520px;
        }

        .qt-setup-col-name,
        .qt-setup-col-displayLabel {
          min-width: 180px;
        }

        .qt-setup-col-inputConfig {
          min-width: 260px;
        }

        .qt-setup-col-code,
        .qt-setup-col-itemCode,
        .qt-setup-col-category,
        .qt-setup-col-pricingMethod,
        .qt-setup-col-routeType,
        .qt-setup-col-label,
        .qt-setup-col-isActive {
          white-space: nowrap;
        }

        .qt-setup-actions-col {
          min-width: 150px;
          white-space: nowrap;
        }

        .qt-setup-row-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .qt-setup-chip-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }

        .qt-setup-chip {
          font-size: 12px;
          white-space: nowrap;
        }

        .qt-input-requirements {
          display: grid;
          gap: 10px;
          border: 1px solid var(--border-color, #d7cec2);
          border-radius: 12px;
          padding: 12px;
        }

        .qt-setup-field-label {
          display: block;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .qt-input-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px 12px;
        }

        .qt-input-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          border: 1px solid var(--border-color, #d7cec2);
          border-radius: 10px;
          padding: 8px 10px;
        }

        .qt-input-checkbox input {
          margin-top: 3px;
        }

        .qt-input-checkbox span {
          display: grid;
          gap: 2px;
        }

        .qt-input-checkbox small,
        .qt-input-recommendation-row small {
          font-weight: 400;
          opacity: 0.8;
        }

        .qt-input-recommendation-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
      `}</style>
    </main>
  );
}
