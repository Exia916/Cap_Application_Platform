// app/api/sales-orders/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { normalizeSalesOrder } from "@/lib/utils/salesOrder";

export const runtime = "nodejs";

class SalesOrderLookupError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SalesOrderLookupError";
    this.status = status;
  }
}

function getBaseUrl(): string {
  const raw = String(process.env.SBT_SALES_ORDER_API_BASE || "").trim();
  if (!raw) {
    throw new SalesOrderLookupError("SBT_SALES_ORDER_API_BASE is not configured.", 500);
  }
  return raw.replace(/\/+$/, "");
}

function coerceComments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function sanitizeData(data: any) {
  const safe = data && typeof data === "object" ? data : {};

  return {
    ...safe,
    sbtOrderInfo: {
      ...(safe.sbtOrderInfo || {}),
      comments: coerceComments(safe?.sbtOrderInfo?.comments),
      items: Array.isArray(safe?.sbtOrderInfo?.items) ? safe.sbtOrderInfo.items : [],
    },
    sodeco: Array.isArray(safe?.sodeco) ? safe.sodeco : [],
  };
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const so = String(searchParams.get("so") || "").trim();

  const normalized = normalizeSalesOrder(so);
  if (!normalized.isValid || !normalized.salesOrderBase || !normalized.salesOrderDisplay) {
    return NextResponse.json(
      { error: normalized.error || "Invalid Sales Order." },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getBaseUrl();
    const upstreamUrl = `${baseUrl}/salesorder?so=${encodeURIComponent(normalized.salesOrderBase)}`;

    let res: Response;
    try {
      res = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "Unable to reach the SBT Sales Order endpoint. Verify network access from the app runtime.",
        },
        { status: 502 }
      );
    }

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            body?.error ||
            body?.message ||
            `SBT lookup failed with status ${res.status}.`,
        },
        { status: res.status || 502 }
      );
    }

    if (!body?.success || !body?.data) {
      return NextResponse.json(
        {
          error: body?.error || body?.message || "No Sales Order data was returned.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      requestedSalesOrder: normalized.salesOrderDisplay,
      salesOrderBase: normalized.salesOrderBase,
      salesOrderDisplay: normalized.salesOrderDisplay,
      printUrl: `/sales-orders/${encodeURIComponent(normalized.salesOrderBase)}/print`,
      data: sanitizeData(body.data),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error while looking up the Sales Order." },
      { status: 500 }
    );
  }
}