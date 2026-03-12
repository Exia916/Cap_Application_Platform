import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getRecutRequestById, setRecutDoNotPull } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp = { ok: true } | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "WAREHOUSE"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    if (!roleOk((auth as any).role)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const value = !!body?.value;

    const { id } = await ctx.params;
    const row = await getRecutRequestById(id);

    if (!row) {
      return NextResponse.json<Resp>({ error: "Not found" }, { status: 404 });
    }

    const changedBy = String(
      (auth as any).displayName ?? (auth as any).username ?? "Unknown"
    ).trim();

    await setRecutDoNotPull({
      id,
      value,
      changedBy,
    });

    return NextResponse.json<Resp>({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("toggle do_not_pull POST error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}