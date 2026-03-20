import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { listActiveKnitAreaLookup } from "@/lib/repositories/knitProductionRepo";
import { logError, logWarn } from "@/lib/logging/logger";

export const runtime = "nodejs";

type Resp =
  | {
      rows: Array<{
        id: string;
        areaName: string;
        sortOrder: number;
        isActive: boolean;
      }>;
    }
  | { error: string };

const VIEW_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "USER"]);

function roleOk(role: string | null | undefined, allowed: Set<string>) {
  return allowed.has(String(role || "").trim().toUpperCase());
}

export async function GET(req: Request) {
  let auth: Awaited<ReturnType<typeof getAuthFromRequest>> | null = null;

  try {
    auth = await getAuthFromRequest(req as any);

    if (!auth) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    if (!roleOk(auth.role, VIEW_ROLES)) {
      await logWarn({
        req,
        auth,
        category: "API",
        module: "KNIT_PRODUCTION",
        eventType: "KNIT_AREA_LOOKUP_FORBIDDEN",
        message: "User attempted to load knit area lookup without permission",
      });

      return NextResponse.json<Resp>({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await listActiveKnitAreaLookup();
    return NextResponse.json<Resp>({ rows }, { status: 200 });
  } catch (err: any) {
    await logError({
      req,
      auth,
      category: "API",
      module: "KNIT_PRODUCTION",
      eventType: "KNIT_AREA_LOOKUP_ERROR",
      message: "Failed to load knit area lookup",
      error: err,
      details: {
        code: err?.code ?? null,
        detail: err?.detail ?? null,
      },
    });

    return NextResponse.json<Resp>({ error: "Server error" }, { status: 500 });
  }
}