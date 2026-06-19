// lib/services/quickTurnQuoteCalculatorService.ts

import {
  QUICK_TURN_DEFAULT_FACTORY_CODE,
  QUICK_TURN_DEFAULT_PROGRAM_CODE,
  QUICK_TURN_FINAL_BREAK_NOTE,
  QUICK_TURN_QUOTE_DISCLAIMER,
  QUICK_TURN_EMBROIDERY_TYPE_ACCESSORY_CODES,
} from "@/lib/quickTurnQuoteCalculator/constants";
import {
  getActiveAccessoriesByIds,
  getActiveBaseItemById,
  getActiveCamoOptionById,
  getActiveFactoryByIdOrCode,
  getActiveFeeTypesByIds,
  getActiveProgramByIdOrCode,
  listQuickTurnCalculatorsWithBreaks,
  listQuickTurnLookups,
  saveQuickTurnQuote,
  updateDraftQuickTurnQuote,
  type QuickTurnAccessory,
  type QuickTurnAuditInput,
  type QuickTurnBaseItem,
  type QuickTurnCalculator,
  type QuickTurnCalculatorBreak,
  type QuickTurnCamoOption,
  type QuickTurnFeeType,
  type QuickTurnPersistedQuoteItem,
} from "@/lib/repositories/quickTurnQuoteCalculatorRepo";
import { getActiveQuickTurnOverseasCustomerServiceUserById } from "@/lib/repositories/quickTurnQuoteCalculatorUserRepo";

export const QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID = "__CUSTOM_CAP__";

export type QuickTurnSelectedAccessoryInput = {
  accessoryId?: string | null;
  inputValues?: Record<string, unknown> | null;
  sortOrder?: number | null;
};

export type QuickTurnSelectedFeeInput = {
  feeTypeId?: number | string | null;
  amount?: number | string | null;
  notes?: string | null;
  sortOrder?: number | null;
};

export type QuickTurnCalculateItemInput = {
  clientItemId?: string | null;
  baseItemId?: string | null;
  isCustomCap?: boolean | null;
  customCapCost?: number | string | null;
  customCapDescription?: string | null;
  baseItemDescription?: string | null;
  baseItemDescriptionOverride?: string | null;
  accessories?: QuickTurnSelectedAccessoryInput[] | null;
  closure?: QuickTurnSelectedAccessoryInput | null;
  closureAccessoryId?: string | null;
  closureInputValues?: Record<string, unknown> | null;
  camoOptionId?: string | null;
  fees?: QuickTurnSelectedFeeInput[] | null;
  notes?: string | null;
  sortOrder?: number | null;
};

export type QuickTurnCalculateInput = {
  programId?: number | string | null;
  programCode?: string | null;
  factoryId?: number | string | null;
  factoryCode?: string | null;
  workflowSalesOrderNumber?: string | null;
  overseasCustomerServiceUserId?: string | null;
  overseasCustomerServiceNameSnapshot?: string | null;
  overseasCustomerServiceEmailSnapshot?: string | null;
  overseasCustomerServiceEmployeeNumberSnapshot?: number | string | null;
  rebatePercent?: number | string | null;
  quoteRebateRate?: number | string | null;
  preparedForCustomerId?: string | number | null;
  preparedForCustomerCodeSnapshot?: string | null;
  preparedForCustomerNameSnapshot?: string | null;
  quotePreparedForDisplay?: string | null;
  programLogoText?: string | null;
  fob?: string | null;
  items?: QuickTurnCalculateItemInput[] | null;
};

export type QuickTurnSaveInput = QuickTurnCalculateInput &
  QuickTurnAuditInput & {
    quoteName?: string | null;
    notes?: string | null;
  };

export type QuickTurnCalculationResult = {
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
  finalBreakNote: string;
  input: QuickTurnCalculateInput;
  items: QuickTurnPersistedQuoteItem[];
};

type ResolvedSelectedAccessory = {
  input: Required<Pick<QuickTurnSelectedAccessoryInput, "accessoryId">> & QuickTurnSelectedAccessoryInput;
  accessory: QuickTurnAccessory;
  inputValues: Record<string, unknown>;
  calculatedUnitPrice: number;
  sortOrder: number;
};

