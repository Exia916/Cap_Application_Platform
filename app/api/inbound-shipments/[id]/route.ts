import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canAccessInboundShipments,
  canEditInboundShipment,
} from "@/lib/inboundShipments/permissions";
import {
  getInboundShipmentById,
  updateInboundShipment,
} from "@/lib/repositories/inboundShipmentRepo";

export const runtime = "nodejs";

type AuthLike = {
  id?: string | null;
  userId?: string | null;
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
};

function userName(auth: AuthLike) {
  return auth.displayName?.trim() || auth.username?.trim() || "Unknown User";
}

function userId(auth: AuthLike) {
  return auth.id || auth.userId || auth.username || null;
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

  if (!canAccessInboundShipments(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = await getId(ctx);
  const includeVoided = req.nextUrl.searchParams.get("includeVoided") === "true";

  const row = await getInboundShipmentById(id, { includeVoided });

  if (!row) {
    return NextResponse.json({ error: "Inbound shipment not found." }, { status: 404 });
  }

  return NextResponse.json({ row });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEditInboundShipment(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const id = await getId(ctx);
    const body = await req.json();

    await updateInboundShipment(id, {
      ...body,
      changedBy: userName(auth),
      changedByUserId: userId(auth),
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update inbound shipment." },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Hard delete is not supported. Use the void route." },
    { status: 405 }
  );
}