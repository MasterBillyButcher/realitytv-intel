import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readTrackerFile,
  publishTrackerFile,
  GitHubConfigError,
  GitHubConflictError,
  GitHubPublishError,
} from "@/lib/github";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("GitHub client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_OWNER = "test-owner";
    process.env.GITHUB_REPO = "test-repo";
    process.env.GITHUB_BRANCH = "main";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("readTrackerFile", () => {
    it("throws GitHubConfigError when configuration is incomplete", async () => {
      delete process.env.GITHUB_TOKEN;
      await expect(readTrackerFile()).rejects.toBeInstanceOf(GitHubConfigError);
    });

    it("decodes base64 content and returns the sha", async () => {
      const content = Buffer.from(JSON.stringify({ hello: "world" })).toString("base64");
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({ content, sha: "abc123", encoding: "base64" }));

      const result = await readTrackerFile();
      expect(JSON.parse(result.content)).toEqual({ hello: "world" });
      expect(result.sha).toBe("abc123");
    });

    it("throws GitHubPublishError on a non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 404));
      await expect(readTrackerFile()).rejects.toBeInstanceOf(GitHubPublishError);
    });
  });

  describe("publishTrackerFile", () => {
    const params = { content: "{}", expectedSha: "abc123", commitMessage: "test commit" };

    it("throws GitHubConfigError when configuration is incomplete", async () => {
      delete process.env.GITHUB_OWNER;
      await expect(publishTrackerFile(params)).rejects.toBeInstanceOf(GitHubConfigError);
    });

    it("returns the new commit sha and url on success", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        jsonResponse({ commit: { sha: "def456", html_url: "https://github.com/test-owner/test-repo/commit/def456" } })
      );
      const result = await publishTrackerFile(params);
      expect(result.commitSha).toBe("def456");
      expect(result.commitUrl).toContain("def456");
    });

    it("throws GitHubConflictError on a 409 response", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 409));
      await expect(publishTrackerFile(params)).rejects.toBeInstanceOf(GitHubConflictError);
    });

    it("throws GitHubConflictError on a 422 response (stale sha)", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 422));
      await expect(publishTrackerFile(params)).rejects.toBeInstanceOf(GitHubConflictError);
    });

    it("throws GitHubPublishError on other failure statuses", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));
      await expect(publishTrackerFile(params)).rejects.toBeInstanceOf(GitHubPublishError);
    });
  });
});
