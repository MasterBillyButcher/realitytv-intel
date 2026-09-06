import { describe, expect, it } from "vitest";
import { rankContestants } from "@/lib/rankings";
import type { Contestant } from "@/types";

function makeContestant(overrides: Partial<Contestant>): Contestant {
  return {
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Test Contestant",
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

describe("rankContestants", () => {
  it("ranks contestants by descending current follower count", () => {
    const contestants = [
      makeContestant({ id: "a", followersCurrent: 500 }),
      makeContestant({ id: "b", followersCurrent: 2000 }),
      makeContestant({ id: "c", followersCurrent: 1000 })
    ];
    const ranked = rankContestants(contestants);
    expect(ranked.map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(ranked.map((c) => c.rank)).toEqual([1, 2, 3]);
  });

  it("assigns null rank to contestants with no known follower count and sorts them last", () => {
    const contestants = [
      makeContestant({ id: "a", followersCurrent: null }),
      makeContestant({ id: "b", followersCurrent: 1000 })
    ];
    const ranked = rankContestants(contestants);
    expect(ranked[0].id).toBe("b");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].id).toBe("a");
    expect(ranked[1].rank).toBeNull();
  });

  it("never fabricates a follower count for ranking purposes", () => {
    const contestants = [makeContestant({ id: "a", followersCurrent: null })];
    const ranked = rankContestants(contestants);
    expect(ranked[0].followersCurrent).toBeNull();
  });
});
