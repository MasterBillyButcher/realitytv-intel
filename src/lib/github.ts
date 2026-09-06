import { fetchWithTimeout, TimeoutError } from "@/lib/fetch-with-timeout";

const DATA_PATH = "src/data/tracker-data.json";
const GITHUB_API = "https://api.github.com";

export class GitHubConfigError extends Error {}
export class GitHubConflictError extends Error {}
export class GitHubPublishError extends Error {}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

function getConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const missing = [
    !token && "GITHUB_TOKEN",
    !owner && "GITHUB_OWNER",
    !repo && "GITHUB_REPO",
    !branch && "GITHUB_BRANCH",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new GitHubConfigError(`Missing required GitHub configuration: ${missing.join(", ")}`);
  }

  return { token: token!, owner: owner!, repo: repo!, branch: branch! };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface RemoteFile {
  content: string; // decoded UTF-8 content
  sha: string;
}

/** Reads the current canonical data file and its SHA, for conflict-safe updates. */
export async function readTrackerFile(): Promise<RemoteFile> {
  const config = getConfig();
  const url = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${DATA_PATH}?ref=${config.branch}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, { headers: authHeaders(config.token) }, 10000);
  } catch (err) {
    if (err instanceof TimeoutError) throw new GitHubPublishError("GitHub request timed out while reading data.");
    throw new GitHubPublishError("Could not reach GitHub.");
  }

  if (!response.ok) {
    throw new GitHubPublishError(`GitHub read failed with status ${response.status}.`);
  }

  const json = (await response.json()) as { content: string; sha: string; encoding: string };
  const content = Buffer.from(json.content, "base64").toString("utf8");
  return { content, sha: json.sha };
}

/**
 * Publishes the canonical data file as a single commit, using the SHA of the
 * version the admin last read. GitHub rejects the write if the file has
 * changed since then, which is surfaced as a GitHubConflictError so the
 * caller can ask the admin to reload and retry rather than overwrite
 * someone else's concurrent edit.
 */
export async function publishTrackerFile(params: {
  content: string;
  expectedSha: string;
  commitMessage: string;
}): Promise<{ commitSha: string; commitUrl: string }> {
  const config = getConfig();
  const url = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${DATA_PATH}`;

  const body = {
    message: params.commitMessage,
    content: Buffer.from(params.content, "utf8").toString("base64"),
    sha: params.expectedSha,
    branch: config.branch,
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      { method: "PUT", headers: { ...authHeaders(config.token), "Content-Type": "application/json" }, body: JSON.stringify(body) },
      15000
    );
  } catch (err) {
    if (err instanceof TimeoutError) throw new GitHubPublishError("GitHub request timed out while publishing.");
    throw new GitHubPublishError("Could not reach GitHub.");
  }

  if (response.status === 409 || response.status === 422) {
    throw new GitHubConflictError(
      "The published data changed since you last loaded it. Reload and reapply your edit before publishing again."
    );
  }

  if (!response.ok) {
    throw new GitHubPublishError(`GitHub publish failed with status ${response.status}.`);
  }

  const json = (await response.json()) as { commit: { sha: string; html_url: string } };
  return { commitSha: json.commit.sha, commitUrl: json.commit.html_url };
}
