import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyJwt(token);
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function normRole(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function normEmail(v: any): string | null {
  const email = String(v ?? "").trim().toLowerCase();
  return email || null;
}

function normNullableUuid(v: any): string | null {
  const value = String(v ?? "").trim();
  return value || null;
}

function normBool(v: any, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1" || v === 1) return true;
  if (v === "false" || v === "0" || v === 0) return false;
  return fallback;
}

function isValidEmail(email: string | null): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function userUniqueMessage(err: any, fallback: string) {
  const constraint = String(err?.constraint || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();

  if (constraint.includes("email") || message.includes("email")) {
    return "That email is already assigned to another user.";
  }

  if (message.includes("duplicate") || message.includes("unique")) {
    return "That username already exists.";
  }

  return process.env.NODE_ENV === "production"
    ? fallback
    : err?.message || fallback;
}

async function requireAdmin() {
  const payload: any = await getAuth();
  if (!payload) return { ok: false as const, status: 401, error: "Unauthorized" };

  const role = String(payload.role || "").toUpperCase();
  if (role !== "ADMIN") return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const, payload };
}

async function validateManagerUser(managerUserId: string | null, selfUserId?: string) {
  if (!managerUserId) return null;

  if (selfUserId && managerUserId === selfUserId) {
    return "A user cannot be assigned as their own manager.";
  }

  const check = await db.query(
    `
    SELECT 1
    FROM public.users
    WHERE id = $1
      AND is_active = true
    LIMIT 1
    `,
    [managerUserId]
  );

  if (check.rowCount === 0) {
    return "Selected manager was not found or is inactive.";
  }

  return null;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const res = await db.query(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.display_name,
        u.name,
        u.employee_number,
        u.role,
        u.is_active,
        u.shift,
        u.department,
        u.created_at,
        u.updated_at,

        COALESCE(u.email_notifications_enabled, true) AS "emailNotificationsEnabled",
        COALESCE(u.in_app_notifications_enabled, true) AS "inAppNotificationsEnabled",
        u.manager_user_id AS "managerUserId",
        mgr.display_name AS "managerDisplayName",
        mgr.username AS "managerUsername",
        u.last_login_at AS "lastLoginAt",
        u.updated_by AS "updatedBy",
        ub.display_name AS "updatedByDisplayName",

        COALESCE(sq.question_count, 0)::int AS "securityQuestionsCount",
        u.security_questions_enrolled_at AS "securityQuestionsEnrolledAt",
        COALESCE(u.security_questions_required, false) AS "securityQuestionsRequired",
        u.offsite_security_bypass_until AS "offsiteSecurityBypassUntil"
      FROM public.users u
      LEFT JOIN public.users mgr ON mgr.id = u.manager_user_id
      LEFT JOIN public.users ub ON ub.id = u.updated_by
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*) AS question_count
        FROM public.user_security_questions
        GROUP BY user_id
      ) sq ON sq.user_id = u.id
      ORDER BY u.username ASC
    `);

    return NextResponse.json({ users: res.rows });
  } catch (err) {
    console.error("GET /api/admin/users failed:", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as any;
  if (!body) return bad("Invalid JSON body");

  const username = String(body.username ?? "").trim();
  const email = normEmail(body.email);
  const password = String(body.password ?? "");
  const display_name = String(body.display_name ?? "").trim();
  const name = String(body.name ?? "").trim();
  const role = normRole(body.role);
  const shift = String(body.shift ?? "").trim() || null;
  const department = String(body.department ?? "").trim() || null;
  const is_active = body.is_active === false ? false : true;

  const email_notifications_enabled = normBool(body.email_notifications_enabled, true);
  const in_app_notifications_enabled = normBool(body.in_app_notifications_enabled, true);
  const manager_user_id = normNullableUuid(body.manager_user_id);

  const employee_number =
    body.employee_number === null || body.employee_number === undefined || body.employee_number === ""
      ? null
      : Number(body.employee_number);

  if (!username) return bad("Username is required");
  if (!password) return bad("Password is required");
  if (!role) return bad("Role is required");
  if (!isValidEmail(email)) return bad("Email is invalid");

  if (employee_number !== null && !Number.isFinite(employee_number)) {
    return bad("Employee # must be a number");
  }

  try {
    const roleCheck = await db.query(`SELECT 1 FROM public.roles_lookup WHERE code = $1`, [role]);
    if (roleCheck.rowCount === 0) return bad(`Invalid role: ${role}`, 400);

    const managerError = await validateManagerUser(manager_user_id);
    if (managerError) return bad(managerError);

    const password_hash = await bcrypt.hash(password, 10);

    const res = await db.query(
      `
      INSERT INTO public.users (
        username,
        email,
        password_hash,
        display_name,
        name,
        employee_number,
        role,
        shift,
        department,
        is_active,
        email_notifications_enabled,
        in_app_notifications_enabled,
        manager_user_id,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING
        id,
        username,
        email,
        display_name,
        name,
        employee_number,
        role,
        shift,
        department,
        is_active,
        email_notifications_enabled AS "emailNotificationsEnabled",
        in_app_notifications_enabled AS "inAppNotificationsEnabled",
        manager_user_id AS "managerUserId",
        last_login_at AS "lastLoginAt",
        created_at,
        updated_at
      `,
      [
        username,
        email,
        password_hash,
        display_name || null,
        name || null,
        employee_number,
        role,
        shift,
        department,
        is_active,
        email_notifications_enabled,
        in_app_notifications_enabled,
        manager_user_id,
        (auth.payload as any).id ?? null,
      ]
    );

    return NextResponse.json({ user: res.rows[0] });
  } catch (err: any) {
    console.error("POST /api/admin/users failed:", err);

    const msg = userUniqueMessage(err, "Failed to create user");

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as any;
  if (!body) return bad("Invalid JSON body");

  const id = String(body.id ?? "").trim();
  if (!id) return bad("Missing id");

  const username = String(body.username ?? "").trim();
  const email = normEmail(body.email);
  const display_name = String(body.display_name ?? "").trim();
  const name = String(body.name ?? "").trim();
  const role = normRole(body.role);
  const shift = String(body.shift ?? "").trim() || null;
  const department = String(body.department ?? "").trim() || null;
  const is_active = body.is_active === false ? false : true;

  const email_notifications_enabled = normBool(body.email_notifications_enabled, true);
  const in_app_notifications_enabled = normBool(body.in_app_notifications_enabled, true);
  const manager_user_id = normNullableUuid(body.manager_user_id);

  const employee_number =
    body.employee_number === null || body.employee_number === undefined || body.employee_number === ""
      ? null
      : Number(body.employee_number);

  const new_password = String(body.new_password ?? "").trim();

  if (!username) return bad("Username is required");
  if (!role) return bad("Role is required");
  if (!isValidEmail(email)) return bad("Email is invalid");

  if (employee_number !== null && !Number.isFinite(employee_number)) {
    return bad("Employee # must be a number");
  }

  try {
    const roleCheck = await db.query(`SELECT 1 FROM public.roles_lookup WHERE code = $1`, [role]);
    if (roleCheck.rowCount === 0) return bad(`Invalid role: ${role}`, 400);

    const managerError = await validateManagerUser(manager_user_id, id);
    if (managerError) return bad(managerError);

    const fields: string[] = [];
    const args: any[] = [];
    let i = 1;

    fields.push(`username = $${i++}`); args.push(username);
    fields.push(`email = $${i++}`); args.push(email);
    fields.push(`display_name = $${i++}`); args.push(display_name || null);
    fields.push(`name = $${i++}`); args.push(name || null);
    fields.push(`employee_number = $${i++}`); args.push(employee_number);
    fields.push(`role = $${i++}`); args.push(role);
    fields.push(`shift = $${i++}`); args.push(shift);
    fields.push(`department = $${i++}`); args.push(department);
    fields.push(`is_active = $${i++}`); args.push(is_active);
    fields.push(`email_notifications_enabled = $${i++}`); args.push(email_notifications_enabled);
    fields.push(`in_app_notifications_enabled = $${i++}`); args.push(in_app_notifications_enabled);
    fields.push(`manager_user_id = $${i++}`); args.push(manager_user_id);
    fields.push(`updated_by = $${i++}`); args.push((auth.payload as any).id ?? null);

    if (new_password) {
      const password_hash = await bcrypt.hash(new_password, 10);
      fields.push(`password_hash = $${i++}`);
      args.push(password_hash);
    }

    fields.push(`updated_at = NOW()`);

    const res = await db.query(
      `
      UPDATE public.users
      SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING
        id,
        username,
        email,
        display_name,
        name,
        employee_number,
        role,
        shift,
        department,
        is_active,
        email_notifications_enabled AS "emailNotificationsEnabled",
        in_app_notifications_enabled AS "inAppNotificationsEnabled",
        manager_user_id AS "managerUserId",
        last_login_at AS "lastLoginAt",
        created_at,
        updated_at
      `,
      [...args, id]
    );

    if (res.rowCount === 0) return bad("User not found", 404);

    return NextResponse.json({ user: res.rows[0] });
  } catch (err: any) {
    console.error("PUT /api/admin/users failed:", err);

    const msg = userUniqueMessage(err, "Failed to update user");

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}