type ResolvedFee = {
  feeType: QuickTurnFeeType | null;
  feeCode: string;
  feeName: string;
  amount: number;
  notes: string | null;
  sortOrder: number;
};

type ResolvedBaseItem = {
  id: string | null;
  code: string;
  itemCode: string;
  fabricDescription: string | null;
  basePrice: number;
  isCustomCap: boolean;
  customCapDescription: string | null;
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

function cleanNonNegativeNumber(value: unknown, label: string): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return n;
}

function cleanOptionalQuoteRebateRate(input: QuickTurnCalculateInput): number {
  const rawRate = input.quoteRebateRate;
  if (rawRate !== null && rawRate !== undefined && rawRate !== "") {
    const rate = cleanNonNegativeNumber(rawRate, "Rebate rate");
    if (rate >= 1) throw new Error("Rebate rate must be less than 100%.");
    return rate;
  }

  const rawPercent = input.rebatePercent;
  if (rawPercent === null || rawPercent === undefined || rawPercent === "") return 0;
  const percent = cleanNonNegativeNumber(rawPercent, "Rebate percentage");
  if (percent >= 100) throw new Error("Rebate percentage must be less than 100%.");
  return percent / 100;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

function cleanPositiveInt(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return n;
}

function sortOrder(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function thousandStitchBlocks(stitchCount: number): number {
  return Math.floor(stitchCount / 1000);
}

function addDaysAsDateString(date: Date, days: number): string {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function buildAccessorySelections(item: QuickTurnCalculateItemInput): QuickTurnSelectedAccessoryInput[] {
  const selections = [...(item.accessories ?? [])].filter(Boolean);

  if (item.closure?.accessoryId) {
    selections.push({
      accessoryId: item.closure.accessoryId,
      inputValues: item.closure.inputValues ?? {},
      sortOrder: item.closure.sortOrder ?? 9000,
    });
  } else if (item.closureAccessoryId) {
    selections.push({
      accessoryId: item.closureAccessoryId,
      inputValues: item.closureInputValues ?? {},
      sortOrder: 9000,
    });
  }

  return selections;
}

function requireNumberInput(
  inputValues: Record<string, unknown>,
  keys: string[],
  label: string
): number {
  for (const key of keys) {
    const raw = inputValues[key];
    if (raw !== null && raw !== undefined && raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`${label} must be a non-negative number.`);
      }
      return n;
    }
  }

  throw new Error(`${label} is required for the selected accessory.`);
}

function optionalNumberInput(inputValues: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const raw = inputValues[key];
    if (raw !== null && raw !== undefined && raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return fallback;
      return n;
    }
  }
  return fallback;
}

function normalizeEmbroideryType(value: unknown): string {
  const token = String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (["3D EMBROIDERY", "3 D EMBROIDERY", "THREE D EMBROIDERY"].includes(token)) {
    return QUICK_TURN_EMBROIDERY_TYPE_ACCESSORY_CODES.THREE_D_EMBROIDERY;
  }

  if (["FLAT EMBROIDERY", "FLAT"].includes(token)) {
    return QUICK_TURN_EMBROIDERY_TYPE_ACCESSORY_CODES.FLAT_EMBROIDERY;
  }

  return String(value ?? "").trim();
}

function accessoryByCode(accessories: QuickTurnAccessory[], code: string): QuickTurnAccessory | null {
  return accessories.find((x) => x.code === code) ?? null;
}

function merrowedEdgeCodeFor(accessoryCode: string): string | null {
  if (accessoryCode.includes("LESS_THAN_5CM")) return "MERROWED_EDGE_LESS_THAN_5CM";
  if (accessoryCode.includes("5_10CM")) return "MERROWED_EDGE_5_10CM";
  return null;
}

function embroideryStitchCost(
  allAccessories: QuickTurnAccessory[],
  inputValues: Record<string, unknown>,
  selectedAccessoryName: string
): number {
  const stitchCount = requireNumberInput(inputValues, ["stitchCount", "stitches"], "Stitch count");
  const embroideryTypeRaw = inputValues.embroideryType ?? inputValues.embroideryAccessoryCode;
  const embroideryType = normalizeEmbroideryType(embroideryTypeRaw);

  if (!embroideryType) {
    throw new Error(`${selectedAccessoryName} requires Flat Embroidery or 3-D Embroidery.`);
  }

  const embroideryAccessory = accessoryByCode(allAccessories, embroideryType);
  if (!embroideryAccessory) {
    throw new Error(`Could not find embroidery pricing for ${embroideryType}.`);
  }

  return embroideryAccessory.unitPrice * thousandStitchBlocks(stitchCount);
}

