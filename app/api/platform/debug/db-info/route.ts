import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const { rows } = await db.query<{
    databaseName: string;
    databaseUser: string;
    serverIp: string | null;
    serverPort: number | null;
    currentSchema: string;
    workflowCount: number;
    latestWorkflowSalesOrder: string | null;
    latestWorkflowCreatedAt: string | null;
  }>(
    `
    SELECT
      current_database() AS "databaseName",
      current_user AS "databaseUser",
      inet_server_addr()::text AS "serverIp",
      inet_server_port() AS "serverPort",
      current_schema() AS "currentSchema",
      (SELECT COUNT(*)::int FROM public.design_workflow_requests) AS "workflowCount",
      (
        SELECT sales_order_number
        FROM public.design_workflow_requests
        ORDER BY created_at DESC
        LIMIT 1
      ) AS "latestWorkflowSalesOrder",
      (
        SELECT created_at::text
        FROM public.design_workflow_requests
        ORDER BY created_at DESC
        LIMIT 1
      ) AS "latestWorkflowCreatedAt"
    `
  );

  return NextResponse.json(rows[0]);
}