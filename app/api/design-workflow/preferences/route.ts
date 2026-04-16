import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getUserPreferences,
  saveUserPreferences,
} from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const prefs = await getUserPreferences(dbQuery, user.id);
    return NextResponse.json(prefs ?? {});
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  try {
    const updated = await saveUserPreferences(dbQuery, user.id, body.last_search ?? {});
    return NextResponse.json(updated);
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}