import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-guard";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdminSession();
  // This check is purely local (signed cookie, no network/database call),
  // so it always resolves synchronously and can never leave the admin UI
  // stuck on a "Checking..." state.
  return NextResponse.json({ authorized: auth.authorized, reason: auth.reason ?? null });
}
