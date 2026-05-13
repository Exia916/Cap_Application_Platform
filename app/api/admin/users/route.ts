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

        COALESCE(sq.question_count, 0)::int AS "securityQuestionsCount",
        u.security_questions_enrolled_at AS "securityQuestionsEnrolledAt",
        COALESCE(u.security_questions_required, false) AS "securityQuestionsRequired",
        u.offsite_security_bypass_until AS "offsiteSecurityBypassUntil"
      FROM public.users u
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
  const employee_number =
    body.employee_number === null || body.employee_number === undefined || body.employee_number === ""
      ? null
      : Number(body.employee_number);

  if (!username) return bad("Username is required");
  if (!password) return bad("Password is required");
  if (!role) return bad("Role is required");
  if (!isValidEmail(email)) return bad("Email is invalid");

  try {
    const roleCheck = await db.query(`SELECT 1 FROM roles_lookup WHERE code = $1`, [role]);
    if (roleCheck.rowCount === 0) return bad(`Invalid role: ${role}`, 400);

    const password_hash = await bcrypt.hash(password, 10);

    const res = await db.query(
      `
      INSERT INTO users
        (username, email, password_hash, display_name, name, employee_number, role, shift, department, is_active, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING
        id, username, email, display_name, name, employee_number, role, shift, department, is_active, created_at, updated_at
      `,
      [username, email, password_hash, display_name || null, name || null, employee_number, role, shift, department, is_active]
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
  const employee_number =
    body.employee_number === null || body.employee_number === undefined || body.employee_number === ""
      ? null
      : Number(body.employee_number);

  const new_password = String(body.new_password ?? "").trim();

  if (!username) return bad("Username is required");
  if (!role) return bad("Role is required");
  if (!isValidEmail(email)) return bad("Email is invalid");

  try {
    const roleCheck = await db.query(`SELECT 1 FROM roles_lookup WHERE code = $1`, [role]);
    if (roleCheck.rowCount === 0) return bad(`Invalid role: ${role}`, 400);

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

    if (new_password) {
      const password_hash = await bcrypt.hash(new_password, 10);
      fields.push(`password_hash = $${i++}`);
      args.push(password_hash);
    }

    fields.push(`updated_at = NOW()`);

    const res = await db.query(
      `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING
        id, username, email, display_name, name, employee_number, role, shift, department, is_active, created_at, updated_at
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