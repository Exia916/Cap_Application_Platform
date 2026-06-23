import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import {
  upsertExternalPartnerModuleAccessAdmin,
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
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const access = await upsertExternalPartnerModuleAccessAdmin({
      partnerId: id,
      moduleKey: body.moduleKey || "design_workflow",
      canView: body.canView,
      canAssignSelf: body.canAssignSelf,
      canUpload: body.canUpload,
      canDownload: body.canDownload,
      canNote: body.canNote,
      canComplete: body.canComplete,
      isActive: body.isActive,
      actorUserId: (auth.payload as any)?.id ?? null,
    });

    return NextResponse.json({ access });
  } catch (err: any) {
    console.error("PATCH /api/admin/external-partners/[id]/module-access failed:", err);
    return NextResponse.json(
      { error: externalPartnerAdminUniqueMessage(err, "Failed to update module access") },
      { status: 500 },
    );
  }
}
