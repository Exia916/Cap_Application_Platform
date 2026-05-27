import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { syncWorkflowTasksForRequest } from "@/lib/services/workflowTaskSyncService";
import { listTasks } from "@/lib/services/platformTaskService";

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
  const requestId = String(body?.requestId ?? "").trim();

  if (!requestId) {
    return NextResponse.json(
      { error: "requestId is required." },
      { status: 400 },
    );
  }

  try {
    await syncWorkflowTasksForRequest({
      requestId,
      actor: {
        userId: user.id ?? null,
        name: user.name ?? null,
        role: user.role ?? null,
        department: user.department ?? null,
      },
    });

    const tasks = await listTasks({
      sourceModule: "design_workflow",
      entityType: "design_workflow_request",
      entityId: requestId,
      includeVoided: true,
      page: 1,
      pageSize: 50,
      sortBy: "createdAt",
      sortDir: "desc",
    });

    return NextResponse.json({
      ok: true,
      requestId,
      tasks,
    });
  } catch (err: any) {
    console.error("POST /api/platform/tasks/sync-workflow failed:", err);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to sync Workflow tasks."
            : err?.message || "Failed to sync Workflow tasks.",
      },
      { status: 500 },
    );
  }
}