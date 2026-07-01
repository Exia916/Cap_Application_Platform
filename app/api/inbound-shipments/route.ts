import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  canAccessInboundShipments,
  canCreateInboundShipment,
} from "@/lib/inboundShipments/permissions";
import {
  createInboundShipment,
  type SortDir,
} from "@/lib/repositories/inboundShipmentRepo";
import { listInboundShipmentsForList } from "@/lib/repositories/inboundShipmentListRepo";

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

function boolParam(v: string | null) {
  return v === "true" ? true : v === "false" ? false : undefined;
}

function csvParam(sp: URLSearchParams, name: string): string[] | null {
  const values = sp
    .getAll(name)
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length ? values : null;
}

export async function GET(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessInboundShipments(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  try {
    const rows = await listInboundShipmentsForList({
      q: sp.get("q"),
      status: sp.get("status"),
      excludeStatusCodes:
        csvParam(sp, "excludeStatusCodes") ?? csvParam(sp, "excludeStatusCode"),
      containerNumber: sp.get("containerNumber"),
      mblNumber: sp.get("mblNumber"),
      hblNumber: sp.get("hblNumber"),
      port: sp.get("port"),
      carrier: sp.get("carrier"),
      forwarder: sp.get("forwarder"),
      shipmentType: sp.get("shipmentType"),
      containerDestination: sp.get("containerDestination"),
      etdFrom: sp.get("etdFrom"),
      etdTo: sp.get("etdTo"),
      etaFrom: sp.get("etaFrom"),
      etaTo: sp.get("etaTo"),
      customer: sp.get("customer"),
      poNumber: sp.get("poNumber"),
      includeVoided: boolParam(sp.get("includeVoided")),
      onlyVoided: boolParam(sp.get("onlyVoided")),
      sortBy: sp.get("sortBy"),
      sortDir: (sp.get("sortDir") as SortDir | null) || "asc",
      limit: Number(sp.get("limit") || 25),
      offset: Number(sp.get("offset") || 0),
    });

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load inbound shipments." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = (await getAuthFromRequest(req as any)) as AuthLike | null;

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canCreateInboundShipment(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    const created = await createInboundShipment({
      ...body,
      changedBy: userName(auth),
      changedByUserId: userId(auth),
      changedByEmployeeNumber: auth.employeeNumber ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create inbound shipment." },
      { status: 400 }
    );
  }
}