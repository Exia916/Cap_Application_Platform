import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canAccessInboundShipments } from "@/lib/inboundShipments/permissions";
import { listInboundShipmentCustomerOptions } from "@/lib/repositories/inboundShipmentRepo";

export const runtime = "nodejs";

type AuthLike = {
  role?: string | null;
};

export async function GET(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessInboundShipments(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q");

  const rows = await listInboundShipmentCustomerOptions(q);

  return NextResponse.json({ rows });
}