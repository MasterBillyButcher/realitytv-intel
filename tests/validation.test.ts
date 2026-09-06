import { describe, it, expect } from "vitest";
import {
  isValidInstagramHandle,
  normalizeInstagramHandle,
  validateTrackerData,
  shouldAppendHistoryEntry,
} from "@/lib/validation";

describe("isValidInstagramHandle", () => {
  it("accepts a normal handle", () => {
    expect(isValidInstagramHandle("real.handle_99")).toBe(true);
  });

  it("accepts a handle with a leading @", () => {
    expect(isValidInstagramHandle("@real_handle")).toBe(true);
  });

  it("rejects spaces", () => {
    expect(isValidInstagramHandle("bad handle")).toBe(false);
  });

  it("rejects consecutive periods", () => {
    expect(isValidInstagramHandle("bad..handle")).toBe(false);
  });

  it("rejects a handle over 30 characters", () => {
    expect(isValidInstagramHandle("a".repeat(31))).toBe(false);
  });

  it("rejects an empty handle", () => {
    expect(isValidInstagramHandle("")).toBe(false);
  });
});

describe("normalizeInstagramHandle", () => {
  it("strips the leading @ and lowercases", () => {
    expect(normalizeInstagramHandle("@RealHandle")).toBe("realhandle");
  });
});

describe("validateTrackerData", () => {
  const validShow = { id: "bigg-boss", name: "Bigg Boss", network: null, season: null, active: true };
  const validContestant = {
    id: "c1",
    name: "Test",
    gender: "female" as const,
    status: "active" as const,
    tier: "A" as const,
    profession: "Actor",
    instagramHandle: "handle",
    followersBefore: null,
    beforeDate: null,
    followersLast: null,
    lastDate: null,
    followersCurrent: 1000,
    currentDate: "2026-01-01T00:00:00.000Z",
    knownFor: "",
    history: [],
    photo: null,
    bio: "",
    show: "bigg-boss",
  };

  it("accepts a well-formed dataset", () => {
    const result = validateTrackerData({
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      shows: [validShow],
      contestants: [validContestant],
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags a contestant referencing an unknown show", () => {
    const result = validateTrackerData({
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      shows: [validShow],
      contestants: [{ ...validContestant, show: "does-not-exist" }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("unknown show"))).toBe(true);
  });

  it("flags duplicate contestant ids", () => {
    const result = validateTrackerData({
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      shows: [validShow],
      contestants: [validContestant, validContestant],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });

  it("flags an invalid instagram handle", () => {
    const result = validateTrackerData({
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      shows: [validShow],
      contestants: [{ ...validContestant, instagramHandle: "bad handle" }],
    });
    expect(result.valid).toBe(false);
  });
});

describe("shouldAppendHistoryEntry", () => {
  it("allows the first entry", () => {
    expect(shouldAppendHistoryEntry([], "2026-01-01T00:00:00.000Z")).toBe(true);
  });

  it("blocks a duplicate entry for the same day", () => {
    const history = [{ count: 100, date: "2026-01-01T09:00:00.000Z" }];
    expect(shouldAppendHistoryEntry(history, "2026-01-01T18:00:00.000Z")).toBe(false);
  });

  it("allows an entry for a new day", () => {
    const history = [{ count: 100, date: "2026-01-01T09:00:00.000Z" }];
    expect(shouldAppendHistoryEntry(history, "2026-01-02T09:00:00.000Z")).toBe(true);
  });
});
