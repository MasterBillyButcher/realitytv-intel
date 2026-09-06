import { beforeEach, describe, expect, it, vi } from "vitest";

describe("auth session handling", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_SESSION_SECRET = "test-secret-value";
    process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
  });

  it("creates and validates a fresh session token", async () => {
    const { createSessionToken, validateSessionToken } = await import("@/lib/auth");
    const session = createSessionToken();
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    const validation = validateSessionToken(session.token);
    expect(validation.valid).toBe(true);
  });

  it("rejects a session token when the secret is missing", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    const { createSessionToken } = await import("@/lib/auth");
    const session = createSessionToken();
    expect(session.ok).toBe(false);
  });

  it("rejects a malformed token", async () => {
    const { validateSessionToken } = await import("@/lib/auth");
    const result = validateSessionToken("not-a-real-token");
    expect(result.valid).toBe(false);
    expect(result.valid ? null : result.reason).toBe("malformed");
  });

  it("rejects a token with a tampered signature", async () => {
    const { createSessionToken, validateSessionToken } = await import("@/lib/auth");
    const session = createSessionToken();
    if (!session.ok) throw new Error("expected session");
    const [payload] = session.token.split(".");
    const tampered = `${payload}.deadbeef`;
    const result = validateSessionToken(tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    const { createSessionToken, validateSessionToken } = await import("@/lib/auth");
    const session = createSessionToken();
    if (!session.ok) throw new Error("expected session");
    vi.advanceTimersByTime((session.maxAgeSeconds + 60) * 1000);
    const result = validateSessionToken(session.token);
    expect(result.valid).toBe(false);
    expect(result.valid ? null : result.reason).toBe("expired");
    vi.useRealTimers();
  });

  it("compares passwords in constant time and rejects wrong password", async () => {
    const { safeCompare } = await import("@/lib/auth");
    expect(safeCompare("correct-horse-battery-staple", "correct-horse-battery-staple")).toBe(true);
    expect(safeCompare("wrong-password", "correct-horse-battery-staple")).toBe(false);
  });
});