function allowsNegativeAccessory(accessory: QuickTurnAccessory): boolean {
  return accessory.category === "DECORATION" && accessory.pricingMethod === "FLAT_PER_UNIT";
}

function validateSelectedAccessoryUnitPrice(accessory: QuickTurnAccessory) {
  if (accessory.unitPrice < 0 && !allowsNegativeAccessory(accessory)) {
    throw new Error(
      `${accessory.name} has negative pricing but is not a flat per-unit decoration adjustment.`
    );
  }
}

function calculateAccessoryUnitPrice(
  accessory: QuickTurnAccessory,
  inputValues: Record<string, unknown>,
  allAccessories: QuickTurnAccessory[]
): number {
  validateSelectedAccessoryUnitPrice(accessory);
  const unit = accessory.unitPrice;

  switch (accessory.pricingMethod) {
    case "FLAT_PER_UNIT":
      return unit;

    case "PER_1000_STITCHES": {
      const stitchCount = requireNumberInput(inputValues, ["stitchCount", "stitches"], "Stitch count");
      return unit * thousandStitchBlocks(stitchCount);
    }

    case "BASE_PLUS_EMBROIDERY_STITCHES":
      return unit + embroideryStitchCost(allAccessories, inputValues, accessory.name);

    case "PER_COLOR": {
      const colorCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["colorCount", "colors"], "Color count"),
        "Color count"
      );
      return unit * colorCount;
    }

    case "PRINTED_APPLIQUE": {
      const colorCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["colorCount", "colors"], "Color count"),
        "Color count"
      );
      const applyApplique = accessoryByCode(allAccessories, "TO_APPLY_APPLIQUE");
      return unit * colorCount + (applyApplique?.unitPrice ?? 0);
    }

    case "PER_PANEL_PER_COLOR": {
      const panelCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["panelCount", "panels"], "Panel count"),
        "Panel count"
      );
      const colorCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["colorCount", "colors"], "Color count"),
        "Color count"
      );
      return unit * panelCount * colorCount;
    }

    case "PER_PANEL": {
      const panelCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["panelCount", "panels"], "Panel count"),
        "Panel count"
      );
      return unit * panelCount;
    }

    case "PER_ROW": {
      const rowCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["rowCount", "rows", "pipingRows"], "Row count"),
        "Row count"
      );
      return unit * rowCount;
    }

    case "FLAT_WITH_MERROWED": {
      const merrowed = merrowedEdgeCodeFor(accessory.code);
      const merrowedAccessory = merrowed ? accessoryByCode(allAccessories, merrowed) : null;
      return unit + (merrowedAccessory?.unitPrice ?? 0);
    }

    case "EMBROIDERY_WITH_MERROWED_AND_STITCHES": {
      const merrowed = merrowedEdgeCodeFor(accessory.code);
      const merrowedAccessory = merrowed ? accessoryByCode(allAccessories, merrowed) : null;
      return (
        unit +
        (merrowedAccessory?.unitPrice ?? 0) +
        embroideryStitchCost(allAccessories, inputValues, accessory.name)
      );
    }

    case "PRINTED_PATCH_WITH_MERROWED": {
      const colorCount = cleanPositiveInt(
        requireNumberInput(inputValues, ["colorCount", "colors"], "Color count"),
        "Color count"
      );
      const applyApplique = accessoryByCode(allAccessories, "TO_APPLY_APPLIQUE");
      const merrowed = merrowedEdgeCodeFor(accessory.code);
      const merrowedAccessory = merrowed ? accessoryByCode(allAccessories, merrowed) : null;
      return unit * colorCount + (applyApplique?.unitPrice ?? 0) + (merrowedAccessory?.unitPrice ?? 0);
    }

    default:
      throw new Error(`Unsupported accessory pricing method: ${accessory.pricingMethod}.`);
  }
}

