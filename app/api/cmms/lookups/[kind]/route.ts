// app/api/cmms/lookups/[kind]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { getAssets, getLookup } from "@/lib/repositories/cmmsRepo";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const auth = getAuthFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!ALLOWED_ROLES.has(String((auth as any).role || "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { kind } = await ctx.params;

  try {
    if (kind === "assets") {
      const url = new URL(req.url);
      const dep = url.searchParams.get("departmentId");
      const departmentId = dep ? Number(dep) : undefined;
      const rows = await getAssets(departmentId);
      return NextResponse.json({ rows }, { status: 200 });
    }

    const rows = await getLookup(kind);
    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed" }, { status: 500 });
  }
}