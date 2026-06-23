import { NextResponse } from "next/server";
import {
  getAuthUserId,
  isExternalPartnerUserId,
} from "@/lib/repositories/externalPartnerRepo";

export async function rejectExternalUserForInternalApi(auth: unknown) {
  const userId = getAuthUserId(auth);
  const isExternal = await isExternalPartnerUserId(userId);

  if (!isExternal) return null;

  return NextResponse.json(
    {
      error:
        "Forbidden. External partner users must use Partner Work APIs for Workflow access.",
    },
    { status: 403 },
  );
}
