import { describe, it, expect } from "vitest";
import { applyFollowerRefresh } from "@/lib/refresh";
import type { Contestant } from "@/types/tracker";

function makeContestant(overrides: Partial<Contestant> = {}): Contestant {
  return {
    id: "c1",
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

describe("applyFollowerRefresh", () => {
  it("sets followersBefore on the very first refresh", () => {
    const c = makeContestant();
    const updated = applyFollowerRefresh(c, 1000, "2026-01-01T00:00:00.000Z");
    expect(updated.followersBefore).toBe(1000);
    expect(updated.beforeDate).toBe("2026-01-01T00:00:00.000Z");
    expect(updated.followersCurrent).toBe(1000);
    expect(updated.currentDate).toBe("2026-01-01T00:00:00.000Z");
  });

  it("appends a history entry on the first refresh", () => {
    const c = makeContestant();
    const updated = applyFollowerRefresh(c, 1000, "2026-01-01T00:00:00.000Z");
    expect(updated.history).toEqual([{ count: 1000, date: "2026-01-01T00:00:00.000Z" }]);
  });

  it("shifts current into last on a second refresh, without touching before", () => {
    const first = applyFollowerRefresh(makeContestant(), 1000, "2026-01-01T00:00:00.000Z");
    const second = applyFollowerRefresh(first, 1200, "2026-01-02T00:00:00.000Z");

    expect(second.followersBefore).toBe(1000);
    expect(second.beforeDate).toBe("2026-01-01T00:00:00.000Z");
    expect(second.followersLast).toBe(1000);
    expect(second.lastDate).toBe("2026-01-01T00:00:00.000Z");
    expect(second.followersCurrent).toBe(1200);
    expect(second.currentDate).toBe("2026-01-02T00:00:00.000Z");
  });

  it("never overwrites followersBefore after it is first set", () => {
    const first = applyFollowerRefresh(makeContestant(), 1000, "2026-01-01T00:00:00.000Z");
    const second = applyFollowerRefresh(first, 1200, "2026-01-02T00:00:00.000Z");
    const third = applyFollowerRefresh(second, 900, "2026-01-03T00:00:00.000Z");

    expect(third.followersBefore).toBe(1000);
    expect(third.beforeDate).toBe("2026-01-01T00:00:00.000Z");
    expect(third.followersLast).toBe(1200);
    expect(third.followersCurrent).toBe(900);
  });

  it("does not append a second history entry for a refresh on the same day", () => {
    const first = applyFollowerRefresh(makeContestant(), 1000, "2026-01-01T09:00:00.000Z");
    const second = applyFollowerRefresh(first, 1050, "2026-01-01T18:00:00.000Z");

    expect(second.history).toHaveLength(1);
    // The stored history value reflects the first refresh of the day; the
    // second same-day refresh still updates followersCurrent though.
    expect(second.followersCurrent).toBe(1050);
  });

  it("appends a new history entry for a refresh on a new day", () => {
    const first = applyFollowerRefresh(makeContestant(), 1000, "2026-01-01T09:00:00.000Z");
    const second = applyFollowerRefresh(first, 1050, "2026-01-02T09:00:00.000Z");

    expect(second.history).toHaveLength(2);
  });
});
