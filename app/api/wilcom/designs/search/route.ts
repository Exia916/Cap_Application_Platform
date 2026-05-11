import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  searchWilcomDesigns,
  WILCOM_DESIGN_SEARCH_PARAMS,
  type WilcomDesignSearchInput,
} from "@/lib/integrations/wilcomDesigns";

const DESIGN_LOOKUP_ROLES = [
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "CUSTOMER SERVICE",
  "OVERSEAS CUSTOMER SERVICE",
  "SALES",
  "PURCHASING",
  "ART",
  "DIGITIZING",
  "ORDER PROCESSING",
  "USER",
  "WAREHOUSE",
] as const;

function canUseDesignLookup(user: ReturnType<typeof getAuthFromRequest>) {
  if (!user) return false;

  const username = String(user.username ?? "").trim().toLowerCase();
  const role = String(user.role ?? "").trim().toUpperCase();

  return username === "admin" || DESIGN_LOOKUP_ROLES.includes(role as any);
}

function friendlyWilcomError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("unauthorized")) {
    return "Wilcom design lookup is not authorized. Please contact IT.";
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("unable to reach") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout")
  ) {
    return "Unable to reach the Wilcom design lookup service.";
  }

  if (lower.includes("pointing back to cap")) {
    return "Wilcom design lookup is misconfigured. Please contact IT.";
  }

  return message || "Failed to search Wilcom designs.";
}

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canUseDesignLookup(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const input: WilcomDesignSearchInput = {};

  for (const key of WILCOM_DESIGN_SEARCH_PARAMS) {
    const value = params.get(key);
    if (value != null && value.trim()) {
      input[key] = value.trim();
    }
  }

  if (!input.limit) {
    input.limit = 50;
  }

  try {
    const result = await searchWilcomDesigns(input);

    return NextResponse.json({
      count: result.count,
      results: result.results,
    });
  } catch (err: any) {
    const rawMessage = err?.message || "Failed to search Wilcom designs.";

    console.error("[DesignLookupAPI] Wilcom design search failed.", {
      message: rawMessage,
      input: {
        ...input,
        limit: input.limit ?? 50,
      },
      hasWilcomApiKey: Boolean(process.env.WILCOM_API_KEY?.trim()),
      wilcomSearchUrl: process.env.WILCOM_DESIGNS_SEARCH_URL || null,
    });

    return NextResponse.json(
      {
        error: friendlyWilcomError(rawMessage),
      },
      { status: 500 }
    );
  }
}