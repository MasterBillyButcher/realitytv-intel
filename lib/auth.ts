import crypto from "node:crypto";
import { env } from "@/config/env";

export const SESSION_COOKIE_NAME = "rtvi_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

interface SessionPayload {
  exp: number; // unix seconds
  iat: number;
}

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, "base64");
}

function sign(payload: string, secret: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payload).digest());
}

/** Constant-time string compare to avoid timing attacks on password checks. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers to keep timing stable.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export type SessionCreationResult =
  | { ok: true; token: string; maxAgeSeconds: number }
  | { ok: false; error: "missing_secret" };

export function createSessionToken(): SessionCreationResult {
  const secret = env.adminSessionSecret();
  if (!secret) {
    return { ok: false, error: "missing_secret" };
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { iat: now, exp: now + SESSION_TTL_SECONDS };
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signature = sign(encodedPayload, secret);
  return { ok: true, token: `${encodedPayload}.${signature}`, maxAgeSeconds: SESSION_TTL_SECONDS };
}

export type SessionValidationResult =
  | { valid: true }
  | { valid: false; reason: "missing_secret" | "malformed" | "invalid_signature" | "expired" };

export function validateSessionToken(token: string | undefined | null): SessionValidationResult {
  const secret = env.adminSessionSecret();
  if (!secret) {
    return { valid: false, reason: "missing_secret" };
  }
  if (!token || !token.includes(".")) {
    return { valid: false, reason: "malformed" };
  }
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { valid: false, reason: "malformed" };
  }

  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return { valid: false, reason: "invalid_signature" };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true };
}
