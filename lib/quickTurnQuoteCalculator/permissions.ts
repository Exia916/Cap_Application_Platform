// lib/quickTurnQuoteCalculator/permissions.ts

type RoleDepartmentLike = {
  role?: string | null;
  department?: string | null;
  username?: string | null;
};

const OVERSEAS_DEPARTMENT_ALIASES = new Set([
  "OVERSEAS CUSTOMER SERVICE",
  "OVERSEAS CS",
]);

const SETUP_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

export function normalizeQuickTurnToken(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function isQuickTurnAdmin(user: RoleDepartmentLike | null | undefined): boolean {
  const role = normalizeQuickTurnToken(user?.role);
  const username = normalizeQuickTurnToken(user?.username);
  return role === "ADMIN" || username === "ADMIN";
}

export function isOverseasCustomerServiceDepartment(
  department: string | null | undefined
): boolean {
  return OVERSEAS_DEPARTMENT_ALIASES.has(normalizeQuickTurnToken(department));
}

/**
 * Backward-compatible role alias support.
 *
 * Some older CAP checks treated OVERSEAS CUSTOMER SERVICE / OVERSEAS CS as a role.
 * The new calculator should prefer department-based access, but this prevents
 * existing user records from being locked out during the transition.
 */
export function isOverseasCustomerServiceRole(role: string | null | undefined): boolean {
  return OVERSEAS_DEPARTMENT_ALIASES.has(normalizeQuickTurnToken(role));
}

export function canAccessQuickTurnQuoteCalculator(
  user: RoleDepartmentLike | null | undefined
): boolean {
  if (!user) return false;
  if (isQuickTurnAdmin(user)) return true;

  return (
    isOverseasCustomerServiceDepartment(user.department) ||
    isOverseasCustomerServiceRole(user.role)
  );
}

export function canMaintainQuickTurnQuoteSetup(
  user: RoleDepartmentLike | null | undefined
): boolean {
  if (!user) return false;
  if (isQuickTurnAdmin(user)) return true;

  const role = normalizeQuickTurnToken(user.role);

  return (
    SETUP_ROLES.has(role) &&
    (isOverseasCustomerServiceDepartment(user.department) ||
      isOverseasCustomerServiceRole(user.role))
  );
}

export function canSaveQuickTurnQuote(user: RoleDepartmentLike | null | undefined): boolean {
  return canAccessQuickTurnQuoteCalculator(user);
}

export function canViewSavedQuickTurnQuote(user: RoleDepartmentLike | null | undefined): boolean {
  return canAccessQuickTurnQuoteCalculator(user);
}

export function canVoidSavedQuickTurnQuote(user: RoleDepartmentLike | null | undefined): boolean {
  return canAccessQuickTurnQuoteCalculator(user);
}

export function canUnvoidSavedQuickTurnQuote(user: RoleDepartmentLike | null | undefined): boolean {
  return isQuickTurnAdmin(user);
}
