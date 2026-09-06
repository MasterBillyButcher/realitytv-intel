import type { Contestant, GrowthResult } from "@/types/tracker";

/**
 * Calculates follower growth between a baseline and the current count.
 * Returns an unavailable result when either value is missing so the UI
 * can show an explicit unavailable state instead of a misleading number.
 */
export function calculateGrowth(baseline: number | null, current: number | null): GrowthResult {
  if (baseline === null || current === null || baseline === undefined || current === undefined) {
    return { absolute: null, percent: null, available: false };
  }

  const absolute = current - baseline;

  if (baseline === 0) {
    // Cannot compute a meaningful percentage change from a zero baseline.
    return { absolute, percent: null, available: true };
  }

  const percent = (absolute / baseline) * 100;
  return { absolute, percent, available: true };
}

/**
 * Growth since the contestant's earliest recorded value (followersBefore),
 * falling back to followersLast if no "before" baseline exists.
 */
export function contestantGrowth(contestant: Contestant): GrowthResult {
  const baseline = contestant.followersBefore ?? contestant.followersLast;
  return calculateGrowth(baseline, contestant.followersCurrent);
}

/** Growth since the last recorded refresh only (short-term movement). */
export function contestantRecentGrowth(contestant: Contestant): GrowthResult {
  return calculateGrowth(contestant.followersLast, contestant.followersCurrent);
}
