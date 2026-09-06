import type { Contestant } from "@/types";
import type { BulkImportRow } from "@/schemas/tracker";

export interface BulkImportOutcome {
  contestants: Contestant[];
  updatedCount: number;
  createdCount: number;
  skipped: { handle: string; reason: string }[];
}

function makeId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Merges validated bulk import rows into the existing contestant list.
 * Matching is by exact Instagram handle. Existing records not referenced
 * by any row are left completely untouched. A row that would create a
 * new contestant without a showId is skipped, never silently guessed.
 */
export function applyBulkImport(existing: Contestant[], rows: BulkImportRow[]): BulkImportOutcome {
  const byHandle = new Map(existing.map((c) => [c.instagramHandle.toLowerCase(), c]));
  const skipped: BulkImportOutcome["skipped"] = [];
  let updatedCount = 0;
  let createdCount = 0;

  const result = [...existing];

  for (const row of rows) {
    const key = row.instagramHandle.toLowerCase();
    const match = byHandle.get(key);

    if (match) {
      const index = result.findIndex((c) => c.id === match.id);
      result[index] = {
        ...match,
        name: row.name ?? match.name,
        showId: row.showId ?? match.showId,
        status: row.status ?? match.status,
        gender: row.gender ?? match.gender,
        tier: row.tier ?? match.tier,
        profession: row.profession ?? match.profession,
        knownFor: row.knownFor ?? match.knownFor,
        bio: row.bio ?? match.bio,
        photo: row.photo ?? match.photo
      };
      updatedCount++;
      continue;
    }

    if (!row.showId) {
      skipped.push({ handle: row.instagramHandle, reason: "New contestant requires a showId." });
      continue;
    }

    const created: Contestant = {
      id: makeId(),
      name: row.name ?? row.instagramHandle,
      gender: row.gender ?? "unspecified",
      status: row.status ?? "active",
      tier: row.tier ?? "unranked",
      profession: row.profession ?? "",
      instagramHandle: row.instagramHandle,
      followersBefore: null,
      beforeDate: null,
      followersLast: null,
      lastDate: null,
      followersCurrent: null,
      currentDate: null,
      knownFor: row.knownFor ?? "",
      bio: row.bio ?? "",
      photo: row.photo ?? "",
      showId: row.showId,
      history: []
    };
    result.push(created);
    byHandle.set(key, created);
    createdCount++;
  }

  return { contestants: result, updatedCount, createdCount, skipped };
}
