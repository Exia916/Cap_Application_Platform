import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getUserPreferences,
  saveUserPreferences,
} from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, any>,
  incoming: Record<string, any>
): Record<string, any> {
  const result: Record<string, any> = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function resolveUserId(user: any): string {
  return String(user?.id ?? user?.userId ?? user?.username ?? "").trim();
}

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = resolveUserId(user);
  if (!userId) {
    return new NextResponse("Unable to resolve user id", { status: 400 });
  }

  try {
    const prefs = await getUserPreferences(dbQuery, userId);
    return NextResponse.json({
      last_search: prefs?.last_search ?? {},
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load preferences." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userId = resolveUserId(user);
  if (!userId) {
    return new NextResponse("Unable to resolve user id", { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  try {
    const existing = await getUserPreferences(dbQuery, userId);
    const currentPrefs = isPlainObject(existing?.last_search) ? existing.last_search : {};
    const incomingPrefs = isPlainObject(body?.last_search) ? body.last_search : {};

    const mergedPrefs = deepMerge(currentPrefs, incomingPrefs);
    const saved = await saveUserPreferences(dbQuery, userId, mergedPrefs);

    return NextResponse.json({
      ok: true,
      last_search: saved?.last_search ?? mergedPrefs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save preferences." },
      { status: 500 }
    );
  }
}
