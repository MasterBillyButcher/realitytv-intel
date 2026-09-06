import "server-only";
import { env, checkApifyConfig } from "@/config/env";
import { fetchWithTimeout, TimeoutError } from "@/lib/fetchWithTimeout";
import { ApifyError, type ApifyFollowerResult } from "@/types";
import { isValidInstagramHandle, normalizeInstagramHandle } from "@/lib/instagram";

/**
 * Default Apify actor used to retrieve public Instagram profile data,
 * including follower counts. This is the Apify-maintained
 * "Instagram Profile Scraper" actor (apify/instagram-profile-scraper),
 * chosen because it is first-party maintained and widely used.
 *
 * Actor input/output shapes on Apify Store can change over time and the
 * store also hosts many differently-shaped community actors, so both the
 * actor id and the output field name are overridable via environment
 * variables without a code change:
 *   APIFY_ACTOR_ID          e.g. "apify/instagram-profile-scraper"
 *   APIFY_FOLLOWERS_FIELD   e.g. "followersCount"
 *
 * Before relying on this in production, confirm the actor's current input
 * and output schema in the Apify Console, since third-party actors can
 * change without notice.
 */
const DEFAULT_ACTOR_ID = "apify/instagram-profile-scraper";
const DEFAULT_FOLLOWERS_FIELD = "followersCount";
const APIFY_TIMEOUT_MS = 30000;

function getActorId(): string {
  return process.env.APIFY_ACTOR_ID && process.env.APIFY_ACTOR_ID.length > 0
    ? process.env.APIFY_ACTOR_ID
    : DEFAULT_ACTOR_ID;
}

function getFollowersField(): string {
  return process.env.APIFY_FOLLOWERS_FIELD && process.env.APIFY_FOLLOWERS_FIELD.length > 0
    ? process.env.APIFY_FOLLOWERS_FIELD
    : DEFAULT_FOLLOWERS_FIELD;
}

/**
 * Fetches the current real follower count for a single Instagram handle
 * via Apify. Never returns an estimated or fabricated value: any failure
 * to obtain a genuine count is surfaced as an ApifyError.
 */
export async function fetchInstagramFollowers(rawHandle: string): Promise<ApifyFollowerResult> {
  const configCheck = checkApifyConfig();
  if (!configCheck.ok) {
    throw new ApifyError("missing_token", "APIFY_TOKEN is not configured on the server.");
  }

  const handle = normalizeInstagramHandle(rawHandle);
  if (!isValidInstagramHandle(handle)) {
    throw new ApifyError("invalid_username", `"${rawHandle}" is not a valid Instagram handle.`);
  }

  const token = env.apifyToken() as string;
  const actorId = getActorId();
  const followersField = getFollowersField();
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token
  )}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [handle] })
      },
      APIFY_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new ApifyError("timeout", `Apify request for @${handle} timed out.`);
    }
    throw new ApifyError("unknown_error", `Network error while contacting Apify for @${handle}.`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApifyError("invalid_token", "APIFY_TOKEN was rejected by Apify.");
  }
  if (response.status === 429) {
    throw new ApifyError("rate_limited", "Apify rate limit reached. Try again shortly.");
  }
  if (response.status >= 500) {
    throw new ApifyError("actor_error", `Apify actor returned a server error (${response.status}).`);
  }
  if (!response.ok) {
    throw new ApifyError("actor_error", `Apify actor call failed with status ${response.status}.`);
  }

  let items: unknown;
  try {
    items = await response.json();
  } catch {
    throw new ApifyError("malformed_response", "Apify returned a response that could not be parsed.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError("profile_unavailable", `No data returned for @${handle}. The profile may not exist.`);
  }

  const record = items[0] as Record<string, unknown>;

  if (record["private"] === true || record["isPrivate"] === true) {
    throw new ApifyError("private_profile", `@${handle} is a private profile and cannot be tracked.`);
  }

  const followersRaw = record[followersField];
  const followers =
    typeof followersRaw === "number"
      ? followersRaw
      : typeof followersRaw === "string" && /^\d+$/.test(followersRaw)
        ? Number.parseInt(followersRaw, 10)
        : null;

  if (followers === null || Number.isNaN(followers) || followers < 0) {
    throw new ApifyError(
      "malformed_response",
      `Apify response for @${handle} did not include a usable "${followersField}" field.`
    );
  }

  return {
    handle,
    followers,
    fetchedAt: new Date().toISOString()
  };
}

/** Maps an ApifyError code to a safe, user-facing message. Never surfaces raw Apify payloads. */
export function apifyErrorToUserMessage(error: ApifyError): string {
  switch (error.code) {
    case "missing_token":
      return "Follower refresh is not configured. Contact the site administrator.";
    case "invalid_token":
      return "Follower refresh is misconfigured. Contact the site administrator.";
    case "invalid_username":
      return "That Instagram handle is not valid.";
    case "private_profile":
      return "This Instagram profile is private and cannot be tracked.";
    case "profile_unavailable":
      return "This Instagram profile could not be found.";
    case "actor_error":
      return "The follower lookup service returned an error. Try again shortly.";
    case "timeout":
      return "The follower lookup timed out. Try again.";
    case "rate_limited":
      return "Too many follower lookups right now. Wait a moment and try again.";
    case "malformed_response":
      return "The follower lookup returned an unexpected response. Try again.";
    default:
      return "The follower lookup failed unexpectedly.";
  }
}
