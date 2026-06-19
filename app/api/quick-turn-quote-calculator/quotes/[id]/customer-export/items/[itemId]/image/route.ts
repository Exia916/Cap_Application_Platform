import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canSaveQuickTurnQuote } from "@/lib/quickTurnQuoteCalculator/permissions";
import { setQuickTurnCustomerExportItemImage } from "@/lib/repositories/quickTurnQuoteCustomerExportRepo";

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

async function getParams(ctx: {
  params: Promise<{ id: string; itemId: string }> | { id: string; itemId: string };
}) {
  return await ctx.params;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> | { id: string; itemId: string } }
) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canSaveQuickTurnQuote(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id, itemId } = await getParams(ctx);
    const body = await req.json().catch(() => ({}));
    const row = await setQuickTurnCustomerExportItemImage(id, itemId, body?.attachmentId ?? null, {
      changedBy: userName(auth),
      changedByUserId: auth.id ?? null,
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update customer-facing item image." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> | { id: string; itemId: string } }
) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canSaveQuickTurnQuote(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id, itemId } = await getParams(ctx);
    const row = await setQuickTurnCustomerExportItemImage(id, itemId, null, {
      changedBy: userName(auth),
      changedByUserId: auth.id ?? null,
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to remove customer-facing item image." },
      { status: 400 }
    );
  }
}
