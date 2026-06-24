// lib/itemPricing/itemPricingCalculationService.ts

import {
  BASE_REFERENCE_LABELS,
  DECORATION_METHOD_LABELS,
  FLAT_EMB_ADDER,
  THREE_D_EMB_ADDER,
} from "@/lib/itemPricing/constants";
import type {
  BaseReference,
  CalculatedBreakPrice,
  CalculatedMethodPrices,
  DecorationMethodCode,
  ItemPricingCalculationInput,
  ItemPricingCalculationResult,
  ItemPricingRuleRow,
} from "@/lib/itemPricing/types";

const METHOD_TO_ALLOWED_KEY: Record<string, keyof ItemPricingCalculationInput["allowedMethods"]> = {
  BLANK: "blank",
  FLAT_EMB: "flatEmb",
  THREE_D_EMB: "threeDEmb",
  KNIT_IN: "knitIn",
};

const DISPLAY_BREAK_ORDER: Record<string, number> = {
  "1_23": 10,
  "15": 15,
  "24": 20,
  "48": 30,
  "96": 40,
  "144": 50,
  "576": 60,
  "2500": 70,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function methodLabel(code: string): string {
  return DECORATION_METHOD_LABELS[code] || code;
}

function baseReferenceLabel(code: string): string {
  return BASE_REFERENCE_LABELS[code] || code;
}

function resolveBaseAmount(
  row: ItemPricingRuleRow,
  blankEqpPrice: number,
  calculatedByMethodBreak: Map<string, number>
): { amount: number | null; formulaBaseLabel: string; priorQuantityBreakCode?: string | null; priorQuantityBreakLabel?: string | null } {
  const baseReference = String(row.baseReference || "").toUpperCase() as BaseReference;

  if (baseReference === "BLANK_EQP") {
    return { amount: blankEqpPrice, formulaBaseLabel: "Blank EQP" };
  }

  if (baseReference === "FLAT_EQP") {
    return { amount: money(blankEqpPrice + FLAT_EMB_ADDER), formulaBaseLabel: "Flat EQP" };
  }

  if (baseReference === "THREE_D_EQP") {
    return { amount: money(blankEqpPrice + THREE_D_EMB_ADDER), formulaBaseLabel: "3D EQP" };
  }

  if (baseReference === "KNIT_IN_EQP") {
    return { amount: blankEqpPrice, formulaBaseLabel: "Knit In EQP" };
  }

  if (baseReference === "PRIOR_BREAK") {
    const priorCode = row.priorQuantityBreakCode;
    if (!priorCode) {
      return {
        amount: null,
        formulaBaseLabel: "Prior Break",
        priorQuantityBreakCode: null,
        priorQuantityBreakLabel: null,
      };
    }

    const priorKey = `${row.decorationMethodCode}:${priorCode}`;
    const priorAmount = calculatedByMethodBreak.get(priorKey) ?? null;

    return {
      amount: priorAmount,
      formulaBaseLabel: `${methodLabel(String(row.decorationMethodCode))} ${row.priorQuantityBreakLabel || priorCode}`,
      priorQuantityBreakCode: priorCode,
      priorQuantityBreakLabel: row.priorQuantityBreakLabel,
    };
  }

  return { amount: null, formulaBaseLabel: baseReferenceLabel(baseReference) };
}

function validateDuplicateRows(ruleRows: ItemPricingRuleRow[], errors: string[]) {
  const seen = new Set<string>();

  for (const row of ruleRows.filter((r) => r.active)) {
    const key = `${row.ruleSetId}:${row.decorationMethodId}:${row.quantityBreakId}`;
    if (seen.has(key)) {
      errors.push(
        `Duplicate active rule row found for ${row.ruleSetName} / ${row.decorationMethodName} / ${row.quantityBreakLabel}.`
      );
    }
    seen.add(key);
  }
}

function methodsToCalculate(input: ItemPricingCalculationInput): string[] {
  const activeMethods = Array.from(
    new Set(
      input.ruleRows
        .filter((r) => r.active)
        .map((r) => String(r.decorationMethodCode || "").toUpperCase())
    )
  );

  const requested = String(input.requestedMethodCode || "").trim().toUpperCase();
  if (requested) return [requested];

  return activeMethods.sort((a, b) => {
    const order: Record<string, number> = { BLANK: 10, FLAT_EMB: 20, THREE_D_EMB: 30, KNIT_IN: 40 };
    return (order[a] ?? 999) - (order[b] ?? 999);
  });
}

export function calculateBaseItemPrices(
  input: ItemPricingCalculationInput
): ItemPricingCalculationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const blankEqpPrice = toNumber(input.blankEqpPrice);

  if (blankEqpPrice === null) {
    errors.push("Blank EQP is required before prices can be calculated.");
  } else if (blankEqpPrice < 0) {
    errors.push("Blank EQP cannot be negative.");
  }

  if (!input.ruleSetId || !input.ruleSetCode) {
    errors.push("Rule set is required.");
  }

  if (!input.ruleSetActive) {
    errors.push(`Rule set ${input.ruleSetName || input.ruleSetCode} is inactive.`);
  }

  if (input.itemActive === false) {
    warnings.push("Item is inactive. Preview is allowed, but this item should not be used for active pricing until reactivated.");
  }

  validateDuplicateRows(input.ruleRows, errors);

  const activeRuleRows = input.ruleRows.filter((row) => row.active);
  const methodCodes = methodsToCalculate(input);
  const calculatedMethods: CalculatedMethodPrices[] = [];

  const flatEqpPrice = blankEqpPrice === null ? null : money(blankEqpPrice + FLAT_EMB_ADDER);
  const threeDEqpPrice = blankEqpPrice === null ? null : money(blankEqpPrice + THREE_D_EMB_ADDER);

  if (blankEqpPrice === null || blankEqpPrice < 0 || errors.length > 0) {
    return {
      priceBook: { id: input.priceBookId ?? null, code: input.priceBookCode ?? null },
      item: {
        id: input.itemId ?? null,
        itemCode: input.itemCode ?? null,
        itemDescription: input.itemDescription ?? null,
        active: input.itemActive !== false,
      },
      ruleSet: {
        id: input.ruleSetId,
        code: input.ruleSetCode,
        name: input.ruleSetName,
        active: input.ruleSetActive,
      },
      blankEqpPrice,
      flatEqpPrice,
      threeDEqpPrice,
      methods: [],
      warnings,
      errors,
    };
  }

  for (const methodCode of methodCodes) {
    const allowedKey = METHOD_TO_ALLOWED_KEY[methodCode];
    if (!allowedKey) {
      errors.push(`Unsupported decoration method ${methodCode}.`);
      continue;
    }

    if (!input.allowedMethods[allowedKey]) {
      const message = `${methodLabel(methodCode)} is not allowed for ${input.itemCode || input.ruleSetName}.`;
      if (input.requestedMethodCode) errors.push(message);
      else warnings.push(message);
      continue;
    }

    const methodRows = activeRuleRows
      .filter((row) => String(row.decorationMethodCode).toUpperCase() === methodCode)
      .sort((a, b) => a.calculationOrder - b.calculationOrder || a.quantityBreakSortOrder - b.quantityBreakSortOrder);

    if (methodRows.length === 0) {
      if (input.requestedMethodCode) errors.push(`No active rule rows are configured for ${methodLabel(methodCode)}.`);
      continue;
    }

    const has2500 = methodRows.some((row) => String(row.quantityBreakCode) === "2500");
    if (!has2500) {
      errors.push(`Missing 2500+ base rule for ${methodLabel(methodCode)}.`);
      continue;
    }

    const calculatedByMethodBreak = new Map<string, number>();
    const prices: CalculatedBreakPrice[] = [];

    for (const row of methodRows) {
      const base = resolveBaseAmount(row, blankEqpPrice, calculatedByMethodBreak);

      if (base.amount === null) {
        errors.push(
          `Missing base amount for ${methodLabel(methodCode)} ${row.quantityBreakLabel}. Check ${baseReferenceLabel(row.baseReference)} configuration.`
        );
        continue;
      }

      const result = money(base.amount + Number(row.adderAmount || 0));
      calculatedByMethodBreak.set(`${methodCode}:${row.quantityBreakCode}`, result);

      prices.push({
        quantityBreakId: row.quantityBreakId,
        quantityBreakCode: String(row.quantityBreakCode),
        quantityBreakLabel: row.quantityBreakLabel,
        minQty: row.minQty,
        maxQty: row.maxQty,
        sortOrder: DISPLAY_BREAK_ORDER[String(row.quantityBreakCode)] ?? row.quantityBreakSortOrder,
        calculatedPrice: result,
        trace: {
          baseReference: String(row.baseReference),
          baseAmount: money(base.amount),
          adderAmount: Number(row.adderAmount || 0),
          result,
          formulaLabel: `${base.formulaBaseLabel} + ${Number(row.adderAmount || 0).toFixed(2)}`,
          priorQuantityBreakCode: base.priorQuantityBreakCode ?? null,
          priorQuantityBreakLabel: base.priorQuantityBreakLabel ?? null,
          sourceRuleId: row.id,
        },
      });
    }

    calculatedMethods.push({
      decorationMethodId: methodRows[0]?.decorationMethodId ?? 0,
      methodCode,
      methodName: methodRows[0]?.decorationMethodName || methodLabel(methodCode),
      prices: prices.sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }

  return {
    priceBook: { id: input.priceBookId ?? null, code: input.priceBookCode ?? null },
    item: {
      id: input.itemId ?? null,
      itemCode: input.itemCode ?? null,
      itemDescription: input.itemDescription ?? null,
      active: input.itemActive !== false,
    },
    ruleSet: {
      id: input.ruleSetId,
      code: input.ruleSetCode,
      name: input.ruleSetName,
      active: input.ruleSetActive,
    },
    blankEqpPrice: money(blankEqpPrice),
    flatEqpPrice,
    threeDEqpPrice,
    methods: calculatedMethods,
    warnings,
    errors,
  };
}

export function assertCalculationSucceeded(result: ItemPricingCalculationResult) {
  if (result.errors.length > 0) {
    throw new Error(result.errors.join(" "));
  }
}
