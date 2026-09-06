import { NextRequest, NextResponse } from "next/server";
import { checkAuthConfig, env } from "@/config/env";
import { createSessionToken, safeCompare, SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginBody {
  password?: string;
}

export async function POST(request: NextRequest) {
  const configCheck = checkAuthConfig();
  if (!configCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: `Admin login is not configured. Missing: ${configCheck.missing.join(", ")}.`
      },
      { status: 500 }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request", message: "Malformed request body." }, { status: 400 });
  }

  const password = body.password ?? "";
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_password", message: "Password is required." }, { status: 400 });
  }

  const expected = env.adminPassword() as string;
  if (!safeCompare(password, expected)) {
    return NextResponse.json({ ok: false, error: "invalid_password", message: "Incorrect password." }, { status: 401 });
  }

  const session = createSessionToken();
  if (!session.ok) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "Session secret is not configured." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAgeSeconds
  });
  return response;
}
