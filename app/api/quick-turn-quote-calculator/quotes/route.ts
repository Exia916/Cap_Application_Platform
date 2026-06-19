import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canAccessQuickTurnQuoteCalculator,
  canSaveQuickTurnQuote,
} from "@/lib/quickTurnQuoteCalculator/permissions";
import {
  listSavedQuickTurnQuotes,
  type QuickTurnQuoteStatus,
  type SortDir,
} from "@/lib/repositories/quickTurnQuoteCalculatorRepo";
import { saveCalculatedQuickTurnQuote } from "@/lib/services/quickTurnQuoteCalculatorService";

export const runtime = "nodejs";

type AuthLike = {
  id?: string | null;
  userId?: string | null;
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

function userUuid(auth: AuthLike) {
  return auth.id || null;
}

function boolParam(v: string | null) {
  return v === "true" ? true : v === "false" ? false : undefined;
}

function quoteStatusParam(v: string | null): QuickTurnQuoteStatus | null {
  const token = String(v || "").trim().toUpperCase();
  return token === "DRAFT" || token === "PUBLISHED" ? token : null;
}

export async function GET(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessQuickTurnQuoteCalculator(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  try {
    const payload = await listSavedQuickTurnQuotes({
      q: sp.get("q"),
      quoteStatus: quoteStatusParam(sp.get("quoteStatus")),
      includeVoided: boolParam(sp.get("includeVoided")),
      onlyVoided: boolParam(sp.get("onlyVoided")),
      sortBy: sp.get("sortBy"),
      sortDir: (sp.get("sortDir") as SortDir | null) || "desc",
      limit: Number(sp.get("limit") || 25),
      offset: Number(sp.get("offset") || 0),
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load saved Quick Turn quotes." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canSaveQuickTurnQuote(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const saved = await saveCalculatedQuickTurnQuote({
      ...body,
      changedBy: userName(auth),
      changedByUserId: userUuid(auth),
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save Quick Turn draft." },
      { status: 400 }
    );
  }
}
