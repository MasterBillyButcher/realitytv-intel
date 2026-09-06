export type ContestantStatus = "active" | "eliminated" | "winner" | "runner_up" | "withdrawn";
export type ContestantTier = "A" | "B" | "C" | "unranked";
export type Gender = "male" | "female" | "other";

export interface FollowerSnapshot {
  count: number;
  date: string; // ISO date string
}

export interface Contestant {
  id: string;
  name: string;
  gender: Gender;
  status: ContestantStatus;
  tier: ContestantTier;
  profession: string;
  instagramHandle: string;
  followersBefore: number | null;
  beforeDate: string | null;
  followersLast: number | null;
  lastDate: string | null;
  followersCurrent: number | null;
  currentDate: string | null;
  knownFor: string;
  history: FollowerSnapshot[];
  photo: string | null;
  bio: string;
  show: string; // show id
}

export interface Show {
  id: string;
  name: string;
  network: string | null;
  season: string | null;
  active: boolean;
}

export interface TrackerData {
  version: number;
  updatedAt: string;
  shows: Show[];
  contestants: Contestant[];
}

export interface GrowthResult {
  absolute: number | null;
  percent: number | null;
  available: boolean;
}
