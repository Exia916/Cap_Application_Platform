// lib/auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserByUsername } from "@/lib/repositories/usersRepo";

export const COOKIE_NAME = "auth_token";
const LEGACY_COOKIE_NAME = "token";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined.");
}

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type AuthUser = {
  id: string;
  username: string;
  name: string; // maps from display_name
  employeeNumber: number;
  role: string;
  shift: string;
  department: string;
};

export type AuthUserWithLegacy = AuthUser & {
  displayName: string;
  userId: string;
};

/* -------------------------------------------------------------------------- */
/*                                   JWT                                      */
/* -------------------------------------------------------------------------- */

function signJwt(payload: AuthUser) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

/**
 * Public helper for issuing a normal CAP auth token after a secondary
 * verification step, such as security questions.
 */
export function signAuthToken(user: AuthUser) {
  return signJwt(user);
}

export function verifyJwt(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

function withLegacyAliases(user: AuthUser): AuthUserWithLegacy {
  return {
    ...user,
    displayName: user.name,
    userId: String(user.employeeNumber),
  };
}

/* -------------------------------------------------------------------------- */
/*                                   LOGIN                                    */
/* -------------------------------------------------------------------------- */

export async function loginUser(username: string, password: string) {
  const user = await getUserByUsername(username);

  if (!user || user.is_active === false) {
    return { error: "Invalid credentials." };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: "Invalid credentials." };
  }

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    name: user.display_name,
    employeeNumber: Number(user.employee_number),
    role: user.role,
    shift: user.shift,
    department: user.department,
  };

  const token = signJwt(authUser);

  return { token, user: authUser };
}

/* -------------------------------------------------------------------------- */
/*                           REQUEST HELPERS                                  */
/* -------------------------------------------------------------------------- */

function getTokenFromRequest(req: NextRequest | NextApiRequest): string | null {
  // --- App Router / NextRequest path ---
  const candidate = (req as NextRequest).cookies;
  if (candidate && typeof (candidate as { get?: unknown }).get === "function") {
    const getter = candidate as { get: (name: string) => { value: string } | undefined };

    // Prefer auth_token, fallback to legacy token
    return getter.get(COOKIE_NAME)?.value ?? getter.get(LEGACY_COOKIE_NAME)?.value ?? null;
  }

  // --- Pages Router / NextApiRequest path ---
  const cookiesObj = (req as NextApiRequest).cookies;
  if (!cookiesObj) return null;

  const primary = cookiesObj[COOKIE_NAME];
  if (typeof primary === "string" && primary.length > 0) return primary;

  const legacy = cookiesObj[LEGACY_COOKIE_NAME];
  if (typeof legacy === "string" && legacy.length > 0) return legacy;

  return null;
}

export function getAuthFromRequest(req: NextRequest | NextApiRequest): AuthUserWithLegacy | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const payload = verifyJwt(token);
  if (!payload) return null;

  return withLegacyAliases(payload);
}

export function requireRole(req: NextRequest | NextApiRequest, roles: string[]) {
  const user = getAuthFromRequest(req);
  if (!user) throw new Error("Unauthorized");
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}

/* -------------------------------------------------------------------------- */
/*                               COOKIE HELPERS                               */
/* -------------------------------------------------------------------------- */

function buildCookie(name: string, token: string, secure: boolean) {
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${
    secure ? "; Secure" : ""
  }`;
}

function buildClearCookie(name: string, secure: boolean) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
    secure ? "; Secure" : ""
  }`;
}

export function setAuthCookie(res: NextApiResponse, token: string) {
  const secure = process.env.NODE_ENV === "production";

  // Set BOTH cookies so any route expecting either name will work
  res.setHeader("Set-Cookie", [
    buildCookie(COOKIE_NAME, token, secure),
    buildCookie(LEGACY_COOKIE_NAME, token, secure),
  ]);
}

export function clearAuthCookie(res: NextApiResponse) {
  const secure = process.env.NODE_ENV === "production";

  // Clear BOTH cookies
  res.setHeader("Set-Cookie", [buildClearCookie(COOKIE_NAME, secure), buildClearCookie(LEGACY_COOKIE_NAME, secure)]);
}