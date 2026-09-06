import type { Contestant, ContestantStatus, ContestantTier, Gender } from "@/types/tracker";
import { contestantGrowth } from "@/lib/growth";

export interface ContestantFilters {
  show?: string;
  status?: ContestantStatus;
  gender?: Gender;
  tier?: ContestantTier;
}

export type SortField = "followers" | "growth" | "name" | "show" | "status";
export type SortDirection = "asc" | "desc";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Cheap substring search across a small fixed set of fields.
 * Intentionally avoids fuzzy matching or scoring so it stays fast
 * enough to run on every keystroke against the full in-memory dataset.
 */
export function searchContestants(contestants: Contestant[], query: string): Contestant[] {
  const q = normalize(query);
  if (!q) return contestants;

  return contestants.filter((c) => {
    return (
      normalize(c.name).includes(q) ||
      normalize(c.instagramHandle).includes(q) ||
      normalize(c.profession).includes(q) ||
      normalize(c.show).includes(q) ||
      normalize(c.knownFor).includes(q)
    );
  });
}

export function filterContestants(contestants: Contestant[], filters: ContestantFilters): Contestant[] {
  return contestants.filter((c) => {
    if (filters.show && c.show !== filters.show) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (filters.gender && c.gender !== filters.gender) return false;
    if (filters.tier && c.tier !== filters.tier) return false;
    return true;
  });
}

/** Missing numeric values always sort to the end, regardless of direction. */
function compareNullableNumbers(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

export function sortContestants(
  contestants: Contestant[],
  field: SortField,
  direction: SortDirection = "desc"
): Contestant[] {
  const copy = [...contestants];

  copy.sort((a, b) => {
    switch (field) {
      case "followers":
        return compareNullableNumbers(a.followersCurrent, b.followersCurrent, direction);
      case "growth": {
        const ga = contestantGrowth(a).absolute;
        const gb = contestantGrowth(b).absolute;
        return compareNullableNumbers(ga, gb, direction);
      }
      case "name":
        return direction === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      case "show":
        return direction === "asc" ? a.show.localeCompare(b.show) : b.show.localeCompare(a.show);
      case "status":
        return direction === "asc" ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
      default:
        return 0;
    }
  });

  return copy;
}

/** Ranks contestants by real current follower counts. Missing values rank last, unranked. */
export function rankContestants(contestants: Contestant[]): Array<Contestant & { rank: number | null }> {
  const withCounts = contestants.filter((c) => c.followersCurrent !== null);
  const withoutCounts = contestants.filter((c) => c.followersCurrent === null);

  const sorted = sortContestants(withCounts, "followers", "desc");

  const ranked = sorted.map((c, index) => ({ ...c, rank: index + 1 }));
  const unranked = withoutCounts.map((c) => ({ ...c, rank: null }));

  return [...ranked, ...unranked];
}
