import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireExternalWorkflowContext } from "@/lib/external-access/requestContext";
import { getPartnerVisibleWorkflowRequestById } from "@/lib/repositories/designWorkflowExternalRepo";

const dbQuery = db.query.bind(db);

function getModuleCapability(
  modules: Array<{
    moduleKey?: string | null;
    canAssignSelf?: boolean | null;
    canUpload?: boolean | null;
    canDownload?: boolean | null;
    canNote?: boolean | null;
    canComplete?: boolean | null;
    isActive?: boolean | null;
  }>,
  capability:
    | "canAssignSelf"
    | "canUpload"
    | "canDownload"
    | "canNote"
    | "canComplete",
): boolean {
  return modules.some(
    (module) =>
      module.moduleKey === "design_workflow" &&
      module.isActive !== false &&
      module[capability] === true,
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireExternalWorkflowContext(req);
  if (!access.ok) return access.response;

  const { id } = await context.params;

  try {
    const record = await getPartnerVisibleWorkflowRequestById(
      dbQuery,
      access.context.partner,
      id,
    );

    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const modules = access.context.partner.externalModules ?? [];

    return NextResponse.json({
      record,
      partner: {
        id: access.context.partner.externalPartnerId,
        code: access.context.partner.externalPartnerCode,
        name: access.context.partner.externalPartnerName,
        type: access.context.partner.externalPartnerType,
        role: access.context.partner.externalRole,
      },
      capabilities: {
        canAssignSelf: getModuleCapability(modules, "canAssignSelf"),
        canUpload: getModuleCapability(modules, "canUpload"),
        canDownload: getModuleCapability(modules, "canDownload"),
        canNote: getModuleCapability(modules, "canNote"),
        canComplete: getModuleCapability(modules, "canComplete"),
      },
    });
  } catch (err: any) {
    console.error("GET /api/partner-work/workflow/[id] failed:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to load partner Workflow record." },
      { status: 500 },
    );
  }
}
