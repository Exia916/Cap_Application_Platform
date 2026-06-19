import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canSaveQuickTurnQuote } from "@/lib/quickTurnQuoteCalculator/permissions";
import { duplicateSavedQuickTurnQuote } from "@/lib/repositories/quickTurnQuoteCalculatorRepo";

export const runtime = "nodejs";

type AuthLike = {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  department?: string | null;
};

function userName(auth: AuthLike) {
  return auth.displayName?.trim() || auth.name?.trim() || auth.username?.trim() || "Unknown User";
}

async function getId(ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await ctx.params;
  return params.id;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canSaveQuickTurnQuote(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const id = await getId(ctx);
    const body = await req.json().catch(() => ({}));
    const row = await duplicateSavedQuickTurnQuote(id, {
      quoteName: body?.quoteName ?? null,
      changedBy: userName(auth),
      changedByUserId: auth.id ?? null,
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to duplicate/revise Quick Turn quote." },
      { status: 400 }
    );
  }
}
