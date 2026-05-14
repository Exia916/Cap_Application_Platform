import { NextRequest, NextResponse } from "next/server";
import { listUserSecurityQuestions } from "@/lib/repositories/userAccountRepo";
import {
  clearSecurityQuestionChallengeCookie,
  getSecurityQuestionChallengeFromRequest,
} from "@/lib/auth/securityQuestionTokens";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const challenge = getSecurityQuestionChallengeFromRequest(req);

  if (!challenge) {
    const res = NextResponse.json(
      { error: "Security verification session expired. Please sign in again." },
      { status: 401 }
    );
    clearSecurityQuestionChallengeCookie(res);
    return res;
  }

  try {
    const allQuestions = await listUserSecurityQuestions(challenge.user.id);

    const selectedQuestions = challenge.questionIds
      .map((id) => allQuestions.find((q) => q.id === id))
      .filter(Boolean)
      .map((q) => ({
        id: q!.id,
        questionOrder: q!.questionOrder,
        questionPrompt: q!.questionPrompt,
      }));

    if (selectedQuestions.length !== 2) {
      await logSecurityEvent({
        req,
        category: "SECURITY",
        module: "AUTH",
        eventType: "SECURITY_QUESTIONS_CHALLENGE_INVALID",
        message: "Security question challenge referenced missing questions",
        username: challenge.user.username,
        employeeNumber: challenge.user.employeeNumber,
        role: challenge.user.role,
        details: {
          userId: challenge.user.id,
          expectedQuestionIds: challenge.questionIds,
          selectedQuestionCount: selectedQuestions.length,
        },
      });

      const res = NextResponse.json(
        { error: "Security verification session is invalid. Please sign in again." },
        { status: 401 }
      );
      clearSecurityQuestionChallengeCookie(res);
      return res;
    }

    return NextResponse.json(
      {
        user: {
          username: challenge.user.username,
          displayName: challenge.user.name,
        },
        attemptsRemaining: challenge.attemptsRemaining,
        questions: selectedQuestions,
      },
      { status: 200 }
    );
  } catch (error) {
    await logError({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "SECURITY_QUESTIONS_CHALLENGE_LOAD_ERROR",
      message: "Failed to load security question challenge",
      username: challenge.user.username,
      employeeNumber: challenge.user.employeeNumber,
      role: challenge.user.role,
      error,
    });

    return NextResponse.json(
      { error: "Failed to load security questions." },
      { status: 500 }
    );
  }
}