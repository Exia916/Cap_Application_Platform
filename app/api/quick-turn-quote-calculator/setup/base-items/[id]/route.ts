import { NextRequest } from "next/server";
import { handleSetupDetail, handleSetupPatchActive, handleSetupUpdate } from "../../_shared";

export const runtime = "nodejs";

const RESOURCE = "base-items" as const;

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: NextRequest, ctx: Ctx) {
  return handleSetupDetail(req, ctx, RESOURCE);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handleSetupUpdate(req, ctx, RESOURCE);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handleSetupPatchActive(req, ctx, RESOURCE);
}
