import { describe, expect, it } from "vitest";
import { filterContestants, searchContestants, sortContestants } from "@/lib/query";
import { rankContestants } from "@/lib/rankings";
import type { Contestant } from "@/types";

function makeContestant(overrides: Partial<Contestant>): Contestant {
  return {
    id: overrides.id ?? "c1",
    name: overrides.name ?? "Jane Doe",
    gender: "female",
    status: "active",
    tier: "unranked",
    profession: "Model",
    instagramHandle: "janedoe",
    followersBefore: 1000,
    beforeDate: "2026-01-01T00:00:00.000Z",
    followersLast: 1000,
    lastDate: "2026-01-01T00:00:00.000Z",
    followersCurrent: 1500,
    currentDate: "2026-02-01T00:00:00.000Z",
    knownFor: "Season one",
    bio: "",
    photo: "",
    showId: "show-1",
    history: [],
    ...overrides
  };
}

const showNameById = new Map([
  ["show-1", "Bigg Boss"],
  ["show-2", "Traitors India"]
]);

describe("searchContestants", () => {
  const contestants = rankContestants([
    makeContestant({ id: "a", name: "Jane Doe", instagramHandle: "janedoe" }),
    makeContestant({ id: "b", name: "John Smith", instagramHandle: "johnsmith", profession: "Actor", showId: "show-2" })
  ]);

  it("matches by name case-insensitively", () => {
    const result = searchContestants(contestants, "jane", showNameById);
    expect(result.map((c) => c.id)).toEqual(["a"]);
  });

  it("matches by Instagram handle", () => {
    const result = searchContestants(contestants, "johnsmith", showNameById);
    expect(result.map((c) => c.id)).toEqual(["b"]);
  });

  it("matches by show name", () => {
    const result = searchContestants(contestants, "traitors", showNameById);
    expect(result.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns all contestants for an empty query", () => {
    expect(searchContestants(contestants, "   ", showNameById)).toHaveLength(2);
  });
});

describe("filterContestants", () => {
  const contestants = rankContestants([
    makeContestant({ id: "a", showId: "show-1", status: "active", gender: "female", tier: "lead" }),
    makeContestant({ id: "b", showId: "show-2", status: "eliminated", gender: "male", tier: "guest" })
  ]);

  it("filters by show", () => {
    expect(filterContestants(contestants, { showId: "show-2" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("filters by status", () => {
    expect(filterContestants(contestants, { status: "eliminated" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("filters by gender and tier together", () => {
    expect(filterContestants(contestants, { gender: "female", tier: "lead" }).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("sortContestants", () => {
  it("sorts numerically by followers, not lexicographically", () => {
    const contestants = rankContestants([
      makeContestant({ id: "a", followersCurrent: 9000 }),
      makeContestant({ id: "b", followersCurrent: 15000 }),
      makeContestant({ id: "c", followersCurrent: 2000 })
    ]);
    const sorted = sortContestants(contestants, "followers", "desc", showNameById);
    expect(sorted.map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts contestants with missing follower values last regardless of direction", () => {
    const contestants = rankContestants([
      makeContestant({ id: "a", followersCurrent: null }),
      makeContestant({ id: "b", followersCurrent: 500 })
    ]);
    const desc = sortContestants(contestants, "followers", "desc", showNameById);
    const asc = sortContestants(contestants, "followers", "asc", showNameById);
    expect(desc[desc.length - 1].id).toBe("a");
    expect(asc[asc.length - 1].id).toBe("a");
  });

  it("sorts by name alphabetically", () => {
    const contestants = rankContestants([
      makeContestant({ id: "a", name: "Zoe" }),
      makeContestant({ id: "b", name: "Amy" })
    ]);
    const sorted = sortContestants(contestants, "name", "asc", showNameById);
    expect(sorted.map((c) => c.id)).toEqual(["b", "a"]);
  });
});