async function resolveAccessoriesForItem(
  item: QuickTurnCalculateItemInput,
  itemIndex: number,
  programId: number,
  factoryId: number
): Promise<ResolvedSelectedAccessory[]> {
  const selections = buildAccessorySelections(item);
  const ids = selections.map((x) => cleanRequiredText(x.accessoryId, "Accessory"));
  const uniqueIds = Array.from(new Set(ids));

  const activeAccessories = await getActiveAccessoriesByIds(uniqueIds);
  const activeById = new Map(activeAccessories.map((x) => [x.id, x]));

  if (activeAccessories.length !== uniqueIds.length) {
    throw new Error(`Quote item ${itemIndex + 1} has an invalid or inactive accessory/closure.`);
  }

  const lookupPayload = await listQuickTurnLookups({
    programId,
    factoryId,
  });
  const setupAccessories = lookupPayload.accessories;

  return selections.map((selection, selectionIndex) => {
    const accessoryId = cleanRequiredText(selection.accessoryId, "Accessory");
    const accessory = activeById.get(accessoryId);
    if (!accessory) throw new Error(`Quote item ${itemIndex + 1} has an invalid accessory.`);

    if (accessory.programId !== programId || accessory.factoryId !== factoryId) {
      throw new Error(`Accessory ${accessory.name} does not belong to the selected program/factory.`);
    }

    const isClosureByExplicitField =
      selection.accessoryId === item.closure?.accessoryId || selection.accessoryId === item.closureAccessoryId;

    if (isClosureByExplicitField && accessory.category !== "CLOSURE") {
      throw new Error(`${accessory.name} is not a closure option.`);
    }

    const inputValues = selection.inputValues ?? {};
    const calculatedUnitPrice = calculateAccessoryUnitPrice(accessory, inputValues, setupAccessories);

    return {
      input: { accessoryId, ...selection },
      accessory,
      inputValues,
      calculatedUnitPrice: roundCurrency(calculatedUnitPrice),
      sortOrder: sortOrder(selection.sortOrder, selectionIndex * 10 + 10),
    };
  });
}

async function resolveFeesForItem(item: QuickTurnCalculateItemInput): Promise<ResolvedFee[]> {
  const fees = item.fees ?? [];
  const feeTypeIds = Array.from(
    new Set(
      fees
        .map((fee) => (fee.feeTypeId === null || fee.feeTypeId === undefined ? null : Number(fee.feeTypeId)))
        .filter((x): x is number => x !== null && Number.isInteger(x) && x > 0)
    )
  );

  const feeTypes = await getActiveFeeTypesByIds(feeTypeIds);
  const feeTypeById = new Map(feeTypes.map((x) => [x.id, x]));

  return fees.map((fee, index) => {
    const amount = cleanNonNegativeNumber(fee.amount, "Fee amount");
    const feeTypeId = fee.feeTypeId === null || fee.feeTypeId === undefined ? null : Number(fee.feeTypeId);
    const feeType = feeTypeId ? feeTypeById.get(feeTypeId) ?? null : null;

    if (feeTypeId && !feeType) {
      throw new Error("Invalid or inactive fee type.");
    }

    return {
      feeType,
      feeCode: feeType?.code ?? "OTHER",
      feeName: feeType?.name ?? "Other",
      amount,
      notes: cleanText(fee.notes),
      sortOrder: sortOrder(fee.sortOrder, index * 10 + 10),
    };
  });
}

