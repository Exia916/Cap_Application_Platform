import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  listActivityHistoryByEntity,
  listActivityHistoryBySalesOrder,
} from "@/lib/repositories/activityHistoryRepo";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "TECH",
  "WAREHOUSE",
  "USER",
  "OPERATOR",
]);

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const role = String((auth as any).role || "").trim().toUpperCase();
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const entityType = String(searchParams.get("entityType") || "").trim();
    const entityId = String(searchParams.get("entityId") || "").trim();

    const salesOrderRaw = searchParams.get("salesOrder");
    const detailNumberRaw = searchParams.get("detailNumber");
    const limitRaw = Number.parseInt(String(searchParams.get("limit") || "100"), 10);

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    if (entityType && entityId) {
      const rows = await listActivityHistoryByEntity(entityType, entityId, limit);
      return NextResponse.json({ rows });
    }

    if (salesOrderRaw) {
      const salesOrder = Number.parseInt(String(salesOrderRaw), 10);
      if (!Number.isFinite(salesOrder)) {
        return NextResponse.json({ error: "Invalid salesOrder" }, { status: 400 });
      }

      let detailNumber: number | null | undefined = undefined;
      if (detailNumberRaw != null && String(detailNumberRaw).trim() !== "") {
        const n = Number.parseInt(String(detailNumberRaw), 10);
        if (!Number.isFinite(n)) {
          return NextResponse.json({ error: "Invalid detailNumber" }, { status: 400 });
        }
        detailNumber = n;
      }

      const rows = await listActivityHistoryBySalesOrder(salesOrder, detailNumber, limit);
      return NextResponse.json({ rows });
    }

    return NextResponse.json(
      { error: "Provide entityType + entityId, or salesOrder" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load activity history" },
      { status: 500 }
    );
  }
}