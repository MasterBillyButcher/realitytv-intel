import { describe, it, expect } from "vitest";
import { calculateGrowth, contestantGrowth, contestantRecentGrowth } from "@/lib/growth";
import type { Contestant } from "@/types/tracker";

function makeContestant(overrides: Partial<Contestant> = {}): Contestant {
  return {
    id: "c1",
    name: "Test Contestant",
    gender: "other",
    status: "active",
    tier: "unranked",
    profession: "Actor",
    instagramHandle: "testhandle",
    followersBefore: null,
    beforeDate: null,
    followersLast: null,
    lastDate: null,
    followersCurrent: null,
    currentDate: null,
    knownFor: "",
    history: [],
    photo: null,
    bio: "",
    show: "bigg-boss",
    ...overrides,
  };
}

describe("calculateGrowth", () => {
  it("returns unavailable when baseline is missing", () => {
    const result = calculateGrowth(null, 1000);
    expect(result.available).toBe(false);
    expect(result.absolute).toBeNull();
    expect(result.percent).toBeNull();
  });

  it("returns unavailable when current is missing", () => {
    const result = calculateGrowth(1000, null);
    expect(result.available).toBe(false);
  });

  it("computes absolute and percent change correctly", () => {
    const result = calculateGrowth(1000, 1200);
    expect(result.available).toBe(true);
    expect(result.absolute).toBe(200);
    expect(result.percent).toBeCloseTo(20);
  });

  it("handles negative growth", () => {
    const result = calculateGrowth(1000, 800);
    expect(result.absolute).toBe(-200);
    expect(result.percent).toBeCloseTo(-20);
  });

  it("avoids a misleading percent when baseline is zero", () => {
    const result = calculateGrowth(0, 500);
    expect(result.available).toBe(true);
    expect(result.absolute).toBe(500);
    expect(result.percent).toBeNull();
  });
});

describe("contestantGrowth", () => {
  it("uses followersBefore as baseline when present", () => {
    const c = makeContestant({ followersBefore: 100, followersLast: 150, followersCurrent: 200 });
    const result = contestantGrowth(c);
    expect(result.absolute).toBe(100);
  });

  it("falls back to followersLast when no before value exists", () => {
    const c = makeContestant({ followersBefore: null, followersLast: 150, followersCurrent: 200 });
    const result = contestantGrowth(c);
    expect(result.absolute).toBe(50);
  });

  it("is unavailable with no baseline at all", () => {
    const c = makeContestant({ followersBefore: null, followersLast: null, followersCurrent: 200 });
    const result = contestantGrowth(c);
    expect(result.available).toBe(false);
  });
});

describe("contestantRecentGrowth", () => {
  it("only compares last vs current, ignoring before", () => {
    const c = makeContestant({ followersBefore: 50, followersLast: 150, followersCurrent: 200 });
    const result = contestantRecentGrowth(c);
    expect(result.absolute).toBe(50);
  });
});
