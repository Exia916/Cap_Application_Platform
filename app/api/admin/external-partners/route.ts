import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import {
  listExternalPartnersAdmin,
  updateExternalPartnerAdmin,
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

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const partners = await listExternalPartnersAdmin();
    return NextResponse.json({ partners });
  } catch (err) {
    console.error("GET /api/admin/external-partners failed:", err);
    return NextResponse.json({ error: "Failed to load external partners" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = (await req.json().catch(() => null)) as any;
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const partnerId = String(body.partnerId ?? "").trim();
    if (!partnerId) return NextResponse.json({ error: "Missing partner id" }, { status: 400 });

    const partner = await updateExternalPartnerAdmin({
      partnerId,
      name: body.name,
      partnerType: body.partnerType,
      isActive: body.isActive,
      actorUserId: (auth.payload as any)?.id ?? null,
    });

    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    return NextResponse.json({ partner });
  } catch (err: any) {
    console.error("PATCH /api/admin/external-partners failed:", err);
    return NextResponse.json(
      { error: externalPartnerAdminUniqueMessage(err, "Failed to update external partner") },
      { status: 500 },
    );
  }
}
