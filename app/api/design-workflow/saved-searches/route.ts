import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import {
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
  type SearchMethod,
} from "@/lib/repositories/designWorkflowRepo";

const dbQuery = db.query.bind(db);

function normalizeSearchMethod(value: any): SearchMethod {
  return value === "match_any" ? "match_any" : "match_all";
}

export async function GET(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const rows = await listSavedSearches(dbQuery, user.id);
    return NextResponse.json(rows);
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

  if (!body.name || typeof body.name !== "string") {
    return new NextResponse("Missing or invalid name", { status: 400 });
  }

  try {
    const saved = await createSavedSearch(
      dbQuery,
      user.id,
      body.name.trim(),
      normalizeSearchMethod(body.search_method),
      body.search_criteria ?? {},
      body.is_shared === true
    );

    return NextResponse.json(saved, { status: 201 });
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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

  if (!body.id) return new NextResponse("Missing id", { status: 400 });
  if (!body.name || typeof body.name !== "string") {
    return new NextResponse("Missing or invalid name", { status: 400 });
  }

  try {
    const updated = await updateSavedSearch(
      dbQuery,
      Number(body.id),
      user.id,
      body.name.trim(),
      normalizeSearchMethod(body.search_method),
      body.search_criteria ?? {},
      body.is_shared === true
    );

    if (!updated) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = getAuthFromRequest(req);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const idParam = req.nextUrl.searchParams.get("id");
  if (!idParam) {
    return new NextResponse("Missing id", { status: 400 });
  }

  try {
    const deleted = await deleteSavedSearch(dbQuery, Number(idParam), user.id);
    if (!deleted) {
      return new NextResponse("Not found", { status: 404 });
    }
    return NextResponse.json(deleted);
  } catch (err: any) {
    return new NextResponse(err?.message || "Internal Server Error", { status: 500 });
  }
}