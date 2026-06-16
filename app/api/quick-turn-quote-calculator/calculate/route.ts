import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canAccessQuickTurnQuoteCalculator } from "@/lib/quickTurnQuoteCalculator/permissions";
import { calculateQuickTurnQuote } from "@/lib/services/quickTurnQuoteCalculatorService";

export const runtime = "nodejs";

type AuthLike = {
  role?: string | null;
  department?: string | null;
  username?: string | null;
};

export async function POST(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessQuickTurnQuoteCalculator(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const result = await calculateQuickTurnQuote(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to calculate Quick Turn quote." },
      { status: 400 }
    );
  }
}