function calculateBreakUnitPrice(
  calculator: QuickTurnCalculator,
  quantityBreak: QuickTurnCalculatorBreak,
  decoratedUnitCost: number,
  camoUnitPrice: number,
  quoteRebateRate = 0
) {
  const effectiveMarginRate = quantityBreak.marginRate + quoteRebateRate;
  const surchargedDecoratedCost = decoratedUnitCost * quantityBreak.surchargeMultiplier;
  const formulaNotes = [
    "Camo is added after surcharge and does not affect the surcharged decorated item cost.",
    ...(quoteRebateRate > 0
      ? [`Quote rebate adds ${formatPercent(quoteRebateRate)} to the configured break margin (${formatPercent(quantityBreak.marginRate)} → ${formatPercent(effectiveMarginRate)}).`]
      : []),
  ];

  if (calculator.routeType === "STANDARD") {
    const dutiesTaxAmount = surchargedDecoratedCost * calculator.dutiesTaxRate;
    const tariffAmount = surchargedDecoratedCost * calculator.tariffRate;
    const preMarginCost = surchargedDecoratedCost + dutiesTaxAmount + tariffAmount + camoUnitPrice;
    const divisor = 1 - effectiveMarginRate - calculator.rebateRate;

    if (divisor <= 0) {
      throw new Error(`Invalid margin/rebate setup for ${calculator.name} ${quantityBreak.label}.`);
    }

    const priceBeforeFreight = preMarginCost / divisor;
    const unitPrice = priceBeforeFreight + (quantityBreak.airFreightAmount ?? 0);

    return {
      dutiesTaxAmount: roundCurrency(dutiesTaxAmount),
      tariffAmount: roundCurrency(tariffAmount),
      preMarginCost: roundCurrency(preMarginCost),
      unitPrice: roundCurrency(unitPrice),
      surchargedDecoratedCost: roundCurrency(surchargedDecoratedCost),
      formulaNotes: [
        ...formulaNotes,
        "Standard QT applies duties/taxes and tariff to the surcharged decorated item cost, adds camo, applies margin, then adds air freight.",
      ],
    };
  }

  const preMarginCost = surchargedDecoratedCost + camoUnitPrice;
  const divisor = 1 - effectiveMarginRate - calculator.rebateRate;

  if (divisor <= 0) {
    throw new Error(`Invalid margin/rebate setup for ${calculator.name} ${quantityBreak.label}.`);
  }

  const priceBeforeDdp = preMarginCost / divisor;
  const ddpAmount =
    quantityBreak.ddpBaseAmount == null
      ? 0
      : quantityBreak.ddpBaseAmount * (1 + (quantityBreak.ddpMarkupRate ?? 0));
  const moShippingAmount = calculator.routeType === "DDP_MO_AIR" ? quantityBreak.moShippingAmount ?? 0 : 0;
  const unitPrice = priceBeforeDdp + ddpAmount + moShippingAmount;

  return {
    dutiesTaxAmount: 0,
    tariffAmount: 0,
    preMarginCost: roundCurrency(preMarginCost),
    unitPrice: roundCurrency(unitPrice),
    surchargedDecoratedCost: roundCurrency(surchargedDecoratedCost),
    formulaNotes: [
      ...formulaNotes,
      calculator.routeType === "DDP_MO_AIR"
        ? "DDP MO Air applies margin, then adds DDP and MO-to-final-destination shipping."
        : "DDP Direct Air applies margin, then adds the direct DDP air amount.",
    ],
  };
}

async function resolveCamoOption(
  camoOptionId: string | null | undefined,
  factoryId: number
): Promise<QuickTurnCamoOption | null> {
  const id = cleanText(camoOptionId);
  if (!id) return null;

  const camo = await getActiveCamoOptionById(id);
  if (camo.factoryId !== factoryId) {
    throw new Error("Camo option does not belong to the selected factory.");
  }

  if (camo.unitPrice < 0) {
    throw new Error("Camo pricing must be non-negative.");
  }

  return camo;
}

function validateBaseItemFactory(baseItem: QuickTurnBaseItem, factoryId: number) {
  if (baseItem.factoryId !== factoryId) {
    throw new Error("Base item does not belong to the selected factory.");
  }
  if (baseItem.basePrice < 0) {
    throw new Error("Base item pricing must be non-negative.");
  }
}

function isCustomCapItem(item: QuickTurnCalculateItemInput): boolean {
  const baseItemId = cleanText(item.baseItemId);
  return item.isCustomCap === true || baseItemId === QUICK_TURN_CUSTOM_CAP_BASE_ITEM_ID || baseItemId === "CUSTOM_CAP";
}

