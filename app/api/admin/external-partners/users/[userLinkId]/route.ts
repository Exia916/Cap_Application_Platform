import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import {
  deactivateExternalPartnerUserAdmin,
  updateExternalPartnerUserAdmin,
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userLinkId: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { userLinkId } = await context.params;
    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const partnerUser = await updateExternalPartnerUserAdmin({
      userLinkId,
      externalRole: body.externalRole,
      isActive: body.isActive,
      actorUserId: (auth.payload as any)?.id ?? null,
    });

    if (!partnerUser) return NextResponse.json({ error: "External partner user link not found" }, { status: 404 });
    return NextResponse.json({ partnerUser });
  } catch (err: any) {
    console.error("PATCH /api/admin/external-partners/users/[userLinkId] failed:", err);
    return NextResponse.json(
      { error: externalPartnerAdminUniqueMessage(err, "Failed to update external partner user") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ userLinkId: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { userLinkId } = await context.params;
    const partnerUser = await deactivateExternalPartnerUserAdmin({
      userLinkId,
      actorUserId: (auth.payload as any)?.id ?? null,
    });

    if (!partnerUser) return NextResponse.json({ error: "External partner user link not found" }, { status: 404 });
    return NextResponse.json({ partnerUser });
  } catch (err: any) {
    console.error("DELETE /api/admin/external-partners/users/[userLinkId] failed:", err);
    return NextResponse.json(
      { error: externalPartnerAdminUniqueMessage(err, "Failed to deactivate external partner user") },
      { status: 500 },
    );
  }
}
