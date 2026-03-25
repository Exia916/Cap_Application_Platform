import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listAvailableWorkAreas } from "@/lib/repositories/productionWorkSessionRepo";

export const runtime = "nodejs";

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

type Resp =
  | { rows: any[] }
  | { error: string };

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }

  if (!roleOk(auth.role, VIEW_ROLES)) {
    return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
  }

  const moduleKey = String(req.nextUrl.searchParams.get("moduleKey") ?? "").trim();
  if (!moduleKey) {
    return NextResponse.json<Resp>({ error: "moduleKey is required." }, { status: 400 });
  }

  const rows = await listAvailableWorkAreas(moduleKey);
  return NextResponse.json<Resp>({ rows }, { status: 200 });
}