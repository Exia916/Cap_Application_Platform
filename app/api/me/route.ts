// app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";

type MeResponse = {
  username?: string | null;
  displayName?: string | null;
  employeeNumber?: number | null;
  role?: string | null;
  shift?: string | null;

  // ✅ Needed for Annex auto-check
  department?: string | null;

  error?: string;
};

export async function GET(req: NextRequest) {
  const auth: any = getAuthFromRequest(req);

  if (!auth) {
    return NextResponse.json<MeResponse>({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json<MeResponse>(
    {
      username: auth.username ?? null,
      displayName: auth.displayName ?? null,
      employeeNumber: Number.isFinite(Number(auth.employeeNumber)) ? Number(auth.employeeNumber) : null,
      role: auth.role ?? null,
      shift: auth.shift ?? null,
      department: auth.department ?? null,
    },
    { status: 200 }
  );
}