import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { syncWorkflowTasksForRequest } from "@/lib/services/workflowTaskSyncService";
import { listTasks } from "@/lib/services/platformTaskService";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

type WorkflowDebugRow = {
  id: string;
  requestNumber: string | null;
  salesOrderNumber: string | null;
  statusId: number | null;
  statusCode: string | null;
  statusLabel: string | null;
  taskAssignmentStage: string | null;
  digitizerUserId: string | null;
  digitizerName: string | null;
  digitizerValidUserId: string | null;
  digitizerValidDisplayName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  designerValidUserId: string | null;
  designerValidDisplayName: string | null;
  binCode: string | null;
};

async function getWorkflowDebugRow(requestId: string) {
  const { rows } = await db.query<WorkflowDebugRow>(
    `
    SELECT
      dwr.id::text AS "id",
      dwr.request_number AS "requestNumber",
      dwr.sales_order_number AS "salesOrderNumber",
      dwr.status_id AS "statusId",
      s.code AS "statusCode",
      s.label AS "statusLabel",
      COALESCE(s.task_assignment_stage, 'none') AS "taskAssignmentStage",

      dwr.digitizer_user_id AS "digitizerUserId",
      dwr.digitizer_name AS "digitizerName",
      du.id::text AS "digitizerValidUserId",
      du.display_name AS "digitizerValidDisplayName",

      dwr.designer_user_id AS "designerUserId",
      dwr.designer_name AS "designerName",
      au.id::text AS "designerValidUserId",
      au.display_name AS "designerValidDisplayName",

      dwr.bin_code AS "binCode"
    FROM public.design_workflow_requests dwr
    LEFT JOIN public.design_workflow_statuses s
      ON s.id = dwr.status_id
    LEFT JOIN public.users du
      ON du.id::text = dwr.digitizer_user_id
    LEFT JOIN public.users au
      ON au.id::text = dwr.designer_user_id
    WHERE dwr.id = $1
    LIMIT 1
    `,
    [requestId],
  );

  return rows[0] ?? null;
}

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

  const beforeDebug = await getWorkflowDebugRow(requestId);

  if (!beforeDebug) {
    return NextResponse.json(
      {
        error: "Workflow request was not found.",
        requestId,
      },
      { status: 404 },
    );
  }

  const beforeTasks = await listTasks({
    sourceModule: "design_workflow",
    entityType: "design_workflow_request",
    entityId: requestId,
    includeVoided: true,
    page: 1,
    pageSize: 50,
    sortBy: "createdAt",
    sortDir: "desc",
  });

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

    const afterTasks = await listTasks({
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
      workflow: beforeDebug,
      beforeTasks,
      afterTasks,
      expectedBehavior:
        beforeDebug.taskAssignmentStage === "design"
          ? "Should create or maintain a workflow_design task assigned to designer_user_id."
          : beforeDebug.taskAssignmentStage === "digitizing"
            ? "Should create or maintain a workflow_digitizing task assigned to digitizer_user_id."
            : "No task should be created because task_assignment_stage is none.",
    });
  } catch (err: any) {
    console.error("debug workflow sync failed:", err);

    return NextResponse.json(
      {
        ok: false,
        requestId,
        workflow: beforeDebug,
        beforeTasks,
        error: err?.message || "Workflow task sync failed.",
        stack:
          process.env.NODE_ENV === "production"
            ? undefined
            : err?.stack ?? undefined,
      },
      { status: 500 },
    );
  }
}