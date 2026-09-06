import type { RankedContestant, SortDirection, SortField, TrackerFilters } from "@/types";

/**
 * Case-insensitive search across name, Instagram handle, profession, and show name.
 * Operates on an already-in-memory array; no expensive work is done per keystroke
 * beyond a single lowercase pass and substring checks.
 */
export function searchContestants(
  contestants: RankedContestant[],
  query: string,
  showNameById: Map<string, string>
): RankedContestant[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return contestants;

  return contestants.filter((c) => {
    const showName = showNameById.get(c.showId) ?? "";
    return (
      c.name.toLowerCase().includes(trimmed) ||
      c.instagramHandle.toLowerCase().includes(trimmed) ||
      c.profession.toLowerCase().includes(trimmed) ||
      c.knownFor.toLowerCase().includes(trimmed) ||
      showName.toLowerCase().includes(trimmed)
    );
  });
}

export function filterContestants(contestants: RankedContestant[], filters: TrackerFilters): RankedContestant[] {
  return contestants.filter((c) => {
    if (filters.showId && c.showId !== filters.showId) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (filters.gender && c.gender !== filters.gender) return false;
    if (filters.tier && c.tier !== filters.tier) return false;
    return true;
  });
}

/**
 * Sorts by the given field. Missing numeric values are always sorted last
 * regardless of direction, since "unavailable" is not a numeric ranking.
 */
export function sortContestants(
  contestants: RankedContestant[],
  field: SortField,
  direction: SortDirection,
  showNameById: Map<string, string>
): RankedContestant[] {
  const dirMultiplier = direction === "asc" ? 1 : -1;

  const withValue: RankedContestant[] = [];
  const withoutValue: RankedContestant[] = [];

  const getNumericKey = (c: RankedContestant): number | null => {
    if (field === "followers") return c.followersCurrent;
    if (field === "growth") return c.growth.available ? c.growth.absolute : null;
    return null;
  };

  if (field === "followers" || field === "growth") {
    for (const c of contestants) {
      const key = getNumericKey(c);
      if (key === null) withoutValue.push(c);
      else withValue.push(c);
    }
    withValue.sort((a, b) => (dirMultiplier * ((getNumericKey(a) ?? 0) - (getNumericKey(b) ?? 0))));
    return [...withValue, ...withoutValue];
  }

  const sorted = [...contestants];
  sorted.sort((a, b) => {
    if (field === "name") {
      return dirMultiplier * a.name.localeCompare(b.name);
    }
    if (field === "show") {
      const showA = showNameById.get(a.showId) ?? "";
      const showB = showNameById.get(b.showId) ?? "";
      return dirMultiplier * showA.localeCompare(showB);
    }
    if (field === "status") {
      return dirMultiplier * a.status.localeCompare(b.status);
    }
    return 0;
  });
  return sorted;
}
