import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/login/me",
  "/api/auth/logout",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (/\.[^/]+$/.test(pathname)) return true; // static assets
  return false;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  try {
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getRole(payload: Record<string, unknown> | null) {
  const r = String((payload as any)?.role || "").trim().toUpperCase();
  return r;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public assets/pages
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Must be logged in for everything else
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = decodeJwtPayload(token);
  const role = getRole(payload);

  // ADMIN-only routes (pages + api)
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!payload || role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // ✅ CMMS routes: ADMIN / MANAGER / SUPERVISOR / TECH
  if (pathname.startsWith("/cmms") || pathname.startsWith("/api/cmms")) {
    const allowed = new Set(["ADMIN", "MANAGER", "SUPERVISOR", "TECH"]);
    if (!payload || !allowed.has(role)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};