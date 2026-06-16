import { NextRequest } from "next/server";
import { handleSetupAccess } from "../_shared";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return handleSetupAccess(req);
}
