import { describe, expect, it } from "vitest";
import { applyBulkImport } from "@/lib/bulkImport";
import type { Contestant } from "@/types";
import type { BulkImportRow } from "@/schemas/tracker";

function existingContestant(overrides: Partial<Contestant> = {}): Contestant {
  return {
    id: "c1",
    name: "Jane Doe",
    gender: "female",
    status: "active",
    tier: "unranked",
    profession: "Model",
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

describe("applyBulkImport", () => {
  it("updates an existing contestant matched by exact Instagram handle", () => {
    const existing = [existingContestant()];
    const rows: BulkImportRow[] = [{ instagramHandle: "janedoe", status: "eliminated" }];
    const outcome = applyBulkImport(existing, rows);
    expect(outcome.updatedCount).toBe(1);
    expect(outcome.createdCount).toBe(0);
    expect(outcome.contestants[0].status).toBe("eliminated");
    expect(outcome.contestants[0].name).toBe("Jane Doe");
  });

  it("does not touch unrelated existing records", () => {
    const existing = [existingContestant({ id: "c1", instagramHandle: "janedoe" }), existingContestant({ id: "c2", instagramHandle: "other", name: "Other Person" })];
    const rows: BulkImportRow[] = [{ instagramHandle: "janedoe", status: "eliminated" }];
    const outcome = applyBulkImport(existing, rows);
    const untouched = outcome.contestants.find((c) => c.id === "c2");
    expect(untouched?.name).toBe("Other Person");
    expect(untouched?.status).toBe("active");
  });

  it("creates a new contestant when the handle has no match and showId is provided", () => {
    const outcome = applyBulkImport([], [{ instagramHandle: "newperson", name: "New Person", showId: "show-2" }]);
    expect(outcome.createdCount).toBe(1);
    expect(outcome.contestants[0].showId).toBe("show-2");
  });

  it("skips creating a new contestant when showId is missing, without silently dropping the row", () => {
    const outcome = applyBulkImport([], [{ instagramHandle: "newperson", name: "New Person" }]);
    expect(outcome.createdCount).toBe(0);
    expect(outcome.skipped).toHaveLength(1);
    expect(outcome.skipped[0].handle).toBe("newperson");
  });

  it("matches handles case-insensitively but exactly otherwise", () => {
    const existing = [existingContestant({ instagramHandle: "JaneDoe" })];
    const outcome = applyBulkImport(existing, [{ instagramHandle: "janedoe", status: "winner" }]);
    expect(outcome.updatedCount).toBe(1);
    expect(outcome.contestants[0].status).toBe("winner");
  });
});