async function resolveBaseItemForItem(
  item: QuickTurnCalculateItemInput,
  itemIndex: number,
  factoryId: number
): Promise<ResolvedBaseItem> {
  if (isCustomCapItem(item)) {
    const customCapCost = cleanNonNegativeNumber(item.customCapCost, `Quote item ${itemIndex + 1} Custom Cap Cost / Piece`);
    const customCapDescription = cleanRequiredText(
      item.customCapDescription,
      `Quote item ${itemIndex + 1} Custom Cap Description`
    );

    return {
      id: null,
      code: "CUSTOM_CAP",
      itemCode: "Custom Cap",
      fabricDescription: customCapDescription,
      basePrice: customCapCost,
      isCustomCap: true,
      customCapDescription,
    };
  }

  const baseItemId = cleanRequiredText(item.baseItemId, `Quote item ${itemIndex + 1} base item`);
  const baseItem = await getActiveBaseItemById(baseItemId);
  validateBaseItemFactory(baseItem, factoryId);

  const descriptionOverride = cleanText(item.baseItemDescription ?? item.baseItemDescriptionOverride);

  return {
    id: baseItem.id,
    code: baseItem.code,
    itemCode: baseItem.itemCode,
    fabricDescription: descriptionOverride ?? baseItem.fabricDescription,
    basePrice: baseItem.basePrice,
    isCustomCap: false,
    customCapDescription: null,
  };
}

