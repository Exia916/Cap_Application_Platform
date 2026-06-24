// lib/itemPricing/itemPricingPriceLevelService.ts

import type { ItemPricingCalculationResult } from "@/lib/itemPricing/types";
import type {
  ItemPricingPriceLevel,
  ItemPricingPriceLevelBreakPrice,
  ItemPricingPriceLevelMethodPrices,
  ItemPricingPriceLevelPreviewResult,
  ItemPricingPriceLevelRule,
} from "@/lib/itemPricing/priceLevelTypes";

function money2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function roundByMode(value: number, mode: string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return n;
  switch (String(mode || "HALF_UP_2").toUpperCase()) {
    case "NONE":
      return n;
    case "CEILING_2":
      return Math.ceil(n * 100) / 100;
    case "FLOOR_2":
      return Math.floor(n * 100) / 100;
    case "HALF_UP_2":
    default:
      return money2(n);
  }
}

function ruleSpecificity(rule: ItemPricingPriceLevelRule): number {
  let score = 0;
  if (rule.ruleSetId != null) score += 4;
  if (rule.decorationMethodId != null) score += 2;
  if (rule.quantityBreakId != null) score += 1;
  return score;
}

function ruleApplies(input: {
  rule: ItemPricingPriceLevelRule;
  ruleSetId: number;
  decorationMethodId: number;
  quantityBreakId: number;
}) {
  const { rule, ruleSetId, decorationMethodId, quantityBreakId } = input;
  if (!rule.active) return false;
  if (rule.ruleSetId != null && rule.ruleSetId !== ruleSetId) return false;
  if (rule.decorationMethodId != null && rule.decorationMethodId !== decorationMethodId) return false;
  if (rule.quantityBreakId != null && rule.quantityBreakId !== quantityBreakId) return false;
  return true;
}

function describeRule(rule: ItemPricingPriceLevelRule): string {
  const type = String(rule.ruleType || "").toUpperCase();
  if (type === "MULTIPLIER") return `Multiplier × ${Number(rule.multiplier ?? 1).toFixed(4)}`;
  if (type === "CODED_MULTIPLIER") return `Coded multiplier × ${Number(rule.multiplier ?? 1).toFixed(4)}`;
  if (type === "ADD_AMOUNT") return `Add $${Number(rule.addAmount ?? 0).toFixed(2)}`;
  if (type === "DISCOUNT_PERCENT") return `Discount ${Number(rule.percentValue ?? 0).toFixed(2)}%`;
  if (type === "OVERRIDE_PRICE") return `Override $${Number(rule.overridePrice ?? 0).toFixed(2)}`;
  return type;
}

function applyRule(current: number, rule: ItemPricingPriceLevelRule): number {
  const type = String(rule.ruleType || "").toUpperCase();
  let result = current;

  if (type === "MULTIPLIER" || type === "CODED_MULTIPLIER") {
    result = current * Number(rule.multiplier ?? 1);
  } else if (type === "ADD_AMOUNT") {
    result = current + Number(rule.addAmount ?? 0);
  } else if (type === "DISCOUNT_PERCENT") {
    result = current * (1 - Number(rule.percentValue ?? 0) / 100);
  } else if (type === "OVERRIDE_PRICE") {
    result = Number(rule.overridePrice ?? current);
  }

  if (rule.minimumPrice != null) result = Math.max(result, Number(rule.minimumPrice));
  if (rule.maximumPrice != null) result = Math.min(result, Number(rule.maximumPrice));
  return roundByMode(result, rule.roundingMode);
}

export function calculatePriceLevelPreview(input: {
  baseCalculation: ItemPricingCalculationResult;
  priceLevel: ItemPricingPriceLevel;
  rules: ItemPricingPriceLevelRule[];
}): ItemPricingPriceLevelPreviewResult {
  const warnings = [...(input.baseCalculation.warnings || [])];
  const errors = [...(input.baseCalculation.errors || [])];

  if (!input.priceLevel.active) {
    warnings.push(`Price level ${input.priceLevel.code} is inactive.`);
  }

  const sortedRules = [...(input.rules || [])]
    .filter((rule) => rule.active)
    .sort((a, b) => {
      const order = Number(a.calculationOrder || 0) - Number(b.calculationOrder || 0);
      if (order !== 0) return order;
      return ruleSpecificity(b) - ruleSpecificity(a);
    });

  const methods: ItemPricingPriceLevelMethodPrices[] = input.baseCalculation.methods.map((method) => {
    const prices: ItemPricingPriceLevelBreakPrice[] = method.prices.map((price) => {
      let current = Number(price.calculatedPrice);
      const applicableRules = sortedRules.filter((rule) =>
        ruleApplies({
          rule,
          ruleSetId: input.baseCalculation.ruleSet.id,
          decorationMethodId: method.decorationMethodId,
          quantityBreakId: price.quantityBreakId,
        })
      );

      const appliedRules = applicableRules.map((rule) => {
        const before = current;
        const after = applyRule(current, rule);
        current = after;
        return {
          ruleId: rule.id,
          ruleType: rule.ruleType,
          label: describeRule(rule),
          before,
          after,
        };
      });

      return {
        quantityBreakId: price.quantityBreakId,
        quantityBreakCode: price.quantityBreakCode,
        quantityBreakLabel: price.quantityBreakLabel,
        minQty: price.minQty,
        maxQty: price.maxQty,
        sortOrder: price.sortOrder,
        basePrice: Number(price.calculatedPrice),
        finalPrice: money2(current),
        appliedRules,
      };
    });

    return {
      decorationMethodId: method.decorationMethodId,
      methodCode: method.methodCode,
      methodName: method.methodName,
      prices,
    };
  });

  return {
    baseCalculation: input.baseCalculation,
    priceLevel: input.priceLevel,
    methods,
    warnings,
    errors,
  };
}
