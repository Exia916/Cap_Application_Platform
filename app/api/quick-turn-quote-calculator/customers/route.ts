import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canAccessQuickTurnQuoteCalculator } from "@/lib/quickTurnQuoteCalculator/permissions";
import { listQuickTurnQuoteCustomerOptions } from "@/lib/repositories/quickTurnQuoteCustomerExportRepo";

export const runtime = "nodejs";

type AuthLike = {
  role?: string | null;
  department?: string | null;
  username?: string | null;
};

export async function GET(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessQuickTurnQuoteCalculator(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const q = req.nextUrl.searchParams.get("q");
    const rows = await listQuickTurnQuoteCustomerOptions(q);
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load Quick Turn customer options." },
      { status: 500 }
    );
  }
}
