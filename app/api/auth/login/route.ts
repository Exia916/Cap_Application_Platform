import { NextRequest, NextResponse } from "next/server";
import { loginUser, COOKIE_NAME } from "@/lib/auth";
import { logError, logSecurityEvent } from "@/lib/logging/logger";
import {
  assessNetworkAccess,
  getOffsiteSecurityQuestionsMode,
} from "@/lib/auth/networkAccess";
import { getUserSecurityQuestionSummary } from "@/lib/repositories/userAccountRepo";

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
      },
    });

    const res = NextResponse.json({ success: true, user });

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