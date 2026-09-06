import { NextResponse } from "next/server";
import { createSessionToken, verifyAdminPassword, SessionConfigError, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";

  const check = verifyAdminPassword(password);
  if (!check.ok) {
    // Distinguish server misconfiguration from a genuinely wrong password,
    // without leaking which one it was to an unauthenticated caller in detail.
    const status = check.reason.includes("not configured") ? 503 : 401;
    return NextResponse.json({ error: check.reason }, { status });
  }

  let token: string;
  try {
    token = createSessionToken();
  } catch (err) {
    if (err instanceof SessionConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not create a session." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
