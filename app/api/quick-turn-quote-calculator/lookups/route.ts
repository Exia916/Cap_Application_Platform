import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canAccessQuickTurnQuoteCalculator,
  canMaintainQuickTurnQuoteSetup,
} from "@/lib/quickTurnQuoteCalculator/permissions";
import { listQuickTurnLookups } from "@/lib/repositories/quickTurnQuoteCalculatorRepo";

export const runtime = "nodejs";

type AuthLike = {
  role?: string | null;
  department?: string | null;
  username?: string | null;
};

function boolParam(v: string | null) {
  return v === "true" ? true : v === "false" ? false : undefined;
}

export async function GET(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessQuickTurnQuoteCalculator(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const includeInactive = boolParam(sp.get("includeInactive")) ?? false;

    if (includeInactive && !canMaintainQuickTurnQuoteSetup(auth)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await listQuickTurnLookups({
      programId: sp.get("programId"),
      factoryId: sp.get("factoryId"),
      includeInactive,
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load Quick Turn lookups." },
      { status: 500 }
    );
  }
}
