import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listActiveKnitQcRejectReasons } from "@/lib/repositories/knitQcRejectReasonRepo";

/**
 * API endpoint to retrieve Knit QC reject reasons. The list is
 * filtered to only include active records and ordered by sort order.
 * All authenticated users can access this list because reject reasons
 * are not sensitive information. The response format matches the
 * repository return type.
 */

export const runtime = "nodejs";

type Resp = { reasons: Awaited<ReturnType<typeof listActiveKnitQcRejectReasons>> } | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleOk(auth.role, VIEW_ROLES)) {
    return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const reasons = await listActiveKnitQcRejectReasons();
    return NextResponse.json<Resp>({ reasons }, { status: 200 });
  } catch (err: any) {
    console.error("knit-qc-reject-reasons GET error:", err);
    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}