// app/api/admin/master-data/options/[source]/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCmmsMasterKey } from "../../registry";

export const runtime = "nodejs";

type OptionRow = {
  value: string;
  label: string;
};

async function requireMasterDataOptionsAccess(source: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const payload: any = verifyJwt(token);
  if (!payload) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const role = String(payload.role || "").toUpperCase();

  if (role === "ADMIN") {
    return { ok: true as const, payload };
  }

  if (role === "TECH" && isCmmsMasterKey(source)) {
    return { ok: true as const, payload };
  }

  return { ok: false as const, status: 403, error: "Forbidden" };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ source: string }> }
) {
  const { source } = await ctx.params;

  const auth = await requireMasterDataOptionsAccess(source);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    if (source === "cmms_departments") {
      const res = await db.query<OptionRow>(
        `
        SELECT
          id::text AS value,
          name::text AS label
        FROM cmms.departments
        WHERE is_active = true
        ORDER BY name ASC
        `
      );

      return NextResponse.json({ options: res.rows });
    }

    return NextResponse.json(
      { error: "Unknown options source" },
      { status: 404 }
    );
  } catch (err: any) {
    console.error(`GET /api/admin/master-data/options/${source} failed:`, err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to load options"
            : err?.message || "Failed to load options",
      },
      { status: 500 }
    );
  }
}