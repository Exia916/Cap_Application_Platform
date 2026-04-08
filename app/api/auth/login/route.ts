import { NextRequest, NextResponse } from "next/server";
import { loginUser, COOKIE_NAME } from "@/lib/auth";
import { logError, logSecurityEvent } from "@/lib/logging/logger";

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