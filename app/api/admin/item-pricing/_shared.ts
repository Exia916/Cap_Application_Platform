// app/api/admin/item-pricing/_shared.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canAccessItemPricingSetup,
  canEditItemPricingRules,
  canEditItemPricingSetup,
  canPreviewItemPricing,
} from "@/lib/itemPricing/permissions";

export type ItemPricingAuthLike = {
  id?: string | null;
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
};

export function authName(auth: ItemPricingAuthLike) {
  return auth.displayName?.trim() || auth.username?.trim() || "Unknown User";
}

export function authUserId(auth: ItemPricingAuthLike) {
  return auth.id || auth.userId || auth.username || null;
}

export async function requireItemPricingAuth(req: NextRequest, action: "view" | "edit" | "rules" | "preview" = "view") {
  const auth = (await getAuthFromRequest(req as any)) as ItemPricingAuthLike | null;

  if (!auth) {
    return {
      auth: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const allowed =
    action === "edit"
      ? canEditItemPricingSetup(auth.role)
      : action === "rules"
        ? canEditItemPricingRules(auth.role)
        : action === "preview"
          ? canPreviewItemPricing(auth.role)
          : canAccessItemPricingSetup(auth.role);

  if (!allowed) {
    return {
      auth: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { auth, response: null };
}

export function withAudit<T extends Record<string, any>>(body: T, auth: ItemPricingAuthLike) {
  return {
    ...body,
    changedBy: authName(auth),
    changedByUserId: authUserId(auth),
    changedByEmployeeNumber: auth.employeeNumber ?? null,
  };
}

export function boolParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function errorJson(err: any, fallback: string, status = 400) {
  return NextResponse.json({ error: err?.message || fallback }, { status });
}
