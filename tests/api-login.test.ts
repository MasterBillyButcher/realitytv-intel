import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function loginRequest(password: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
    headers: { "Content-Type": "application/json" }
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_PASSWORD = "correct-password";
    process.env.ADMIN_SESSION_SECRET = "a-long-random-secret";
  });

  it("succeeds with the correct password and sets a session cookie", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest("correct-password"));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
  });

  it("rejects an incorrect password with 401", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest("wrong-password"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it("rejects a missing password with 400, not a hang", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest(""));
    expect(response.status).toBe(400);
  });

  it("returns 500 with a clear error when ADMIN_PASSWORD is not configured", async () => {
    delete process.env.ADMIN_PASSWORD;
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest("anything"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toContain("ADMIN_PASSWORD");
  });

  it("returns 500 with a clear error when ADMIN_SESSION_SECRET is not configured", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    const { POST } = await import("@/app/api/auth/login/route");
    const response = await POST(loginRequest("correct-password"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toContain("ADMIN_SESSION_SECRET");
  });
});
