import { describe, it, expect, beforeEach, vi } from "vitest";

describe("session", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_SESSION_SECRET = "a-sufficiently-long-test-secret";
    process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
  });

  it("creates a token that validates successfully", async () => {
    const { createSessionToken, validateSessionToken } = await import("@/lib/session");
    const token = createSessionToken();
    expect(validateSessionToken(token)).toEqual({ valid: true });
  });

  it("rejects a missing token", async () => {
    const { validateSessionToken } = await import("@/lib/session");
    expect(validateSessionToken(undefined).valid).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const { createSessionToken, validateSessionToken } = await import("@/lib/session");
    const token = createSessionToken();
    const tampered = token.slice(0, -2) + "zz";
    expect(validateSessionToken(tampered).valid).toBe(false);
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    const { createSessionToken, validateSessionToken } = await import("@/lib/session");
    const token = createSessionToken();
    vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 13); // 13 hours later
    const result = validateSessionToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
    vi.useRealTimers();
  });

  it("reports a config error without throwing when secret is missing", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    const { validateSessionToken } = await import("@/lib/session");
    const result = validateSessionToken("anything.here");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("config_error");
  });

  it("verifies a correct password", async () => {
    const { verifyAdminPassword } = await import("@/lib/session");
    expect(verifyAdminPassword("correct-horse-battery-staple")).toEqual({ ok: true });
  });

  it("rejects an incorrect password", async () => {
    const { verifyAdminPassword } = await import("@/lib/session");
    const result = verifyAdminPassword("wrong");
    expect(result.ok).toBe(false);
  });

  it("reports missing password configuration clearly", async () => {
    delete process.env.ADMIN_PASSWORD;
    const { verifyAdminPassword } = await import("@/lib/session");
    const result = verifyAdminPassword("anything");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not configured/);
  });
});
