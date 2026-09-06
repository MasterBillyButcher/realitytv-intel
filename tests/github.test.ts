import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as unknown as typeof fetch;
}

describe("publishCanonicalFile", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_OWNER = "test-owner";
    process.env.GITHUB_REPO = "test-repo";
    process.env.GITHUB_BRANCH = "main";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails with missing_config when GitHub env vars are absent", async () => {
    delete process.env.GITHUB_TOKEN;
    const { publishCanonicalFile } = await import("@/server/github");
    const result = await publishCanonicalFile({ content: "{}", baseSha: null, message: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("missing_config");
  });

  it("returns a conflict result on a 409 response", async () => {
    mockFetchOnce(409, {});
    const { publishCanonicalFile } = await import("@/server/github");
    const result = await publishCanonicalFile({ content: "{}", baseSha: "stale-sha", message: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("returns a conflict result on a 422 response (GitHub's SHA mismatch status)", async () => {
    mockFetchOnce(422, {});
    const { publishCanonicalFile } = await import("@/server/github");
    const result = await publishCanonicalFile({ content: "{}", baseSha: "stale-sha", message: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("returns auth_failed on a 401 response", async () => {
    mockFetchOnce(401, {});
    const { publishCanonicalFile } = await import("@/server/github");
    const result = await publishCanonicalFile({ content: "{}", baseSha: null, message: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("auth_failed");
  });

  it("succeeds and returns a commit sha on a 200/201 response", async () => {
    mockFetchOnce(201, { commit: { sha: "abc123", html_url: "https://github.com/test-owner/test-repo/commit/abc123" } });
    const { publishCanonicalFile } = await import("@/server/github");
    const result = await publishCanonicalFile({ content: "{}", baseSha: "abc", message: "test" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.commitSha).toBe("abc123");
  });
});
