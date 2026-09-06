import { fetchWithTimeout, TimeoutError } from "@/lib/fetch-with-timeout";
import { normalizeInstagramHandle } from "@/lib/validation";

const APIFY_API = "https://api.apify.com/v2";

// Apify actor slugs use "~" instead of "/" in URL paths.
// Configurable via APIFY_ACTOR_ID because Apify actors change over time;
// defaults to Apify's own official actor for this task.
const DEFAULT_ACTOR_ID = "apify~instagram-followers-count-scraper";

export type ApifyErrorReason =
  | "missing_token"
  | "invalid_token"
  | "invalid_username"
  | "private_or_unavailable"
  | "rate_limited"
  | "timeout"
  | "actor_error"
  | "malformed_response";

export class ApifyFollowerError extends Error {
  reason: ApifyErrorReason;
  constructor(reason: ApifyErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export interface ApifyFollowerResult {
  handle: string;
  followersCount: number;
  fetchedAt: string;
}

interface RawDatasetItem {
  followersCount?: number;
  userName?: string;
  username?: string;
  error?: string;
  private?: boolean;
}

/**
 * Fetches a real, current follower count for a single Instagram handle via
 * Apify. Never estimates or fabricates a value: any failure raises a typed
 * ApifyFollowerError instead of returning a placeholder number.
 */
export async function fetchInstagramFollowers(handleInput: string): Promise<ApifyFollowerResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new ApifyFollowerError("missing_token", "APIFY_TOKEN is not configured on the server.");
  }

  const handle = normalizeInstagramHandle(handleInput);
  if (!handle) {
    throw new ApifyFollowerError("invalid_username", "Instagram handle is empty or invalid.");
  }

  const actorId = process.env.APIFY_ACTOR_ID || DEFAULT_ACTOR_ID;
  const url = `${APIFY_API}/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [handle] }),
      },
      30000
    );
  } catch (err) {
    if (err instanceof TimeoutError) {
      throw new ApifyFollowerError("timeout", "Apify did not respond in time.");
    }
    throw new ApifyFollowerError("actor_error", "Could not reach Apify.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApifyFollowerError("invalid_token", "APIFY_TOKEN was rejected by Apify.");
  }
  if (response.status === 429) {
    throw new ApifyFollowerError("rate_limited", "Apify rate limit reached. Try again shortly.");
  }
  if (!response.ok) {
    throw new ApifyFollowerError("actor_error", `Apify actor run failed with status ${response.status}.`);
  }

  let items: RawDatasetItem[];
  try {
    items = (await response.json()) as RawDatasetItem[];
  } catch {
    throw new ApifyFollowerError("malformed_response", "Apify returned an unreadable response.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyFollowerError("invalid_username", "No data returned for this Instagram handle.");
  }

  const item = items[0];

  if (item.private) {
    throw new ApifyFollowerError("private_or_unavailable", "This Instagram profile is private.");
  }
  if (item.error || typeof item.followersCount !== "number") {
    throw new ApifyFollowerError(
      "private_or_unavailable",
      "This Instagram profile is unavailable or could not be read."
    );
  }

  return {
    handle,
    followersCount: item.followersCount,
    fetchedAt: new Date().toISOString(),
  };
}
