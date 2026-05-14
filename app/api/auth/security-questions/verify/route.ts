import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, signAuthToken } from "@/lib/auth";
import { normalizeSecurityAnswer } from "@/lib/services/securityQuestionsService";
import { listUserSecurityQuestionsWithHashes } from "@/lib/repositories/userAccountRepo";
import {
  clearSecurityQuestionChallengeCookie,
  createSecurityQuestionChallengeToken,
  getSecurityQuestionChallengeFromRequest,
  setSecurityQuestionChallengeCookie,
} from "@/lib/auth/securityQuestionTokens";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

export const runtime = "nodejs";

type VerifyBody = {
  answers?: Array<{
    questionId?: string;
    answer?: string;
  }>;
};

export async function POST(req: NextRequest) {
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
    const body = (await req.json().catch(() => null)) as VerifyBody | null;
    const answers = Array.isArray(body?.answers) ? body!.answers : [];

    if (answers.length !== 2) {
      return NextResponse.json(
        { error: "Two security answers are required." },
        { status: 400 }
      );
    }

    const answersByQuestionId = new Map<string, string>();

    for (const answer of answers) {
      const questionId = String(answer?.questionId ?? "").trim();
      const value = String(answer?.answer ?? "");

      if (questionId) {
        answersByQuestionId.set(questionId, value);
      }
    }

    const questionRows = await listUserSecurityQuestionsWithHashes(challenge.user.id);

    const selectedRows = challenge.questionIds
      .map((id) => questionRows.find((q) => q.id === id))
      .filter(Boolean);

    if (selectedRows.length !== 2) {
      await logSecurityEvent({
        req,
        category: "SECURITY",
        module: "AUTH",
        eventType: "SECURITY_QUESTIONS_VERIFY_INVALID",
        message: "Security question verification referenced missing questions",
        username: challenge.user.username,
        employeeNumber: challenge.user.employeeNumber,
        role: challenge.user.role,
        details: {
          userId: challenge.user.id,
          expectedQuestionIds: challenge.questionIds,
          selectedQuestionCount: selectedRows.length,
        },
      });

      const res = NextResponse.json(
        { error: "Security verification session is invalid. Please sign in again." },
        { status: 401 }
      );
      clearSecurityQuestionChallengeCookie(res);
      return res;
    }

    const results = await Promise.all(
      selectedRows.map(async (row) => {
        const suppliedAnswer = answersByQuestionId.get(row!.id) ?? "";
        const normalized = normalizeSecurityAnswer(suppliedAnswer);

        if (!normalized) return false;

        return bcrypt.compare(normalized, row!.answerHash);
      })
    );

    const allCorrect = results.every(Boolean);

    if (!allCorrect) {
      const attemptsRemaining = Math.max(0, challenge.attemptsRemaining - 1);

      await logSecurityEvent({
        req,
        category: "SECURITY",
        module: "AUTH",
        eventType: "SECURITY_QUESTIONS_VERIFY_FAILED",
        message: "Security question verification failed",
        username: challenge.user.username,
        employeeNumber: challenge.user.employeeNumber,
        role: challenge.user.role,
        details: {
          userId: challenge.user.id,
          attemptsRemaining,
        },
      });

      if (attemptsRemaining <= 0) {
        const res = NextResponse.json(
          {
            error:
              "Security verification failed too many times. Please sign in again or contact IT.",
            attemptsRemaining: 0,
          },
          { status: 401 }
        );

        clearSecurityQuestionChallengeCookie(res);
        return res;
      }

      const nextChallengeToken = createSecurityQuestionChallengeToken({
        user: challenge.user,
        questionIds: challenge.questionIds,
        attemptsRemaining,
      });

      const res = NextResponse.json(
        {
          error: `One or more answers were incorrect. Attempts remaining: ${attemptsRemaining}.`,
          attemptsRemaining,
        },
        { status: 401 }
      );

      setSecurityQuestionChallengeCookie(res, nextChallengeToken);
      return res;
    }

    const authToken = signAuthToken(challenge.user);

    await logSecurityEvent({
      req,
      category: "SECURITY",
      module: "AUTH",
      eventType: "SECURITY_QUESTIONS_VERIFY_SUCCESS",
      message: "Security question verification succeeded",
      username: challenge.user.username,
      employeeNumber: challenge.user.employeeNumber,
      role: challenge.user.role,
      details: {
        userId: challenge.user.id,
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        user: challenge.user,
      },
      { status: 200 }
    );

    clearSecurityQuestionChallengeCookie(res);

    res.cookies.set(COOKIE_NAME, authToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (error) {
    await logError({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "SECURITY_QUESTIONS_VERIFY_ERROR",
      message: "Security question verification failed unexpectedly",
      username: challenge.user.username,
      employeeNumber: challenge.user.employeeNumber,
      role: challenge.user.role,
      error,
    });

    return NextResponse.json(
      { error: "Security verification failed." },
      { status: 500 }
    );
  }
}