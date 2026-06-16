import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canViewSavedQuickTurnQuote } from "@/lib/quickTurnQuoteCalculator/permissions";
import { getSavedQuickTurnQuoteById } from "@/lib/repositories/quickTurnQuoteCalculatorRepo";

export const runtime = "nodejs";

type AuthLike = {
  role?: string | null;
  department?: string | null;
  username?: string | null;
};

async function getId(ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await ctx.params;
  return params.id;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canViewSavedQuickTurnQuote(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = await getId(ctx);
  const includeVoided = req.nextUrl.searchParams.get("includeVoided") === "true";
  const row = await getSavedQuickTurnQuoteById(id, { includeVoided });

  if (!row) {
    return NextResponse.json({ error: "Saved Quick Turn quote not found." }, { status: 404 });
  }

  return NextResponse.json({ row });
}

export async function PUT() {
  return NextResponse.json(
    { error: "Saved quote editing is not supported in this batch. Create a new saved quote from generated results." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Hard delete is not supported. Use the void route." },
    { status: 405 }
  );
}
