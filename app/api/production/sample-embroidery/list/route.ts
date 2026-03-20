import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { listSampleEmbroideryEntriesRange } from "@/lib/repositories/sampleEmbroideryRepo";

type Resp =
  | {
      entries: any[];
      totalCount: number;
      limit: number;
      offset: number;
    }
  | { error: string };

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

function ymdChicago(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

const ALLOWED_SORT = new Set([
  "entryTs",
  "entryDate",
  "name",
  "salesOrder",
  "detailCount",
  "quantity",
]);

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyJwt(token);
    if (!payload) {
      return NextResponse.json<Resp>({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;

    const rawFrom = sp.get("entryDateFrom")?.trim() ?? "";
    const rawTo = sp.get("entryDateTo")?.trim() ?? "";

    const today = ymdChicago(new Date());
    const d = new Date();
    d.setDate(d.getDate() - 29);
    const defaultFrom = ymdChicago(d);

    const entryDateFrom = rawFrom || defaultFrom;
    const entryDateTo = rawTo || today;

    if (!isValidDate(entryDateFrom) || !isValidDate(entryDateTo)) {
      return NextResponse.json<Resp>(
        { error: "Missing or invalid entryDateFrom/entryDateTo (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const limit = clampInt(sp.get("limit"), 25, 1, 200);
    const offset = clampInt(sp.get("offset"), 0, 0, 1_000_000);

    const sortByRaw = sp.get("sortBy")?.trim() || "entryTs";
    const sortBy = (ALLOWED_SORT.has(sortByRaw) ? sortByRaw : "entryTs") as
      | "entryTs"
      | "entryDate"
      | "name"
      | "salesOrder"
      | "detailCount"
      | "quantity";

    const sortDir =
      (sp.get("sortDir")?.trim() || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const name = sp.get("name")?.trim() ?? "";
    const notes = sp.get("notes")?.trim() ?? "";
    const salesOrderStartsWith = sp.get("salesOrder")?.trim() ?? "";
    const detailCount = sp.get("detailCount")?.trim() ?? "";
    const quantity = sp.get("quantity")?.trim() ?? "";

    const result = await listSampleEmbroideryEntriesRange({
      entryDateFrom,
      entryDateTo,
      employeeNumber:
        payload.employeeNumber != null ? Number(payload.employeeNumber) : undefined,
      usernameNameFallback: payload.username ?? "",
      role: String(payload.role ?? ""),
      name,
      salesOrderStartsWith,
      notes,
      detailCount,
      quantity,
      sortBy,
      sortDir,
      limit,
      offset,
    });

    return NextResponse.json<Resp>(
      {
        entries: result.rows,
        totalCount: result.totalCount,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("sample-embroidery list GET error:", err);
    return NextResponse.json<Resp>(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}