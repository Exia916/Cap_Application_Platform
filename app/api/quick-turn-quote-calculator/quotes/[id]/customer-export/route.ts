import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canSaveQuickTurnQuote,
  canViewSavedQuickTurnQuote,
} from "@/lib/quickTurnQuoteCalculator/permissions";
import {
  getQuickTurnCustomerExport,
  saveQuickTurnCustomerExport,
  logQuickTurnCustomerExportPreview,
} from "@/lib/repositories/quickTurnQuoteCustomerExportRepo";

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

  try {
    const id = await getId(ctx);
    const includeVoided = req.nextUrl.searchParams.get("includeVoided") === "true";
    const logPreview = req.nextUrl.searchParams.get("logPreview") === "true";
    const row = await getQuickTurnCustomerExport(id, { includeVoided });

    if (logPreview) {
      await logQuickTurnCustomerExportPreview(id, {
        changedBy: userName(auth),
        changedByUserId: auth.id ?? null,
        changedByEmployeeNumber: auth.employeeNumber ?? null,
      }).catch(() => undefined);
    }

    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load customer-facing Quick Turn quote setup." },
      { status: 400 }
    );
  }
}

export async function PUT(
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
    const body = await req.json();
    const row = await saveQuickTurnCustomerExport(id, body, {
      changedBy: userName(auth),
      changedByUserId: auth.id ?? null,
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save customer-facing Quick Turn quote setup." },
      { status: 400 }
    );
  }
}
