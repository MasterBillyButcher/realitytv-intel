import type { Contestant, GrowthResult } from "@/types";

/**
 * Computes follower growth from the "before" baseline to the "current" reading.
 * Returns an unavailable result when either value is missing so the UI can
 * show an explicit unavailable state instead of a misleading number.
 */
export function calculateGrowth(contestant: Pick<Contestant, "followersBefore" | "followersCurrent">): GrowthResult {
  const { followersBefore, followersCurrent } = contestant;

  if (followersBefore === null || followersCurrent === null) {
    return { absolute: null, percent: null, available: false };
  }

  const absolute = followersCurrent - followersBefore;

  if (followersBefore === 0) {
    // Percentage change from a zero baseline is undefined; report absolute only.
    return { absolute, percent: null, available: true };
  }

  const percent = (absolute / followersBefore) * 100;
  return { absolute, percent, available: true };
}

export function formatGrowthPercent(growth: GrowthResult): string {
  if (!growth.available || growth.percent === null) {
    return "Unavailable";
  }
  const sign = growth.percent > 0 ? "+" : "";
  return `${sign}${growth.percent.toFixed(1)}%`;
}

export function formatGrowthAbsolute(growth: GrowthResult): string {
  if (!growth.available || growth.absolute === null) {
    return "Unavailable";
  }
  const sign = growth.absolute > 0 ? "+" : "";
  return `${sign}${growth.absolute.toLocaleString("en-US")}`;
}
