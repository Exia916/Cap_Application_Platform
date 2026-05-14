import { NextRequest, NextResponse } from "next/server";
import { loginUser, COOKIE_NAME } from "@/lib/auth";
import { logError, logSecurityEvent } from "@/lib/logging/logger";
import {
  assessNetworkAccess,
  getOffsiteSecurityQuestionsMode,
} from "@/lib/auth/networkAccess";
import {
  getUserSecurityQuestionSummary,
  listUserSecurityQuestions,
} from "@/lib/repositories/userAccountRepo";
import {
  clearSecurityQuestionChallengeCookie,
  createSecurityQuestionChallengeToken,
  setSecurityQuestionChallengeCookie,
} from "@/lib/auth/securityQuestionTokens";

function hasActiveBypass(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function pickTwoQuestionIds(rows: Array<{ id: string }>) {
  const shuffled = rows
    .slice()
    .sort(() => Math.random() - 0.5);

  return shuffled.slice(0, 2).map((row) => row.id);
}

function shouldForceChallengeForTesting() {
  return String(process.env.OFFSITE_SECURITY_QUESTIONS_FORCE_CHALLENGE ?? "")
    .trim()
    .toLowerCase() === "true";
}

export async function POST(req: NextRequest) {
  let username = "";

  try {
    const body = await req.json();
    username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      await logSecurityEvent({
        req,
        category: "AUTH",
        module: "AUTH",
        eventType: "LOGIN_MISSING_CREDENTIALS",
        message: "Login attempt rejected due to missing credentials",
        username: username || null,
        details: {
          hasUsername: Boolean(username),
          hasPassword: Boolean(password),
        },
      });

      return NextResponse.json(
        { error: "Username and password required." },
        { status: 400 }
      );
    }

    const result = await loginUser(username, password);

    if ("error" in result) {
      await logSecurityEvent({
        req,
        category: "AUTH",
        module: "AUTH",
        eventType: "LOGIN_FAILED",
        message: "Invalid username or password",
        username,
        details: {
          reason: "INVALID_CREDENTIALS",
        },
      });

      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    const { token, user } = result;

    await logSecurityEvent({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGIN_SUCCESS",
      message: "User login succeeded",
      username: user.username,
      employeeNumber: user.employeeNumber,
      role: user.role,
      details: {
        displayName: user.name,
        userId: user.id,
        shift: user.shift,
        department: user.department,
      },
    });

    const networkAccess = assessNetworkAccess(req);
    const securityQuestionsMode = getOffsiteSecurityQuestionsMode();

    const securityQuestionSummary = await getUserSecurityQuestionSummary(user.id);
    const securityQuestionsCount = Number(
      securityQuestionSummary?.questionCount ?? 0
    );
    const securityQuestionsEnrolled = securityQuestionsCount >= 3;
    const bypassActive = hasActiveBypass(
      securityQuestionSummary?.offsiteSecurityBypassUntil ?? null
    );
    const forceChallengeForTesting = shouldForceChallengeForTesting();

    await logSecurityEvent({
      req,
      category: "SECURITY",
      module: "AUTH",
      eventType: "LOGIN_SECURITY_QUESTIONS_AUDIT",
      message: "Security questions audit check completed during login",
      username: user.username,
      employeeNumber: user.employeeNumber,
      role: user.role,
      details: {
        mode: securityQuestionsMode,
        userId: user.id,
        displayName: user.name,
        department: user.department,
        clientIp: networkAccess.clientIp,
        accessType: networkAccess.accessType,
        isOnsite: networkAccess.isOnsite,
        isOffsite: networkAccess.isOffsite,
        matchedRule: networkAccess.matchedRule,
        networkReason: networkAccess.reason,
        configuredRuleCount: networkAccess.configuredRules.length,
        securityQuestionsEnrolled,
        securityQuestionsCount,
        securityQuestionsEnrolledAt:
          securityQuestionSummary?.securityQuestionsEnrolledAt ?? null,
        securityQuestionsRequired:
          securityQuestionSummary?.securityQuestionsRequired ?? false,
        offsiteSecurityBypassUntil:
          securityQuestionSummary?.offsiteSecurityBypassUntil ?? null,
        bypassActive,
        forceChallengeForTesting,
      },
    });

    const shouldChallenge =
      securityQuestionsMode === "enforce" &&
      !bypassActive &&
      securityQuestionsEnrolled &&
      (networkAccess.isOffsite || forceChallengeForTesting);

    if (shouldChallenge) {
      const questions = await listUserSecurityQuestions(user.id);
      const questionIds = pickTwoQuestionIds(questions);

      if (questionIds.length < 2) {
        await logSecurityEvent({
          req,
          category: "SECURITY",
          module: "AUTH",
          eventType: "LOGIN_SECURITY_QUESTIONS_CHALLENGE_UNAVAILABLE",
          message: "Security question challenge could not be created",
          username: user.username,
          employeeNumber: user.employeeNumber,
          role: user.role,
          details: {
            userId: user.id,
            availableQuestionCount: questions.length,
          },
        });

        return NextResponse.json(
          {
            error:
              "Offsite access requires security questions, but your questions are not fully set up. Please contact IT.",
            requiresSecurityQuestionSetup: true,
          },
          { status: 403 }
        );
      }

      const challengeToken = createSecurityQuestionChallengeToken({
        user,
        questionIds,
        attemptsRemaining: 5,
      });

      await logSecurityEvent({
        req,
        category: "SECURITY",
        module: "AUTH",
        eventType: "LOGIN_SECURITY_QUESTIONS_CHALLENGE_REQUIRED",
        message: "Security question challenge required before login completion",
        username: user.username,
        employeeNumber: user.employeeNumber,
        role: user.role,
        details: {
          userId: user.id,
          questionCount: questions.length,
          selectedQuestionCount: questionIds.length,
          clientIp: networkAccess.clientIp,
          accessType: networkAccess.accessType,
          forceChallengeForTesting,
        },
      });

      const res = NextResponse.json(
        {
          success: false,
          requiresSecurityQuestions: true,
          redirectTo: "/login/security-questions",
        },
        { status: 200 }
      );

      setSecurityQuestionChallengeCookie(res, challengeToken);
      return res;
    }

    if (
      securityQuestionsMode === "enforce" &&
      !bypassActive &&
      !securityQuestionsEnrolled &&
      networkAccess.isOffsite
    ) {
      await logSecurityEvent({
        req,
        category: "SECURITY",
        module: "AUTH",
        eventType: "LOGIN_SECURITY_QUESTIONS_NOT_ENROLLED",
        message: "Offsite login blocked because security questions are not set up",
        username: user.username,
        employeeNumber: user.employeeNumber,
        role: user.role,
        details: {
          userId: user.id,
          clientIp: networkAccess.clientIp,
          accessType: networkAccess.accessType,
          securityQuestionsCount,
        },
      });

      return NextResponse.json(
        {
          error:
            "Offsite access requires security questions. Please sign in onsite or contact IT to complete setup.",
          requiresSecurityQuestionSetup: true,
        },
        { status: 403 }
      );
    }

    const res = NextResponse.json({ success: true, user });

    clearSecurityQuestionChallengeCookie(res);

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours in seconds
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (error) {
    await logError({
      req,
      category: "AUTH",
      module: "AUTH",
      eventType: "LOGIN_ERROR",
      message: "Login route failed unexpectedly",
      username: username || null,
      error,
    });

    return NextResponse.json(
      { error: "Login failed." },
      { status: 500 }
    );
  }
}