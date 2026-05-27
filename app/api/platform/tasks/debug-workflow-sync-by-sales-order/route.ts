import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { syncWorkflowTasksForRequest } from "@/lib/services/workflowTaskSyncService";
import { listTasks } from "@/lib/services/platformTaskService";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["ADMIN", "MANAGER", "SUPERVISOR"]);

type WorkflowMatchRow = {
  id: string;
  requestNumber: string | null;
  salesOrderNumber: string | null;
  salesOrderBase: string | null;
  statusId: number | null;
  statusCode: string | null;
  statusLabel: string | null;
  taskAssignmentStage: string | null;
  digitizerUserId: string | null;
  digitizerName: string | null;
  designerUserId: string | null;
  designerName: string | null;
  createdAt: string;
};

async function findWorkflowBySalesOrder(salesOrderNumber: string) {
  const { rows } = await db.query<WorkflowMatchRow>(
    `
    SELECT
      dwr.id::text AS "id",
      dwr.request_number AS "requestNumber",
      dwr.sales_order_number AS "salesOrderNumber",
      dwr.sales_order_base AS "salesOrderBase",
      dwr.status_id AS "statusId",
      s.code AS "statusCode",
      s.label AS "statusLabel",
      COALESCE(s.task_assignment_stage, 'none') AS "taskAssignmentStage",
      dwr.digitizer_user_id AS "digitizerUserId",
      dwr.digitizer_name AS "digitizerName",
      dwr.designer_user_id AS "designerUserId",
      dwr.designer_name AS "designerName",
      dwr.created_at AS "createdAt"
    FROM public.design_workflow_requests dwr
    LEFT JOIN public.design_workflow_statuses s
      ON s.id = dwr.status_id
    WHERE
      dwr.sales_order_number = $1
      OR dwr.sales_order_base = $1
      OR dwr.request_number = $1
      OR dwr.sales_order_number ILIKE $2
      OR dwr.sales_order_base ILIKE $2
      OR dwr.request_number ILIKE $2
    ORDER BY dwr.created_at DESC
    LIMIT 10
    `,
    [salesOrderNumber, `%${salesOrderNumber}%`],
  );

  return rows;
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
  const salesOrderNumber = String(body?.salesOrderNumber ?? "").trim();

  if (!salesOrderNumber) {
    return NextResponse.json(
      { error: "salesOrderNumber is required." },
      { status: 400 },
    );
  }

  try {
    const matches = await findWorkflowBySalesOrder(salesOrderNumber);

    if (!matches.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Workflow request found by that sales order number using the app database connection.",
          salesOrderNumber,
          matches,
        },
        { status: 404 },
      );
    }

    const workflow = matches[0];

    const beforeTasks = await listTasks({
      sourceModule: "design_workflow",
      entityType: "design_workflow_request",
      entityId: workflow.id,
      includeVoided: true,
      page: 1,
      pageSize: 50,
      sortBy: "createdAt",
      sortDir: "desc",
    });

    await syncWorkflowTasksForRequest({
      requestId: workflow.id,
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
      entityId: workflow.id,
      includeVoided: true,
      page: 1,
      pageSize: 50,
      sortBy: "createdAt",
      sortDir: "desc",
    });

    return NextResponse.json({
      ok: true,
      salesOrderNumber,
      selectedWorkflow: workflow,
      allMatches: matches,
      beforeTasks,
      afterTasks,
    });
  } catch (err: any) {
    console.error("debug workflow sync by sales order failed:", err);

    return NextResponse.json(
      {
        ok: false,
        salesOrderNumber,
        error: err?.message || "Failed to sync Workflow task by sales order.",
        stack:
          process.env.NODE_ENV === "production"
            ? undefined
            : err?.stack ?? undefined,
      },
      { status: 500 },
    );
  }
}