// app/quick-turn-quote-calculator/quickTurnQuotePreview.ts

import type { QuickTurnAccessory, QuickTurnBaseItem, QuickTurnCamoOption } from "./types";

export type QuickTurnAccessoryPreviewComponent = {
  label: string;
  amount: number | null;
  formula?: string | null;
};

export type QuickTurnAccessoryPricePreview = {
  isReady: boolean;
  total: number | null;
  missingInputs: string[];
  components: QuickTurnAccessoryPreviewComponent[];
};

export type QuickTurnItemPricePreview = {
  baseUnitPrice: number;
  accessoryUnitTotal: number;
  decoratedUnitCost: number;
  camoUnitPrice: number;
  missingInputs: string[];
};

type SelectedAccessoryLike = {
  accessoryId: string;
  inputValues: Record<string, unknown>;
};

function round6(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function thousandStitchBlocks(stitchCount: number): number {
  return Math.floor(stitchCount / 1000);
}

function thousandStitchFormula(stitches: number, unit: number): string {
  const blocks = thousandStitchBlocks(stitches);
  return `${stitches.toLocaleString()} stitches = ${blocks.toLocaleString()} thousand-stitch blocks × ${unit}`;
}

function numberInput(values: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = values[key];
    if (raw !== null && raw !== undefined && raw !== "") {
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
  }
  return null;
}

function positiveInt(values: Record<string, unknown>, keys: string[]): number | null {
  const n = numberInput(values, keys);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeEmbroideryCode(value: unknown): string {
  const token = String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (["3D EMBROIDERY", "3 D EMBROIDERY", "THREE D EMBROIDERY"].includes(token)) return "3_D_EMBROIDERY";
  if (["FLAT EMBROIDERY", "FLAT"].includes(token)) return "FLAT_EMBROIDERY";
  return String(value ?? "").trim();
}

function byCode(rows: QuickTurnAccessory[], code: string): QuickTurnAccessory | null {
  return rows.find((x) => x.code === code) ?? null;
}

function merrowedCodeFor(code: string): string | null {
  if (code.includes("LESS_THAN_5CM")) return "MERROWED_EDGE_LESS_THAN_5CM";
  if (code.includes("5_10CM")) return "MERROWED_EDGE_5_10CM";
  return null;
}

function row(label: string, amount: number | null, formula?: string): QuickTurnAccessoryPreviewComponent {
  return { label, amount: amount === null ? null : round6(amount), formula: formula || null };
}

function ready(components: QuickTurnAccessoryPreviewComponent[]): QuickTurnAccessoryPricePreview {
  return {
    isReady: true,
    total: round6(components.reduce((sum, x) => sum + (x.amount ?? 0), 0)),
    missingInputs: [],
    components,
  };
}

function missing(label: string, components: QuickTurnAccessoryPreviewComponent[] = []): QuickTurnAccessoryPricePreview {
  return { isReady: false, total: null, missingInputs: [label], components };
}

function embroideryPreview(allAccessories: QuickTurnAccessory[], inputValues: Record<string, unknown>): QuickTurnAccessoryPricePreview {
  const stitches = numberInput(inputValues, ["stitchCount", "stitches"]);
  if (stitches === null) return missing("Stitch count");

  const embroideryCode = normalizeEmbroideryCode(inputValues.embroideryType ?? inputValues.embroideryAccessoryCode);
  if (!embroideryCode) return missing("Embroidery type");

  const embroidery = byCode(allAccessories, embroideryCode);
  if (!embroidery) return missing("Embroidery pricing setup");

  return ready([
    row(
      `${embroidery.name} stitch cost`,
      embroidery.unitPrice * thousandStitchBlocks(stitches),
      thousandStitchFormula(stitches, embroidery.unitPrice)
    ),
  ]);
}

export function calculateAccessoryPricePreview(
  accessory: QuickTurnAccessory | undefined | null,
  inputValues: Record<string, unknown> = {},
  allAccessories: QuickTurnAccessory[] = []
): QuickTurnAccessoryPricePreview {
  if (!accessory) return { isReady: false, total: null, missingInputs: [], components: [] };

  const unit = Number(accessory.unitPrice || 0);

  switch (accessory.pricingMethod) {
    case "FLAT_PER_UNIT":
      return ready([row("Unit price", unit)]);

    case "PER_1000_STITCHES": {
      const stitches = numberInput(inputValues, ["stitchCount", "stitches"]);
      if (stitches === null) return missing("Stitch count", [row("Stitch rate", null, `${unit} per 1000 stitches`)]);
      return ready([row("Stitch cost", unit * thousandStitchBlocks(stitches), thousandStitchFormula(stitches, unit))]);
    }

    case "BASE_PLUS_EMBROIDERY_STITCHES": {
      const stitch = embroideryPreview(allAccessories, inputValues);
      const components = [row("Base decoration", unit), ...stitch.components];
      return stitch.isReady ? ready(components) : { ...stitch, components };
    }

    case "PER_COLOR": {
      const colors = positiveInt(inputValues, ["colorCount", "colors"]);
      if (colors === null) return missing("Color count", [row("Color rate", null, `${unit} per color`)]);
      return ready([row("Color charge", unit * colors, `${colors} colors × ${unit}`)]);
    }

    case "PRINTED_APPLIQUE": {
      const colors = positiveInt(inputValues, ["colorCount", "colors"]);
      if (colors === null) return missing("Color count", [row("Color rate", null, `${unit} per color`)]);
      const apply = byCode(allAccessories, "TO_APPLY_APPLIQUE");
      return ready([row("Printed applique colors", unit * colors, `${colors} colors × ${unit}`), row("To apply applique", apply?.unitPrice ?? 0)]);
    }

    case "PER_PANEL_PER_COLOR": {
      const panels = positiveInt(inputValues, ["panelCount", "panels"]);
      const colors = positiveInt(inputValues, ["colorCount", "colors"]);
      const missingValues = [panels === null ? "Panel count" : null, colors === null ? "Color count" : null].filter(Boolean) as string[];
      if (missingValues.length) return { isReady: false, total: null, missingInputs: missingValues, components: [row("Panel/color rate", null, `${unit} per panel/color`)] };
      return ready([row("Panel/color charge", unit * panels! * colors!, `${panels} panels × ${colors} colors × ${unit}`)]);
    }

    case "PER_PANEL": {
      const panels = positiveInt(inputValues, ["panelCount", "panels"]);
      if (panels === null) return missing("Panel count", [row("Panel rate", null, `${unit} per panel`)]);
      return ready([row("Panel charge", unit * panels, `${panels} panels × ${unit}`)]);
    }

    case "PER_ROW": {
      const rows = positiveInt(inputValues, ["rowCount", "rows", "pipingRows"]);
      if (rows === null) return missing("Row count", [row("Row rate", null, `${unit} per row`)]);
      return ready([row("Row charge", unit * rows, `${rows} rows × ${unit}`)]);
    }

    case "FLAT_WITH_MERROWED": {
      const merrowed = merrowedCodeFor(accessory.code);
      const edge = merrowed ? byCode(allAccessories, merrowed) : null;
      return ready([row("Base decoration", unit), row("Merrowed edge", edge?.unitPrice ?? 0)]);
    }

    case "EMBROIDERY_WITH_MERROWED_AND_STITCHES": {
      const merrowed = merrowedCodeFor(accessory.code);
      const edge = merrowed ? byCode(allAccessories, merrowed) : null;
      const stitch = embroideryPreview(allAccessories, inputValues);
      const components = [row("Base decoration", unit), row("Merrowed edge", edge?.unitPrice ?? 0), ...stitch.components];
      return stitch.isReady ? ready(components) : { ...stitch, components };
    }

    case "PRINTED_PATCH_WITH_MERROWED": {
      const colors = positiveInt(inputValues, ["colorCount", "colors"]);
      if (colors === null) return missing("Color count", [row("Color rate", null, `${unit} per color`)]);
      const apply = byCode(allAccessories, "TO_APPLY_APPLIQUE");
      const merrowed = merrowedCodeFor(accessory.code);
      const edge = merrowed ? byCode(allAccessories, merrowed) : null;
      return ready([
        row("Printed patch colors", unit * colors, `${colors} colors × ${unit}`),
        row("To apply applique", apply?.unitPrice ?? 0),
        row("Merrowed edge", edge?.unitPrice ?? 0),
      ]);
    }

    default:
      return ready([row("Configured unit price", unit)]);
  }
}

export function buildQuickTurnItemPricePreview({
  baseItem,
  customCapCost,
  accessoryRows,
  closureAccessory,
  closureInputValues,
  camoOption,
  accessoryById,
  allAccessories,
}: {
  baseItem?: QuickTurnBaseItem | null;
  customCapCost?: string | number | null;
  accessoryRows: SelectedAccessoryLike[];
  closureAccessory?: QuickTurnAccessory | null;
  closureInputValues: Record<string, unknown>;
  camoOption?: QuickTurnCamoOption | null;
  accessoryById: Map<string, QuickTurnAccessory>;
  allAccessories: QuickTurnAccessory[];
}): QuickTurnItemPricePreview {
  const missingInputs: string[] = [];
  const parsedCustomCapCost = customCapCost === null || customCapCost === undefined || customCapCost === "" ? null : Number(customCapCost);
  const baseUnitPrice = Number.isFinite(parsedCustomCapCost as number)
    ? Number(parsedCustomCapCost)
    : Number(baseItem?.basePrice ?? 0);
  let accessoryUnitTotal = 0;

  for (const selected of accessoryRows) {
    const accessory = accessoryById.get(selected.accessoryId);
    if (!accessory) continue;
    const preview = calculateAccessoryPricePreview(accessory, selected.inputValues, allAccessories);
    if (preview.isReady && preview.total !== null) accessoryUnitTotal += preview.total;
    else missingInputs.push(...preview.missingInputs.map((label) => `${accessory.name}: ${label}`));
  }

  if (closureAccessory) {
    const preview = calculateAccessoryPricePreview(closureAccessory, closureInputValues, allAccessories);
    if (preview.isReady && preview.total !== null) accessoryUnitTotal += preview.total;
    else missingInputs.push(...preview.missingInputs.map((label) => `${closureAccessory.name}: ${label}`));
  }

  accessoryUnitTotal = round6(accessoryUnitTotal);
  const decoratedUnitCost = round6(baseUnitPrice + accessoryUnitTotal);
  if (decoratedUnitCost < 0) missingInputs.push("Decorated item cost cannot be below zero");

  return {
    baseUnitPrice: round6(baseUnitPrice),
    accessoryUnitTotal,
    decoratedUnitCost,
    camoUnitPrice: round6(Number(camoOption?.unitPrice ?? 0)),
    missingInputs,
  };
}
