import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";

type MeResponse = {
  username?: string;
  displayName?: string;
  employeeNumber?: number | null;
  role?: string | null;
  department?: string | null;
  userId?: string | null;
  error?: string;
};

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req as any);
  if (!auth) {
    return NextResponse.json<MeResponse>({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json<MeResponse>(
    {
      username: (auth as any).username ?? null,
      displayName: (auth as any).displayName ?? null,
      employeeNumber:
        (auth as any).employeeNumber != null
          ? Number((auth as any).employeeNumber)
          : (auth as any).userId != null
            ? Number((auth as any).userId)
            : null,
      role: (auth as any).role ?? null,
      department: (auth as any).department ?? null,
      userId:
        (auth as any).userId != null
          ? String((auth as any).userId)
          : (auth as any).sub != null
            ? String((auth as any).sub)
            : null,
    },
    { status: 200 }
  );
}