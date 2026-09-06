import { describe, expect, it } from "vitest";
import { validateTrackerData } from "@/schemas/tracker";
import type { Contestant, Show, TrackerData } from "@/types";

function validShow(overrides: Partial<Show> = {}): Show {
  return { id: "show-1", name: "Bigg Boss", slug: "bigg-boss", description: "", active: true, ...overrides };
}

function validContestant(overrides: Partial<Contestant> = {}): Contestant {
  return {
    id: "c1",
    name: "Jane Doe",
    gender: "female",
    status: "active",
    tier: "unranked",
    profession: "",
    instagramHandle: "janedoe",
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

function validData(overrides: Partial<TrackerData> = {}): TrackerData {
  return { shows: [validShow()], contestants: [validContestant()], publishedAt: null, ...overrides };
}

describe("validateTrackerData", () => {
  it("accepts a minimal valid dataset", () => {
    const result = validateTrackerData(validData());
    expect(result.ok).toBe(true);
  });

  it("rejects a contestant referencing an unknown showId", () => {
    const result = validateTrackerData(validData({ contestants: [validContestant({ showId: "does-not-exist" })] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.message.includes("unknown showId"))).toBe(true);
  });

  it("rejects duplicate contestant ids", () => {
    const result = validateTrackerData(
      validData({ contestants: [validContestant({ id: "dup" }), validContestant({ id: "dup" })] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.message.includes("Duplicate contestant id"))).toBe(true);
  });

  it("rejects an invalid Instagram handle", () => {
    const result = validateTrackerData(validData({ contestants: [validContestant({ instagramHandle: "bad handle!" })] }));
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = validateTrackerData(validData({ contestants: [validContestant({ currentDate: "not-a-date" })] }));
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate history entries for the same date", () => {
    const contestant = validContestant({
      history: [
        { date: "2026-01-01T00:00:00.000Z", followers: 100, source: "manual" },
        { date: "2026-01-01T00:00:00.000Z", followers: 200, source: "manual" }
      ]
    });
    const result = validateTrackerData(validData({ contestants: [contestant] }));
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate show slugs", () => {
    const result = validateTrackerData(
      validData({ shows: [validShow({ id: "s1", slug: "same" }), validShow({ id: "s2", slug: "same" })] })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects completely malformed input without throwing", () => {
    const result = validateTrackerData({ nonsense: true });
    expect(result.ok).toBe(false);
  });
});
