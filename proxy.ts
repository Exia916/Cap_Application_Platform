import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/login/security-questions",

  "/api/auth/login",
  "/api/auth/login/me",
  "/api/auth/logout",

  "/api/auth/security-questions/challenge",
  "/api/auth/security-questions/verify",

  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (/\\.[^/]+$/.test(pathname)) return true;
  return false;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );

  try {
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRole(payload: Record<string, unknown> | null) {
  return String((payload as any)?.role || "").trim().toUpperCase();
}

const CMMS_MASTER_KEYS = new Set([
  "priorities",
  "statuses",
  "issue_catalog",
  "techs",
  "wo_types",
  "cmms_departments",
  "cmms_assets",
]);

const GLOBAL_SEARCH_ALLOWED_ROLES = new Set([
  "ADMIN",
  "SUPERVISOR",
  "MANAGER",
  "CUSTOMER SERVICE",
  "PURCHASING",
  "SALES",
]);

function isCmmsMasterPath(pathname: string) {
  const parts = pathname.split("/");
  const idx = parts.indexOf("master-data");

  if (idx === -1) return false;

  const key = parts[idx + 1];
  return CMMS_MASTER_KEYS.has(key);
}

function isGlobalSearchPath(pathname: string) {
  return (
    pathname === "/admin/global-search" ||
    pathname.startsWith("/api/admin/global-search")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);
  const role = getRole(payload);

  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (isGlobalSearchPath(pathname)) {
      if (!GLOBAL_SEARCH_ALLOWED_ROLES.has(role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      return NextResponse.next();
    }

    const isCmmsMaster = isCmmsMasterPath(pathname);

    if (isCmmsMaster) {
      const allowed = new Set(["ADMIN", "TECH"]);

      if (!allowed.has(role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      return NextResponse.next();
    }

    const MANAGER_ACCESS_ROLES = new Set([
      "ADMIN",
      "MANAGER",
      "SUPERVISOR",
    ]);

    if (!MANAGER_ACCESS_ROLES.has(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/cmms") || pathname.startsWith("/api/cmms")) {
    const allowed = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);

    if (!allowed.has(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};