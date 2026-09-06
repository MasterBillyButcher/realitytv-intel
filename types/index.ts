export type ContestantStatus = "active" | "eliminated" | "winner" | "runner-up" | "withdrawn" | "unknown";

export type ContestantGender = "male" | "female" | "non-binary" | "unspecified";

export type ContestantTier = "lead" | "featured" | "supporting" | "guest" | "unranked";

export interface FollowerHistoryEntry {
  /** ISO 8601 date string, unique within a contestant's history. */
  date: string;
  followers: number;
  /** Where this reading came from. */
  source: "apify" | "manual" | "import";
}

export interface Contestant {
  id: string;
  name: string;
  gender: ContestantGender;
  status: ContestantStatus;
  tier: ContestantTier;
  profession: string;
  instagramHandle: string;
  /** Follower count at first known reading. */
  followersBefore: number | null;
  beforeDate: string | null;
  /** Follower count at previous refresh. */
  followersLast: number | null;
  lastDate: string | null;
  /** Follower count at most recent refresh. */
  followersCurrent: number | null;
  currentDate: string | null;
  knownFor: string;
  bio: string;
  photo: string;
  showId: string;
  history: FollowerHistoryEntry[];
}

export interface Show {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

export interface TrackerData {
  shows: Show[];
  contestants: Contestant[];
  /** ISO timestamp of the last successful publish. */
  publishedAt: string | null;
}

export interface GrowthResult {
  absolute: number | null;
  percent: number | null;
  available: boolean;
}

export interface RankedContestant extends Contestant {
  rank: number | null;
  growth: GrowthResult;
}

export type SortField = "followers" | "growth" | "name" | "show" | "status";
export type SortDirection = "asc" | "desc";

export interface TrackerFilters {
  showId?: string;
  status?: ContestantStatus;
  gender?: ContestantGender;
  tier?: ContestantTier;
  query?: string;
}

export interface RefreshResult {
  contestantId: string;
  ok: boolean;
  followers?: number;
  error?: string;
}

export interface ApifyFollowerResult {
  handle: string;
  followers: number;
  fetchedAt: string;
}

export type ApifyErrorCode =
  | "missing_token"
  | "invalid_token"
  | "invalid_username"
  | "private_profile"
  | "profile_unavailable"
  | "actor_error"
  | "timeout"
  | "rate_limited"
  | "malformed_response"
  | "unknown_error";

export class ApifyError extends Error {
  code: ApifyErrorCode;
  constructor(code: ApifyErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApifyError";
  }
}

export type GithubErrorCode =
  | "missing_config"
  | "auth_failed"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "network_error"
  | "unknown_error";

export class GithubPublishError extends Error {
  code: GithubErrorCode;
  constructor(code: GithubErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "GithubPublishError";
  }
}
