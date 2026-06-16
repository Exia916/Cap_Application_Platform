import { NextRequest } from "next/server";
import { handleSetupCreate, handleSetupList } from "../_shared";

export const runtime = "nodejs";

const RESOURCE = "calculator-breaks" as const;

export async function GET(req: NextRequest) {
  return handleSetupList(req, RESOURCE);
}

export async function POST(req: NextRequest) {
  return handleSetupCreate(req, RESOURCE);
}
