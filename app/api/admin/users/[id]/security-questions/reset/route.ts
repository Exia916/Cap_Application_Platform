import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { resetUserSecurityQuestions } from "@/lib/repositories/userAccountRepo";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest) {
  const auth = getAuthFromRequest(req as any);

  if (!auth) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      auth: null,
    };
  }

  const role = String((auth as any).role || "").toUpperCase();

  if (role !== "ADMIN") {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden",
      auth,
    };
  }

  return {
    ok: true as const,
    auth,
  };
}

function displayName(auth: any): string | null {
  return (
    String(auth?.displayName ?? auth?.name ?? auth?.username ?? "")
      .trim() || null
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = requireAdmin(req);

  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { id } = await params;
  const userId = String(id ?? "").trim();

  if (!userId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  try {
    await resetUserSecurityQuestions({
      userId,
      updatedBy: displayName(authResult.auth),
    });

    await logSecurityEvent({
      req,
      category: "SECURITY",
      module: "ADMIN_USERS",
      eventType: "ADMIN_RESET_USER_SECURITY_QUESTIONS",
      message: "Admin reset user security questions",
      auth: authResult.auth,
      username: authResult.auth.username,
      employeeNumber: authResult.auth.employeeNumber,
      role: authResult.auth.role,
      recordType: "users",
      recordId: userId,
      details: {
        targetUserId: userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await logError({
      req,
      category: "API",
      module: "ADMIN_USERS",
      eventType: "ADMIN_RESET_USER_SECURITY_QUESTIONS_ERROR",
      message: "Failed to reset user security questions",
      auth: authResult.auth,
      recordType: "users",
      recordId: userId,
      error,
    });

    return NextResponse.json(
      { error: "Failed to reset security questions." },
      { status: 500 }
    );
  }
}