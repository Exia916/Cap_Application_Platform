import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { createPlatformTask } from "@/lib/services/platformTaskService";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

export async function POST(req: NextRequest) {
  const user = getAuthFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ALLOWED_ROLES.has(String(user.role ?? "").toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  const assignedToUserId = String(body?.assignedToUserId ?? "").trim();
  const assignedToDisplayName = String(body?.assignedToDisplayName ?? "").trim();

  if (!assignedToUserId) {
    return NextResponse.json(
      { error: "assignedToUserId is required." },
      { status: 400 },
    );
  }

  try {
    const task = await createPlatformTask(
      {
        sourceModule: "debug",
        entityType: "debug_task",
        entityId: crypto.randomUUID(),
        sourceRecordLabel: "Debug Task",
        taskType: "debug_test",
        title: "Debug test task",
        description: "Temporary test task created from debug route.",
        assignedToUserId,
        assignedToDisplayName: assignedToDisplayName || null,
        priority: "normal",
        status: "open",
        metadata: {
          source: "debug-create-test",
        },
      },
      {
        userId: user.id ?? null,
        name: user.name ?? null,
        role: user.role ?? null,
        department: user.department ?? null,
      },
    );

    return NextResponse.json({
      ok: true,
      task,
    });
  } catch (err: any) {
    console.error("debug create test task failed:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to create debug task.",
        stack:
          process.env.NODE_ENV === "production"
            ? undefined
            : err?.stack ?? undefined,
      },
      { status: 500 },
    );
  }
}