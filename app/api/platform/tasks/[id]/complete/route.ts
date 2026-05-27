import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { completePlatformTask } from "@/lib/services/platformTaskService";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getAuthFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const task = await completePlatformTask(id, {
    userId: user.id,
    name: user.name,
    role: user.role,
    department: user.department,
  });

  return NextResponse.json({ task });
}