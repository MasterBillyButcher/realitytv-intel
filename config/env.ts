/**
 * Centralized environment variable access. Import from here rather than
 * reading process.env directly, so every required variable is documented
 * in one place and missing configuration produces a clear error instead
 * of a silent undefined.
 */

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  adminPassword: () => readOptional("ADMIN_PASSWORD"),
  adminSessionSecret: () => readOptional("ADMIN_SESSION_SECRET"),
  githubToken: () => readOptional("GITHUB_TOKEN"),
  githubOwner: () => readOptional("GITHUB_OWNER"),
  githubRepo: () => readOptional("GITHUB_REPO"),
  githubBranch: () => readOptional("GITHUB_BRANCH") ?? "main",
  apifyToken: () => readOptional("APIFY_TOKEN")
};

export interface ConfigCheckResult {
  ok: boolean;
  missing: string[];
}

export function checkAuthConfig(): ConfigCheckResult {
  const missing: string[] = [];
  if (!env.adminPassword()) missing.push("ADMIN_PASSWORD");
  if (!env.adminSessionSecret()) missing.push("ADMIN_SESSION_SECRET");
  return { ok: missing.length === 0, missing };
}

export function checkGithubConfig(): ConfigCheckResult {
  const missing: string[] = [];
  if (!env.githubToken()) missing.push("GITHUB_TOKEN");
  if (!env.githubOwner()) missing.push("GITHUB_OWNER");
  if (!env.githubRepo()) missing.push("GITHUB_REPO");
  return { ok: missing.length === 0, missing };
}

export function checkApifyConfig(): ConfigCheckResult {
  const missing: string[] = [];
  if (!env.apifyToken()) missing.push("APIFY_TOKEN");
  return { ok: missing.length === 0, missing };
}
