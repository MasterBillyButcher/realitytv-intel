import "server-only";
import { env, checkGithubConfig } from "@/config/env";
import { fetchWithTimeout, TimeoutError } from "@/lib/fetchWithTimeout";
import { GithubPublishError } from "@/types";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_TIMEOUT_MS = 15000;

/** Path, relative to the repo root, of the canonical published tracker data file. */
export const CANONICAL_DATA_PATH = "data/data.json";

interface GithubContentResponse {
  sha: string;
  content: string;
  encoding: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function githubRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchWithTimeout(`${GITHUB_API_BASE}${path}`, init, GITHUB_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new GithubPublishError("network_error", "GitHub request timed out.");
    }
    throw new GithubPublishError("network_error", "Network error while contacting GitHub.");
  }
}

/**
 * Fetches the current file content and SHA for the canonical data file.
 * The SHA is required by the GitHub Contents API to update a file safely
 * and is how we detect concurrent edits (a stale SHA is rejected by GitHub
 * with a 409/422, which we surface as a conflict).
 */
export async function getCanonicalFile(): Promise<{ content: string; sha: string } | null> {
  const config = checkGithubConfig();
  if (!config.ok) {
    throw new GithubPublishError("missing_config", `Missing GitHub configuration: ${config.missing.join(", ")}`);
  }

  const token = env.githubToken() as string;
  const owner = env.githubOwner() as string;
  const repo = env.githubRepo() as string;
  const branch = env.githubBranch();

  const response = await githubRequest(
    `/repos/${owner}/${repo}/contents/${CANONICAL_DATA_PATH}?ref=${encodeURIComponent(branch)}`,
    { headers: authHeaders(token) }
  );

  if (response.status === 404) {
    return null;
  }
  if (response.status === 401 || response.status === 403) {
    throw new GithubPublishError("auth_failed", "GitHub rejected the configured token.");
  }
  if (!response.ok) {
    throw new GithubPublishError("unknown_error", `GitHub returned status ${response.status}.`);
  }

  const data = (await response.json()) as GithubContentResponse;
  const content = Buffer.from(data.content, data.encoding as BufferEncoding).toString("utf8");
  return { content, sha: data.sha };
}

export interface PublishOptions {
  /** Serialized JSON content to write. */
  content: string;
  /** SHA of the file this publish is based on, for conflict detection. Omit to create a new file. */
  baseSha: string | null;
  message: string;
}

export interface PublishSuccess {
  ok: true;
  commitSha: string;
  commitUrl: string;
}

export interface PublishFailure {
  ok: false;
  code: "conflict" | "auth_failed" | "missing_config" | "network_error" | "unknown_error";
  message: string;
}

/**
 * Publishes the canonical data file via the GitHub Contents API. This
 * always writes exactly one file at the fixed CANONICAL_DATA_PATH and
 * never touches any other path in the repository.
 */
export async function publishCanonicalFile(options: PublishOptions): Promise<PublishSuccess | PublishFailure> {
  const config = checkGithubConfig();
  if (!config.ok) {
    return {
      ok: false,
      code: "missing_config",
      message: `Missing GitHub configuration: ${config.missing.join(", ")}`
    };
  }

  const token = env.githubToken() as string;
  const owner = env.githubOwner() as string;
  const repo = env.githubRepo() as string;
  const branch = env.githubBranch();

  const body: Record<string, unknown> = {
    message: options.message,
    content: Buffer.from(options.content, "utf8").toString("base64"),
    branch
  };
  if (options.baseSha) {
    body.sha = options.baseSha;
  }

  let response: Response;
  try {
    response = await githubRequest(`/repos/${owner}/${repo}/contents/${CANONICAL_DATA_PATH}`, {
      method: "PUT",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (error instanceof GithubPublishError) {
      return { ok: false, code: "network_error", message: error.message };
    }
    return { ok: false, code: "network_error", message: "Network error while publishing to GitHub." };
  }

  if (response.status === 409 || response.status === 422) {
    return {
      ok: false,
      code: "conflict",
      message: "The published data changed since you started editing. Reload the latest data and try again."
    };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "auth_failed", message: "GitHub rejected the configured token." };
  }
  if (!response.ok) {
    return { ok: false, code: "unknown_error", message: `GitHub returned status ${response.status}.` };
  }

  const data = (await response.json()) as { commit: { sha: string; html_url: string } };
  return { ok: true, commitSha: data.commit.sha, commitUrl: data.commit.html_url };
}
