import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getRecutRequestById, unvoidRecutRequest } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing recut id" }, { status: 400 });
    }

    const existing = await getRecutRequestById(id, { includeVoided: true });
    if (!existing) {
      return NextResponse.json({ error: "Recut request not found" }, { status: 404 });
    }

    if (!existing.isVoided) {
      return NextResponse.json({ error: "Recut request is not voided" }, { status: 409 });
    }

    const ok = await unvoidRecutRequest({ id });

    if (!ok) {
      return NextResponse.json({ error: "Unable to restore recut request" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("POST /api/recuts/[id]/unvoid failed:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}