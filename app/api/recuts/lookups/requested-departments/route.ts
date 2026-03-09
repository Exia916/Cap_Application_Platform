import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listRecutRequestedDepartments } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp =
  | {
      rows: Awaited<ReturnType<typeof listRecutRequestedDepartments>>;
    }
  | { error: string };

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER", "WAREHOUSE"]);

function roleOk(role: string | null | undefined) {
  return ALLOWED_ROLES.has(String(role || "").trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthFromRequest(req as any);
    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk((auth as any).role)) {
      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await listRecutRequestedDepartments();
    return NextResponse.json<Resp>({ rows }, { status: 200 });
  } catch (err) {
    console.error("recut requested departments lookup GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}