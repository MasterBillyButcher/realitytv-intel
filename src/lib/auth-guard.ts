import { cookies } from "next/headers";
import { SESSION_COOKIE, validateSessionToken } from "@/lib/session";

export interface AuthResult {
  authorized: boolean;
  reason?: string;
}

/** Synchronous, dependency-free session check for use at the top of API routes. */
export async function requireAdminSession(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const result = validateSessionToken(token);

  if (!result.valid) {
    return { authorized: false, reason: result.reason };
  }
  return { authorized: true };
}
