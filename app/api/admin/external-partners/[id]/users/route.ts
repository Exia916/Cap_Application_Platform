import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import {
  addExternalPartnerUserAdmin,
  externalPartnerAdminUniqueMessage,
} from "@/lib/repositories/externalPartnerAdminRepo";

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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const partnerUser = await addExternalPartnerUserAdmin({
      partnerId: id,
      userId: body.userId,
      externalRole: body.externalRole,
      isActive: body.isActive !== false,
      actorUserId: (auth.payload as any)?.id ?? null,
    });

    return NextResponse.json({ partnerUser });
  } catch (err: any) {
    console.error("POST /api/admin/external-partners/[id]/users failed:", err);
    return NextResponse.json(
      { error: externalPartnerAdminUniqueMessage(err, "Failed to link external partner user") },
      { status: 500 },
    );
  }
}
