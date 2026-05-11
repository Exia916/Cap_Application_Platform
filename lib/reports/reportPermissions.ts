// lib/reports/reportPermissions.ts

import type { AuthUserWithLegacy } from "@/lib/auth";

export const REPORT_ACCESS_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR"] as const;

export function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase();
}

export function canAccessReports(role?: string | null) {
  return REPORT_ACCESS_ROLES.includes(normalizeRole(role) as any);
}

export function requireReportAccess(user: AuthUserWithLegacy | null) {
  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  if (!canAccessReports(user.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, user };
}

export function canManageSavedReport(input: {
  user: AuthUserWithLegacy;
  ownerUserId?: string | null;
}) {
  const role = normalizeRole(input.user.role);

  if (role === "ADMIN") return true;

  const userId = String(input.user.id || input.user.userId || "");
  return !!input.ownerUserId && input.ownerUserId === userId;
}

export function canUseDataset(input: {
  user: AuthUserWithLegacy;
  allowedRoles: string[];
}) {
  const role = normalizeRole(input.user.role);
  return input.allowedRoles.map(normalizeRole).includes(role);
}