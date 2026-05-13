import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import {
  getAccountSecurityQuestions,
  saveAccountSecurityQuestions,
} from "@/lib/services/securityQuestionsService";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

export const runtime = "nodejs";

type SecurityQuestionPostBody = {
  questions?: Array<{
    questionOrder?: number;
    questionPrompt?: string;
    answer?: string;
  }>;
};

function getAuthUserId(auth: any): string | null {
  const id = auth?.id;
  return id != null && String(id).trim() ? String(id).trim() : null;
}

function getAuthDisplayName(auth: any): string | null {
  return (
    String(auth?.displayName ?? auth?.name ?? auth?.username ?? "")
      .trim() || null
  );
}

export async function GET(req: NextRequest) {
  const auth = getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = getAuthUserId(auth);

  if (!userId) {
    return NextResponse.json(
      { error: "Unable to identify authenticated user." },
      { status: 400 }
    );
  }

  try {
    const payload = await getAccountSecurityQuestions(userId);

    return NextResponse.json(
      {
        summary: payload.summary,
        questions: payload.questions,
      },
      { status: 200 }
    );
  } catch (error) {
    await logError({
      req,
      category: "API",
      module: "ACCOUNT",
      eventType: "ACCOUNT_SECURITY_QUESTIONS_LOAD_ERROR",
      message: "Failed to load account security questions",
      auth,
      error,
    });

    return NextResponse.json(
      { error: "Failed to load security questions." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = getAuthFromRequest(req as any);

  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = getAuthUserId(auth);

  if (!userId) {
    return NextResponse.json(
      { error: "Unable to identify authenticated user." },
      { status: 400 }
    );
  }

  try {
    const body = (await req.json().catch(() => null)) as SecurityQuestionPostBody | null;

    if (!body || !Array.isArray(body.questions)) {
      return NextResponse.json(
        { error: "Security questions are required." },
        { status: 400 }
      );
    }

    await saveAccountSecurityQuestions({
      userId,
      updatedBy: getAuthDisplayName(auth),
      questions: body.questions.map((q) => ({
        questionOrder: Number(q.questionOrder),
        questionPrompt: String(q.questionPrompt ?? ""),
        answer: String(q.answer ?? ""),
      })),
    });

    await logSecurityEvent({
      req,
      category: "SECURITY",
      module: "ACCOUNT",
      eventType: "SECURITY_QUESTIONS_UPDATED",
      message: "User updated security questions",
      auth,
      username: auth.username,
      employeeNumber: auth.employeeNumber,
      role: auth.role,
      details: {
        userId,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    await logError({
      req,
      category: "API",
      module: "ACCOUNT",
      eventType: "ACCOUNT_SECURITY_QUESTIONS_SAVE_ERROR",
      message: "Failed to save account security questions",
      auth,
      error,
    });

    return NextResponse.json(
      { error: error?.message || "Failed to save security questions." },
      { status: 500 }
    );
  }
}