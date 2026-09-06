import type { Contestant, RankedContestant } from "@/types";
import { calculateGrowth } from "@/lib/growth";

/**
 * Ranks contestants by current follower count, descending.
 * Contestants with no known current follower count receive rank = null
 * and are sorted to the end, since a rank cannot be assigned without real data.
 */
export function rankContestants(contestants: Contestant[]): RankedContestant[] {
  const withKnownFollowers = contestants.filter((c) => c.followersCurrent !== null);
  const withoutKnownFollowers = contestants.filter((c) => c.followersCurrent === null);

  const sorted = [...withKnownFollowers].sort(
    (a, b) => (b.followersCurrent ?? 0) - (a.followersCurrent ?? 0)
  );

  const ranked: RankedContestant[] = sorted.map((contestant, index) => ({
    ...contestant,
    rank: index + 1,
    growth: calculateGrowth(contestant)
  }));

  const unranked: RankedContestant[] = withoutKnownFollowers.map((contestant) => ({
    ...contestant,
    rank: null,
    growth: calculateGrowth(contestant)
  }));

  return [...ranked, ...unranked];
}
