import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchInstagramFollowers, ApifyFollowerError } from "@/lib/apify";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("fetchInstagramFollowers", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.APIFY_TOKEN = "test-token";
    delete process.env.APIFY_ACTOR_ID;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws missing_token when APIFY_TOKEN is unset", async () => {
    delete process.env.APIFY_TOKEN;
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "missing_token" });
  });

  it("throws invalid_username for an empty handle", async () => {
    await expect(fetchInstagramFollowers("   ")).rejects.toMatchObject({ reason: "invalid_username" });
  });

  it("parses a successful response and returns the real follower count", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([{ followersCount: 542123, username: "someone" }]));
    const result = await fetchInstagramFollowers("@Someone");
    expect(result.followersCount).toBe(542123);
    expect(result.handle).toBe("someone");
  });

  it("throws invalid_token on a 401 response", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "invalid_token" });
  });

  it("throws rate_limited on a 429 response", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "rate_limited" });
  });

  it("throws invalid_username when the dataset is empty", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([]));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "invalid_username" });
  });

  it("throws private_or_unavailable for a private profile", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([{ private: true }]));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "private_or_unavailable" });
  });

  it("throws private_or_unavailable when followersCount is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse([{ username: "someone" }]));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "private_or_unavailable" });
  });

  it("throws malformed_response when the body is not valid JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "malformed_response" });
  });

  it("throws actor_error on a generic non-ok status", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchInstagramFollowers("someone")).rejects.toMatchObject({ reason: "actor_error" });
  });

  it("wraps unexpected network failures as ApifyFollowerError", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(fetchInstagramFollowers("someone")).rejects.toBeInstanceOf(ApifyFollowerError);
  });
});
