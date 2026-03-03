// app/api/lookups/roles/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyJwt(token);
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await db.query(
    `SELECT code, label, sort_order, is_active
     FROM roles_lookup
     WHERE is_active = true
     ORDER BY sort_order ASC, code ASC`
  );

  return NextResponse.json({
    rows: res.rows,
    options: res.rows.map((r) => ({
      value: r.code,
      label: r.label ? r.label : r.code,
    })),
  });
}