export async function calculateQuickTurnQuote(
  input: QuickTurnCalculateInput
): Promise<QuickTurnCalculationResult> {
  const programToken = input.programId ?? input.programCode ?? QUICK_TURN_DEFAULT_PROGRAM_CODE;
  const factoryToken = input.factoryId ?? input.factoryCode ?? QUICK_TURN_DEFAULT_FACTORY_CODE;
  const program = await getActiveProgramByIdOrCode(programToken);
  const factory = await getActiveFactoryByIdOrCode(factoryToken);
  const workflowSalesOrderNumber = cleanText(input.workflowSalesOrderNumber);
  const overseasCustomerServiceUser = await getActiveQuickTurnOverseasCustomerServiceUserById(input.overseasCustomerServiceUserId);
  if (!overseasCustomerServiceUser) {
    throw new Error("OS Customer Service is required and must be an active Overseas CS user.");
  }
  const quoteRebateRate = cleanOptionalQuoteRebateRate(input);

  const rawItems = input.items ?? [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("At least one quote item is required.");
  }

  const calculators = await listQuickTurnCalculatorsWithBreaks({
    programId: program.id,
    factoryId: factory.id,
  });

  if (!calculators.length) {
    throw new Error("No active calculators are configured for the selected program/factory.");
  }

  const now = new Date();
  const generatedAt = now.toISOString();
  const validUntil = addDaysAsDateString(now, 30);

  const items: QuickTurnPersistedQuoteItem[] = [];

  for (let itemIndex = 0; itemIndex < rawItems.length; itemIndex += 1) {
    const item = rawItems[itemIndex];
    const baseItem = await resolveBaseItemForItem(item, itemIndex, factory.id);
    const accessories = await resolveAccessoriesForItem(item, itemIndex, program.id, factory.id);
    const camoOption = await resolveCamoOption(item.camoOptionId, factory.id);
    const fees = await resolveFeesForItem(item);

    const accessoryUnitTotal = accessories.reduce((sum, x) => sum + x.calculatedUnitPrice, 0);
    const baseUnitPrice = baseItem.basePrice;
    const decoratedUnitCost = baseUnitPrice + accessoryUnitTotal;
    const camoUnitPrice = camoOption?.unitPrice ?? 0;
    const oneTimeFeeTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);

    if (decoratedUnitCost < 0) {
      throw new Error(
        `Quote item ${itemIndex + 1} decorated unit cost cannot be below zero. Adjust the base item/custom cap cost or negative decoration/accessory adjustments.`
      );
    }

    const calculatorResults = calculators.map((calculator) => ({
      calculator: {
        id: calculator.id,
        code: calculator.code,
        name: calculator.name,
        displayLabel: calculator.displayLabel,
        routeType: calculator.routeType,
        dutiesTaxRate: calculator.dutiesTaxRate,
        tariffRate: calculator.tariffRate,
        rebateRate: calculator.rebateRate,
        leadTimeNote: calculator.leadTimeNote,
      },
      breaks: calculator.breaks.map((quantityBreak) => {
        const priced = calculateBreakUnitPrice(
          calculator,
          quantityBreak,
          decoratedUnitCost,
          camoUnitPrice,
          quoteRebateRate
        );

        return {
          quantityBreakId: quantityBreak.id,
          breakLabel: quantityBreak.label,
          minQuantity: quantityBreak.minQuantity,
          maxQuantity: quantityBreak.maxQuantity,
          managementReviewRequired: quantityBreak.managementReviewRequired,
          marginRate: quantityBreak.marginRate + quoteRebateRate,
          baseMarginRate: quantityBreak.marginRate,
          quoteRebateRate,
          surchargeMultiplier: quantityBreak.surchargeMultiplier,
          airFreightAmount: quantityBreak.airFreightAmount,
          ddpBaseAmount: quantityBreak.ddpBaseAmount,
          ddpMarkupRate: quantityBreak.ddpMarkupRate,
          moShippingAmount: quantityBreak.moShippingAmount,
          surchargedDecoratedCost: priced.surchargedDecoratedCost,
          camoUnitPrice: roundCurrency(camoUnitPrice),
          dutiesTaxAmount: priced.dutiesTaxAmount,
          tariffAmount: priced.tariffAmount,
          rebateRate: calculator.rebateRate,
          preMarginCost: priced.preMarginCost,
          unitPrice: priced.unitPrice,
          formulaNotes: quantityBreak.managementReviewRequired
            ? [...priced.formulaNotes, QUICK_TURN_FINAL_BREAK_NOTE]
            : priced.formulaNotes,
        };
      }),
    }));

    items.push({
      clientItemId: cleanText(item.clientItemId) ?? `item-${itemIndex + 1}`,
      sortOrder: sortOrder(item.sortOrder, itemIndex * 10 + 10),
      baseItem: {
        id: baseItem.id,
        code: baseItem.code,
        itemCode: baseItem.itemCode,
        fabricDescription: baseItem.fabricDescription,
        basePrice: roundCurrency(baseUnitPrice),
        isCustomCap: baseItem.isCustomCap,
        customCapDescription: baseItem.customCapDescription,
      },
      isCustomCap: baseItem.isCustomCap,
      customCapDescription: baseItem.customCapDescription,
      accessories: accessories.map((x) => ({
        id: x.accessory.id,
        code: x.accessory.code,
        category: x.accessory.category,
        name: x.accessory.name,
        pricingMethod: x.accessory.pricingMethod,
        unitPrice: roundCurrency(x.accessory.unitPrice),
        inputValues: x.inputValues,
        calculatedUnitPrice: x.calculatedUnitPrice,
        sortOrder: x.sortOrder,
      })),
      camoOption: camoOption
        ? {
            id: camoOption.id,
            code: camoOption.code,
            series: camoOption.series,
            supplier: camoOption.supplier,
            unitPrice: roundCurrency(camoOption.unitPrice),
          }
        : null,
      fees: fees.map((fee) => ({
        feeTypeId: fee.feeType?.id ?? null,
        feeCode: fee.feeCode,
        feeName: fee.feeName,
        amount: roundCurrency(fee.amount),
        notes: fee.notes,
        sortOrder: fee.sortOrder,
      })),
      baseUnitPrice: roundCurrency(baseUnitPrice),
      accessoryUnitTotal: roundCurrency(accessoryUnitTotal),
      decoratedUnitCost: roundCurrency(decoratedUnitCost),
      camoUnitPrice: roundCurrency(camoUnitPrice),
      oneTimeFeeTotal: roundCurrency(oneTimeFeeTotal),
      notes: cleanText(item.notes),
      calculatorResults,
    });
  }

  const normalizedInput: QuickTurnCalculateInput = {
    ...input,
    workflowSalesOrderNumber,
    overseasCustomerServiceUserId: overseasCustomerServiceUser.id,
    overseasCustomerServiceNameSnapshot: overseasCustomerServiceUser.displayName,
    overseasCustomerServiceEmailSnapshot: overseasCustomerServiceUser.email,
    overseasCustomerServiceEmployeeNumberSnapshot: overseasCustomerServiceUser.employeeNumber,
    rebatePercent: quoteRebateRate * 100,
    quoteRebateRate,
    preparedForCustomerId: input.preparedForCustomerId ?? null,
    preparedForCustomerCodeSnapshot: cleanText(input.preparedForCustomerCodeSnapshot),
    preparedForCustomerNameSnapshot: cleanText(input.preparedForCustomerNameSnapshot),
    quotePreparedForDisplay: cleanText(input.quotePreparedForDisplay),
    programLogoText: cleanText(input.programLogoText),
    fob: cleanText(input.fob) ?? "1 U.S. Final Destination",
    items: rawItems.map((item, index) => ({
      ...item,
      baseItemDescription: items[index]?.isCustomCap ? null : cleanText(items[index]?.baseItem?.fabricDescription),
    })),
  };

  return {
    program: {
      id: program.id,
      code: program.code,
      name: program.name,
    },
    factory: {
      id: factory.id,
      code: factory.code,
      name: factory.name,
    },
    generatedAt,
    validUntil,
    disclaimer: QUICK_TURN_QUOTE_DISCLAIMER,
    finalBreakNote: QUICK_TURN_FINAL_BREAK_NOTE,
    input: normalizedInput,
    items,
  };
}

