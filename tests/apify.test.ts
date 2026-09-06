import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApifyError } from "@/types";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as unknown as typeof fetch;
}

describe("fetchInstagramFollowers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.APIFY_TOKEN = "test-token";
    delete process.env.APIFY_ACTOR_ID;
    delete process.env.APIFY_FOLLOWERS_FIELD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws missing_token when APIFY_TOKEN is not configured", async () => {
    delete process.env.APIFY_TOKEN;
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "missing_token" });
  });

  it("throws invalid_username for a malformed handle", async () => {
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("not a handle!")).rejects.toMatchObject({ code: "invalid_username" });
  });

  it("parses a valid Apify dataset response into a follower count", async () => {
    mockFetchOnce(200, [{ followersCount: 15234, isPrivate: false }]);
    const { fetchInstagramFollowers } = await import("@/server/apify");
    const result = await fetchInstagramFollowers("janedoe");
    expect(result.followers).toBe(15234);
    expect(result.handle).toBe("janedoe");
  });

  it("throws private_profile for a private account", async () => {
    mockFetchOnce(200, [{ followersCount: 100, isPrivate: true }]);
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "private_profile" });
  });

  it("throws profile_unavailable for an empty dataset", async () => {
    mockFetchOnce(200, []);
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "profile_unavailable" });
  });

  it("throws invalid_token on a 401 response", async () => {
    mockFetchOnce(401, {});
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("throws rate_limited on a 429 response", async () => {
    mockFetchOnce(429, {});
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("throws actor_error on a 500 response", async () => {
    mockFetchOnce(500, {});
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "actor_error" });
  });

  it("throws malformed_response when the followers field is missing or non-numeric", async () => {
    mockFetchOnce(200, [{ somethingElse: "value" }]);
    const { fetchInstagramFollowers } = await import("@/server/apify");
    await expect(fetchInstagramFollowers("janedoe")).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("never surfaces raw Apify error details to the user-facing message", async () => {
    const { apifyErrorToUserMessage } = await import("@/server/apify");
    const error = new ApifyError("actor_error", "Apify internal stack trace: xyz");
    const message = apifyErrorToUserMessage(error);
    expect(message).not.toContain("stack trace");
  });
});
