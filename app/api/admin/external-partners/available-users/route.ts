import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { listAvailableExternalPartnerUsers } from "@/lib/repositories/externalPartnerAdminRepo";

export const runtime = "nodejs";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyJwt(token);
}

async function requireAdmin() {
  const payload: any = await getAuth();
  if (!payload) return { ok: false as const, status: 401, error: "Unauthorized" };

  const role = String(payload.role || "").trim().toUpperCase();
  if (role !== "ADMIN") return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const, payload };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const users = await listAvailableExternalPartnerUsers();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("GET /api/admin/external-partners/available-users failed:", err);
    return NextResponse.json({ error: "Failed to load available users" }, { status: 500 });
  }
}