export async function saveCalculatedQuickTurnQuote(
  input: QuickTurnSaveInput
): Promise<{ id: string; quoteNumber: string; quoteStatus: "DRAFT" | "PUBLISHED"; calculation: QuickTurnCalculationResult }> {
  const quoteName = cleanRequiredText(input.quoteName, "Quote name");
  const calculation = await calculateQuickTurnQuote(input);

  const saved = await saveQuickTurnQuote({
    quoteName,
    notes: input.notes,
    workflowSalesOrderNumber: calculation.input.workflowSalesOrderNumber,
    overseasCustomerServiceUserId: calculation.input.overseasCustomerServiceUserId,
    overseasCustomerServiceNameSnapshot: calculation.input.overseasCustomerServiceNameSnapshot,
    overseasCustomerServiceEmailSnapshot: calculation.input.overseasCustomerServiceEmailSnapshot,
    overseasCustomerServiceEmployeeNumberSnapshot: calculation.input.overseasCustomerServiceEmployeeNumberSnapshot,
    quoteRebateRate: calculation.input.quoteRebateRate,
    preparedForCustomerId: input.preparedForCustomerId,
    preparedForCustomerCodeSnapshot: input.preparedForCustomerCodeSnapshot,
    preparedForCustomerNameSnapshot: input.preparedForCustomerNameSnapshot,
    quotePreparedForDisplay: input.quotePreparedForDisplay,
    programLogoText: input.programLogoText,
    fob: input.fob,
    quoteStatus: "DRAFT",
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    calculation,
  });

  return {
    ...saved,
    calculation,
  };
}

export async function updateCalculatedQuickTurnDraft(
  id: string,
  input: QuickTurnSaveInput
): Promise<{ id: string; quoteNumber: string; quoteStatus: "DRAFT" | "PUBLISHED"; calculation: QuickTurnCalculationResult }> {
  const quoteName = cleanRequiredText(input.quoteName, "Quote name");
  const calculation = await calculateQuickTurnQuote(input);

  const saved = await updateDraftQuickTurnQuote(id, {
    quoteName,
    notes: input.notes,
    workflowSalesOrderNumber: calculation.input.workflowSalesOrderNumber,
    overseasCustomerServiceUserId: calculation.input.overseasCustomerServiceUserId,
    overseasCustomerServiceNameSnapshot: calculation.input.overseasCustomerServiceNameSnapshot,
    overseasCustomerServiceEmailSnapshot: calculation.input.overseasCustomerServiceEmailSnapshot,
    overseasCustomerServiceEmployeeNumberSnapshot: calculation.input.overseasCustomerServiceEmployeeNumberSnapshot,
    quoteRebateRate: calculation.input.quoteRebateRate,
    preparedForCustomerId: input.preparedForCustomerId,
    preparedForCustomerCodeSnapshot: input.preparedForCustomerCodeSnapshot,
    preparedForCustomerNameSnapshot: input.preparedForCustomerNameSnapshot,
    quotePreparedForDisplay: input.quotePreparedForDisplay,
    programLogoText: input.programLogoText,
    fob: input.fob,
    changedBy: input.changedBy,
    changedByUserId: input.changedByUserId,
    changedByEmployeeNumber: input.changedByEmployeeNumber,
    calculation,
  });

  return {
    ...saved,
    calculation,
  };
}

export const quickTurnQuoteCalculatorServiceInternals = {
  calculateAccessoryUnitPrice,
  calculateBreakUnitPrice,
  optionalNumberInput,
  thousandStitchBlocks,
};
