// lib/itemPricing/permissions.ts

const ITEM_PRICING_SETUP_ROLES = new Set(["ADMIN", "MANAGER"]);

export function normalizeItemPricingRole(role: string | null | undefined): string {
  const normalized = String(role || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

  if (normalized === "OVERSEAS CS") return "OVERSEAS CUSTOMER SERVICE";
  return normalized;
}

export function canAccessItemPricingSetup(role: string | null | undefined): boolean {
  return ITEM_PRICING_SETUP_ROLES.has(normalizeItemPricingRole(role));
}

export function canEditItemPricingSetup(role: string | null | undefined): boolean {
  return canAccessItemPricingSetup(role);
}

export function canEditItemPricingRules(role: string | null | undefined): boolean {
  // Phase 1 starts tight because these rows are the base pricing engine.
  return normalizeItemPricingRole(role) === "ADMIN";
}

export function canPreviewItemPricing(role: string | null | undefined): boolean {
  return canAccessItemPricingSetup(role);
}
