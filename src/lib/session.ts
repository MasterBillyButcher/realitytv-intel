import { createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE_NAME = "rti_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

interface SessionPayload {
  role: "admin";
  issuedAt: number;
  expiresAt: number;
}

export class SessionConfigError extends Error {}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new SessionConfigError(
      "ADMIN_SESSION_SECRET is not configured. Set a random string of at least 16 characters."
    );
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Creates a signed, stateless session token. The token itself carries the
 * expiration, so validation never depends on a database or cache lookup.
 */
export function createSessionToken(): string {
  const secret = getSecret();
  const now = Date.now();
  const payload: SessionPayload = {
    role: "admin",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadStr, secret);
  return `${payloadStr}.${signature}`;
}

export type SessionValidationResult =
  | { valid: true }
  | { valid: false; reason: "malformed" | "invalid_signature" | "expired" | "config_error" };

/**
 * Validates a session token synchronously and with no network or database
 * call, so a downstream outage can never leave the browser stuck checking
 * an admin session indefinitely.
 */
export function validateSessionToken(token: string | undefined | null): SessionValidationResult {
  if (!token) return { valid: false, reason: "malformed" };

  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed" };
  const [payloadStr, signature] = parts;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { valid: false, reason: "config_error" };
  }

  const expectedSignature = sign(payloadStr, secret);
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: "invalid_signature" };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (typeof payload.expiresAt !== "number" || Date.now() > payload.expiresAt) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true };
}

export function verifyAdminPassword(candidate: string): { ok: true } | { ok: false; reason: string } {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    return { ok: false, reason: "ADMIN_PASSWORD is not configured on the server." };
  }
  if (!candidate) {
    return { ok: false, reason: "Password is required." };
  }

  const a = Buffer.from(candidate);
  const b = Buffer.from(configured);
  const same = a.length === b.length && timingSafeEqual(a, b);
  if (!same) {
    return { ok: false, reason: "Incorrect password." };
  }
  return { ok: true };
}

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
