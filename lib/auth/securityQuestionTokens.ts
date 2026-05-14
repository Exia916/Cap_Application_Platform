import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";

export const SECURITY_QUESTION_CHALLENGE_COOKIE = "auth_security_challenge";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined.");
}

export type PendingSecurityQuestionChallenge = {
  purpose: "SECURITY_QUESTIONS";
  user: AuthUser;
  questionIds: string[];
  attemptsRemaining: number;
};

type JwtPayloadShape = PendingSecurityQuestionChallenge & {
  iat?: number;
  exp?: number;
};

function isValidChallengePayload(value: unknown): value is JwtPayloadShape {
  const payload = value as Partial<JwtPayloadShape>;

  return (
    !!payload &&
    payload.purpose === "SECURITY_QUESTIONS" &&
    !!payload.user &&
    typeof payload.user.id === "string" &&
    typeof payload.user.username === "string" &&
    Array.isArray(payload.questionIds) &&
    payload.questionIds.length === 2 &&
    payload.questionIds.every((x) => typeof x === "string" && x.trim().length > 0) &&
    typeof payload.attemptsRemaining === "number" &&
    Number.isFinite(payload.attemptsRemaining)
  );
}

export function createSecurityQuestionChallengeToken(input: {
  user: AuthUser;
  questionIds: string[];
  attemptsRemaining?: number;
}) {
  const payload: PendingSecurityQuestionChallenge = {
    purpose: "SECURITY_QUESTIONS",
    user: input.user,
    questionIds: input.questionIds,
    attemptsRemaining: input.attemptsRemaining ?? 5,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

export function getSecurityQuestionChallengeFromRequest(
  req: NextRequest
): PendingSecurityQuestionChallenge | null {
  const token = req.cookies.get(SECURITY_QUESTION_CHALLENGE_COOKIE)?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!isValidChallengePayload(decoded)) {
      return null;
    }

    return {
      purpose: decoded.purpose,
      user: decoded.user,
      questionIds: decoded.questionIds,
      attemptsRemaining: decoded.attemptsRemaining,
    };
  } catch {
    return null;
  }
}

export function setSecurityQuestionChallengeCookie(
  res: NextResponse,
  token: string
) {
  res.cookies.set(SECURITY_QUESTION_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSecurityQuestionChallengeCookie(res: NextResponse) {
  res.cookies.set(SECURITY_QUESTION_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}