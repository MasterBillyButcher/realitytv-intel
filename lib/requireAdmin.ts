import { NextRequest, NextResponse } from "next/server";
import { validateSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * Verifies the admin session cookie server-side. The frontend's belief
 * about whether it is logged in is never trusted; every admin-only route
 * must call this.
 */
export function requireAdminSession(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const result = validateSessionToken(token);
  if (!result.valid) {
    return NextResponse.json({ ok: false, error: "unauthorized", reason: result.reason }, { status: 401 });
  }
  return null;
}
