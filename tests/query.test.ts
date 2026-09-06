import { describe, it, expect } from "vitest";
import { searchContestants, filterContestants, sortContestants, rankContestants } from "@/lib/query";
import type { Contestant } from "@/types/tracker";

function makeContestant(overrides: Partial<Contestant>): Contestant {
  return {
    id: overrides.id ?? "c1",
    name: "Test",
    gender: "other",
    status: "active",
    tier: "unranked",
    profession: "Actor",
    instagramHandle: "handle",
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

const dataset: Contestant[] = [
  makeContestant({ id: "1", name: "Aisha Khan", instagramHandle: "aisha.khan", profession: "Actor", show: "bigg-boss", followersCurrent: 50000, gender: "female", status: "active", tier: "A" }),
  makeContestant({ id: "2", name: "Rohit Verma", instagramHandle: "rohitv", profession: "Model", show: "kkk", followersCurrent: 120000, gender: "male", status: "eliminated", tier: "B" }),
  makeContestant({ id: "3", name: "No Followers Yet", instagramHandle: "newbie", profession: "Singer", show: "kkk", followersCurrent: null, gender: "female", status: "active", tier: "C" }),
];

describe("searchContestants", () => {
  it("matches by name case-insensitively", () => {
    const result = searchContestants(dataset, "aisha");
    expect(result.map((c) => c.id)).toEqual(["1"]);
  });

  it("matches by instagram handle", () => {
    const result = searchContestants(dataset, "rohitv");
    expect(result.map((c) => c.id)).toEqual(["2"]);
  });

  it("matches by profession", () => {
    const result = searchContestants(dataset, "singer");
    expect(result.map((c) => c.id)).toEqual(["3"]);
  });

  it("returns all contestants for an empty query", () => {
    expect(searchContestants(dataset, "")).toHaveLength(3);
  });

  it("returns no results for a non-matching query", () => {
    expect(searchContestants(dataset, "zzz-nomatch")).toHaveLength(0);
  });
});

describe("filterContestants", () => {
  it("filters by show", () => {
    const result = filterContestants(dataset, { show: "kkk" });
    expect(result.map((c) => c.id).sort()).toEqual(["2", "3"]);
  });

  it("filters by status", () => {
    const result = filterContestants(dataset, { status: "eliminated" });
    expect(result.map((c) => c.id)).toEqual(["2"]);
  });

  it("combines multiple filters", () => {
    const result = filterContestants(dataset, { show: "kkk", gender: "female" });
    expect(result.map((c) => c.id)).toEqual(["3"]);
  });
});

describe("sortContestants", () => {
  it("sorts by followers descending with nulls last", () => {
    const result = sortContestants(dataset, "followers", "desc");
    expect(result.map((c) => c.id)).toEqual(["2", "1", "3"]);
  });

  it("sorts by followers ascending with nulls still last", () => {
    const result = sortContestants(dataset, "followers", "asc");
    expect(result.map((c) => c.id)).toEqual(["1", "2", "3"]);
  });

  it("sorts by name alphabetically", () => {
    const result = sortContestants(dataset, "name", "asc");
    expect(result.map((c) => c.name)).toEqual(["Aisha Khan", "No Followers Yet", "Rohit Verma"]);
  });
});

describe("rankContestants", () => {
  it("ranks only contestants with real follower counts, in order", () => {
    const ranked = rankContestants(dataset);
    const withRank = ranked.filter((c) => c.rank !== null);
    expect(withRank.map((c) => c.id)).toEqual(["2", "1"]);
    expect(withRank.map((c) => c.rank)).toEqual([1, 2]);
  });

  it("leaves contestants without a follower count unranked", () => {
    const ranked = rankContestants(dataset);
    const unranked = ranked.find((c) => c.id === "3");
    expect(unranked?.rank).toBeNull();
  });
});
