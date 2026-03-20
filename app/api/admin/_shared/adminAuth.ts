// app/api/admin/_shared/adminAuth.ts
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";

export const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "MANAGER"] as const;

export const GLOBAL_SEARCH_ROLES = [
  "ADMIN",
  "SUPERVISOR",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "SALES",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type GlobalSearchRole = (typeof GLOBAL_SEARCH_ROLES)[number];

async function getAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const payload: any = verifyJwt(token);
  if (!payload) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  return { ok: true as const, payload };
}

export async function requireManagerOrAdmin() {
  const auth = await getAuthPayload();
  if (!auth.ok) return auth;

  const role = String(auth.payload.role || "").toUpperCase();
  if (!ADMIN_ROLES.includes(role as any)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, payload: auth.payload };
}

export async function requireGlobalSearchAccess() {
  const auth = await getAuthPayload();
  if (!auth.ok) return auth;

  const role = String(auth.payload.role || "").toUpperCase();
  if (!GLOBAL_SEARCH_ROLES.includes(role as any)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, payload: auth.payload };
}