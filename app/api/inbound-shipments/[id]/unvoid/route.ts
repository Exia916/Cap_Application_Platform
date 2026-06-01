import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canUnvoidInboundShipment } from "@/lib/inboundShipments/permissions";
import { unvoidInboundShipment } from "@/lib/repositories/inboundShipmentRepo";

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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canUnvoidInboundShipment(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const id = await getId(ctx);

    await unvoidInboundShipment({
      id,
      changedBy: userName(auth),
      changedByUserId: userId(auth),
      employeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to unvoid inbound shipment." },
      { status: 400 }
    );
  }
}