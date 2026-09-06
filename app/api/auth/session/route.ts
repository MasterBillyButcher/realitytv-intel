import { NextRequest, NextResponse } from "next/server";
import { validateSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const result = validateSessionToken(token);

  if (result.valid) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false, reason: result.reason });
}
