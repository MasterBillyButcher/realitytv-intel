import { describe, expect, it } from "vitest";
import { applyFollowerReading } from "@/lib/followerUpdate";
import type { Contestant } from "@/types";

function baseContestant(overrides: Partial<Contestant> = {}): Contestant {
  return {
    id: "c1",
    name: "Test",
    gender: "unspecified",
    status: "active",
    tier: "unranked",
    profession: "",
    instagramHandle: "test",
    followersBefore: null,
    beforeDate: null,
    followersLast: null,
    lastDate: null,
    followersCurrent: null,
    currentDate: null,
    knownFor: "",
    bio: "",
    photo: "",
    showId: "show-1",
    history: [],
    ...overrides
  };
}

describe("applyFollowerReading", () => {
  it("sets followersBefore on the first-ever reading", () => {
    const result = applyFollowerReading(baseContestant(), { followers: 1000, fetchedAt: "2026-01-01T00:00:00.000Z" });
    expect(result.followersBefore).toBe(1000);
    expect(result.beforeDate).toBe("2026-01-01T00:00:00.000Z");
    expect(result.followersCurrent).toBe(1000);
    expect(result.followersLast).toBeNull();
    expect(result.history).toHaveLength(1);
  });

  it("shifts current into last on a subsequent reading and preserves before", () => {
    const first = applyFollowerReading(baseContestant(), { followers: 1000, fetchedAt: "2026-01-01T00:00:00.000Z" });
    const second = applyFollowerReading(first, { followers: 1200, fetchedAt: "2026-02-01T00:00:00.000Z" });

    expect(second.followersBefore).toBe(1000);
    expect(second.followersLast).toBe(1000);
    expect(second.lastDate).toBe("2026-01-01T00:00:00.000Z");
    expect(second.followersCurrent).toBe(1200);
    expect(second.history).toHaveLength(2);
  });

  it("does not create a duplicate history entry for the same day", () => {
    const first = applyFollowerReading(baseContestant(), { followers: 1000, fetchedAt: "2026-01-01T10:00:00.000Z" });
    const sameDay = applyFollowerReading(first, { followers: 1050, fetchedAt: "2026-01-01T18:00:00.000Z" });

    expect(sameDay.history).toHaveLength(1);
    expect(sameDay.history[0].followers).toBe(1050);
  });

  it("never estimates a value; it only records what it was given", () => {
    const result = applyFollowerReading(baseContestant(), { followers: 42, fetchedAt: "2026-01-01T00:00:00.000Z" });
    expect(result.followersCurrent).toBe(42);
    expect(result.history[0].source).toBe("apify");
  });
});
