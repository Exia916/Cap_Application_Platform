import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { approveRecutRequest, getRecutRequestById } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp = { ok: true } | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const current = await getRecutRequestById(id);

    if (!current) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    if (!current.supervisorApproved) {
      const approvedBy = String(
        (auth as any).displayName ?? (auth as any).username ?? "Unknown"
      ).trim();

      await approveRecutRequest({
        id,
        approvedBy,
      });
    }

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("recut approve POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}