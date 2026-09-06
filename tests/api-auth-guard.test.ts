import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("admin-only route protection", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ADMIN_PASSWORD = "correct-password";
    process.env.ADMIN_SESSION_SECRET = "a-long-random-secret";
  });

  it("rejects follower refresh requests without a valid session", async () => {
    const { POST } = await import("@/app/api/followers/refresh/route");
    const request = new NextRequest("http://localhost/api/followers/refresh", {
      method: "POST",
      body: JSON.stringify({ targets: [] }),
      headers: { "Content-Type": "application/json" }
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("rejects publish requests without a valid session", async () => {
    const { POST } = await import("@/app/api/publish/route");
    const request = new NextRequest("http://localhost/api/publish", {
      method: "POST",
      body: JSON.stringify({ data: {} }),
      headers: { "Content-Type": "application/json" }
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("session-check endpoint reports unauthenticated for a missing cookie, never hangs", async () => {
    const { GET } = await import("@/app/api/auth/session/route");
    const request = new NextRequest("http://localhost/api/auth/session");
    const response = await GET(request);
    const body = await response.json();
    expect(body.authenticated).toBe(false);
  });

  it("session-check endpoint reports authenticated for a freshly issued session cookie", async () => {
    const { createSessionToken, SESSION_COOKIE_NAME } = await import("@/lib/auth");
    const session = createSessionToken();
    if (!session.ok) throw new Error("expected session");

    const { GET } = await import("@/app/api/auth/session/route");
    const request = new NextRequest("http://localhost/api/auth/session", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session.token}` }
    });
    const response = await GET(request);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
  });
});
