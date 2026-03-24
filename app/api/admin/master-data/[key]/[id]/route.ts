// app/api/admin/master-data/[key]/[id]/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMasterKey, isCmmsMasterKey, MASTER_DATA, type MasterKey } from "../../registry";

export const runtime = "nodejs";

async function requireMasterDataAccess(key: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return { ok: false as const, status: 401, error: "Unauthorized" };

  const payload: any = verifyJwt(token);
  if (!payload) return { ok: false as const, status: 401, error: "Unauthorized" };

  const role = String(payload.role || "").toUpperCase();

  if (role === "ADMIN") {
    return { ok: true as const, payload };
  }

  if (role === "TECH" && isCmmsMasterKey(key)) {
    return { ok: true as const, payload };
  }

  return { ok: false as const, status: 403, error: "Forbidden" };
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function mapUiBodyToDbFields(key: MasterKey, body: any) {
  const raw = { ...(body || {}) };

  if (key === "knit_areas") {
    if (raw.name !== undefined && raw.area_name === undefined) {
      raw.area_name = raw.name;
    }
    delete raw.name;
  }

  return raw;
}

function pickEditable(key: MasterKey, body: any) {
  const cfg = MASTER_DATA[key];
  const allowed = new Set(cfg.editable as string[]);
  const mappedBody = mapUiBodyToDbFields(key, body);
  const data: Record<string, any> = {};

  for (const k of Object.keys(mappedBody || {})) {
    if (allowed.has(k)) data[k] = mappedBody[k];
  }

  return data;
}

function normalizeCommon(data: Record<string, any>) {
  if (typeof data.code === "string") data.code = data.code.trim().toUpperCase();
  if (typeof data.name === "string") data.name = data.name.trim();
  if (typeof data.label === "string") data.label = data.label.trim();
  if (typeof data.area_name === "string") data.area_name = data.area_name.trim();

  if (typeof data.location === "string") data.location = data.location.trim();
  if (typeof data.emb_type === "string") data.emb_type = data.emb_type.trim();
  if (typeof data.flat_or_3d === "string") data.flat_or_3d = data.flat_or_3d.trim();

  if (typeof data.location_code === "string") data.location_code = data.location_code.trim().toUpperCase();
  if (typeof data.emb_type_code === "string") data.emb_type_code = data.emb_type_code.trim().toUpperCase();
  if (typeof data.flat_or_3d_code === "string") data.flat_or_3d_code = data.flat_or_3d_code.trim().toUpperCase();

  if (typeof data.style_color === "string") data.style_color = data.style_color.trim();
  if (typeof data.item_code === "string") data.item_code = data.item_code.trim().toUpperCase();
  if (typeof data.description === "string") data.description = data.description.trim();
  if (typeof data.department === "string") data.department = data.department.trim();

  if (data.department_id !== undefined && data.department_id !== null && data.department_id !== "") {
    data.department_id = Number(data.department_id);
  }

  if (data.sort_order !== undefined && data.sort_order !== null && data.sort_order !== "") {
    data.sort_order = Number(data.sort_order);
  }

  if (data.start_time !== undefined && data.start_time !== null && data.start_time !== "") {
    data.start_time = String(data.start_time).trim();
  }

  if (data.is_active !== undefined) {
    data.is_active = !!data.is_active;
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ key: string; id: string }> }) {
  const { key, id } = await ctx.params;
  if (!isMasterKey(key)) return bad("Invalid master data key", 404);
  if (!id) return bad("Missing id");

  const auth = await requireMasterDataAccess(key);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const cfg = MASTER_DATA[key];
  const body = (await req.json().catch(() => null)) as any;
  if (!body) return bad("Invalid JSON body");

  const data = pickEditable(key, body);
  normalizeCommon(data);

  const cols = Object.keys(data);
  if (cols.length === 0) return bad("No editable fields provided");

  const sets = cols.map((c, i) => `${c} = $${i + 1}`);
  const args = cols.map((c) => data[c]);

  try {
    const res = await db.query(
      `UPDATE ${cfg.table}
       SET ${sets.join(", ")}
       WHERE ${cfg.idCol} = $${args.length + 1}
       RETURNING ${cfg.idCol}`,
      [...args, id]
    );

    if (res.rowCount === 0) return bad("Row not found", 404);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`PUT /api/admin/master-data/${key}/${id} failed:`, err);

    const msg =
      String(err?.message || "").toLowerCase().includes("duplicate") ||
      String(err?.message || "").toLowerCase().includes("unique")
        ? "That value already exists."
        : process.env.NODE_ENV === "production"
          ? "Failed to update row"
          : err?.message || "Failed to update row";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ key: string; id: string }> }) {
  const { key, id } = await ctx.params;
  if (!isMasterKey(key)) return bad("Invalid master data key", 404);
  if (!id) return bad("Missing id");

  const auth = await requireMasterDataAccess(key);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const cfg = MASTER_DATA[key];

  try {
    if (cfg.supportsInactive) {
      const res = await db.query(
        `UPDATE ${cfg.table}
         SET is_active = false
         WHERE ${cfg.idCol} = $1`,
        [id]
      );

      if (res.rowCount === 0) return bad("Row not found", 404);
      return NextResponse.json({ success: true });
    }

    if (!cfg.allowDelete) {
      return bad("This entry type cannot be deleted from Master Data.", 400);
    }

    const res = await db.query(`DELETE FROM ${cfg.table} WHERE ${cfg.idCol} = $1`, [id]);
    if (res.rowCount === 0) return bad("Row not found", 404);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`DELETE /api/admin/master-data/${key}/${id} failed:`, err);

    const msg =
      String(err?.message || "").toLowerCase().includes("foreign key")
        ? "This entry is already in use and cannot be deleted."
        : process.env.NODE_ENV === "production"
          ? "Failed to delete row"
          : err?.message || "Failed to delete row";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}