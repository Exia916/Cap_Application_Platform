// app/api/quick-turn-quote-calculator/setup/_shared.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canMaintainQuickTurnQuoteSetup } from "@/lib/quickTurnQuoteCalculator/permissions";
import {
  createQuickTurnSetupResource,
  getQuickTurnSetupResourceById,
  listQuickTurnSetupResource,
  setQuickTurnSetupResourceActive,
  updateQuickTurnSetupResource,
  type QuickTurnSetupResource,
} from "@/lib/repositories/quickTurnQuoteCalculatorSetupRepo";

export const runtime = "nodejs";

type AuthLike = {
  username?: string | null;
  name?: string | null;
  displayName?: string | null;
  role?: string | null;
  department?: string | null;
};

function userName(auth: AuthLike) {
  return auth.displayName?.trim() || auth.name?.trim() || auth.username?.trim() || "Unknown User";
}

function boolParam(v: string | null) {
  return v === "true" ? true : v === "false" ? false : undefined;
}

async function requireSetupAccess(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return {
      auth: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!canMaintainQuickTurnQuoteSetup(auth)) {
    return {
      auth,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { auth, response: null };
}

export async function handleSetupAccess(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ canMaintain: false }, { status: 401 });
  }

  return NextResponse.json({ canMaintain: canMaintainQuickTurnQuoteSetup(auth) });
}

export async function handleSetupList(req: NextRequest, resource: QuickTurnSetupResource) {
  const { auth, response } = await requireSetupAccess(req);
  if (response) return response;

  try {
    const sp = req.nextUrl.searchParams;
    const rows = await listQuickTurnSetupResource(resource, {
      includeInactive: boolParam(sp.get("includeInactive")) ?? true,
      programId: sp.get("programId"),
      factoryId: sp.get("factoryId"),
      category: sp.get("category"),
      calculatorId: sp.get("calculatorId"),
      q: sp.get("q"),
    });

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load Quick Turn setup records." },
      { status: 500 }
    );
  }
}

export async function handleSetupCreate(req: NextRequest, resource: QuickTurnSetupResource) {
  const { auth, response } = await requireSetupAccess(req);
  if (response) return response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const row = await createQuickTurnSetupResource(resource, body, { changedBy: userName(auth!) });
    return NextResponse.json({ row }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create Quick Turn setup record." },
      { status: 400 }
    );
  }
}

async function getId(ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await ctx.params;
  return params.id;
}

export async function handleSetupDetail(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
  resource: QuickTurnSetupResource
) {
  const { response } = await requireSetupAccess(req);
  if (response) return response;

  try {
    const row = await getQuickTurnSetupResourceById(resource, await getId(ctx));
    if (!row) return NextResponse.json({ error: "Quick Turn setup record not found." }, { status: 404 });
    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load Quick Turn setup record." },
      { status: 500 }
    );
  }
}

export async function handleSetupUpdate(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
  resource: QuickTurnSetupResource
) {
  const { auth, response } = await requireSetupAccess(req);
  if (response) return response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const row = await updateQuickTurnSetupResource(resource, await getId(ctx), body, {
      changedBy: userName(auth!),
    });
    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update Quick Turn setup record." },
      { status: 400 }
    );
  }
}

export async function handleSetupPatchActive(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
  resource: QuickTurnSetupResource
) {
  const { auth, response } = await requireSetupAccess(req);
  if (response) return response;

  try {
    const body = (await req.json().catch(() => ({}))) as { isActive?: boolean; action?: string };
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : String(body.action || "").toLowerCase() === "reactivate";

    const row = await setQuickTurnSetupResourceActive(resource, await getId(ctx), isActive, {
      changedBy: userName(auth!),
    });
    return NextResponse.json({ row });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update Quick Turn setup active status." },
      { status: 400 }
    );
  }
}
