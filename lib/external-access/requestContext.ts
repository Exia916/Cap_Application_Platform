import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getAuthUserId,
  getExternalPartnerContextForUserId,
  type ExternalPartnerContext,
} from "@/lib/repositories/externalPartnerRepo";
import { canAccessExternalWorkflow } from "@/lib/external-access/permissions";

export type ExternalWorkflowRequestContext = {
  auth: any;
  userId: string;
  partner: ExternalPartnerContext;
  actorName: string | null;
  employeeNumber: number | null;
};

export type ExternalWorkflowContextResult =
  | { ok: true; context: ExternalWorkflowRequestContext }
  | { ok: false; response: NextResponse };

export type ExternalWorkflowCapability =
  | "canView"
  | "canAssignSelf"
  | "canUpload"
  | "canDownload"
  | "canNote"
  | "canComplete";

function actorNameFromAuth(auth: any): string | null {
  return (
    auth?.name ??
    auth?.displayName ??
    auth?.username ??
    null
  );
}

function employeeNumberFromAuth(auth: any): number | null {
  const raw = auth?.employeeNumber ?? auth?.employee_number ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function hasExternalWorkflowCapability(
  partner: ExternalPartnerContext,
  capability: ExternalWorkflowCapability,
): boolean {
  return (partner.externalModules ?? []).some(
    (module) =>
      module.moduleKey === "design_workflow" &&
      module.isActive !== false &&
      module[capability] === true,
  );
}

export async function requireExternalWorkflowContext(
  req: NextRequest,
): Promise<ExternalWorkflowContextResult> {
  const auth = getAuthFromRequest(req);

  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const userId = getAuthUserId(auth);
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const partner = await getExternalPartnerContextForUserId(userId);

  if (!partner || !canAccessExternalWorkflow(partner.externalModules)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden. External Workflow access is not enabled for this user." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      auth,
      userId,
      partner,
      actorName: actorNameFromAuth(auth),
      employeeNumber: employeeNumberFromAuth(auth),
    },
  };
}

export function requireExternalWorkflowCapability(
  partner: ExternalPartnerContext,
  capability: ExternalWorkflowCapability,
): NextResponse | null {
  if (hasExternalWorkflowCapability(partner, capability)) return null;

  return NextResponse.json(
    { error: "Forbidden. This external partner action is not enabled." },
    { status: 403 },
  );
}
