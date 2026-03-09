import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listRecutItems } from "@/lib/repositories/recutRepo";

export const runtime = "nodejs";

type Resp =
  | {
      rows: Awaited<ReturnType<typeof listRecutItems>>;
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

    const rows = await listRecutItems();
    return NextResponse.json<Resp>({ rows }, { status: 200 });
  } catch (err) {
    console.error("recut items lookup GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}