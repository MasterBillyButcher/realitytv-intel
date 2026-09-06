import type { Contestant, FollowerHistoryEntry } from "@/types";

export interface FollowerReading {
  followers: number;
  fetchedAt: string; // ISO date-time
}

/**
 * Applies a freshly fetched follower reading to a contestant record:
 * - shifts the previous "current" reading into "last"
 * - sets the new reading as "current"
 * - sets "before" on the very first reading a contestant ever receives
 * - appends a history entry, unless one already exists for that exact date
 *   (prevents duplicate history entries from repeated refreshes on the same day)
 *
 * This function never invents or estimates a follower count; it only
 * records the value it was given.
 */
export function applyFollowerReading(contestant: Contestant, reading: FollowerReading): Contestant {
  const readingDate = reading.fetchedAt.slice(0, 10); // date portion for de-duplication
  const isFirstReading = contestant.followersCurrent === null;

  const newHistoryEntry: FollowerHistoryEntry = {
    date: reading.fetchedAt,
    followers: reading.followers,
    source: "apify"
  };

  const alreadyRecordedToday = contestant.history.some((entry) => entry.date.slice(0, 10) === readingDate);

  const history = alreadyRecordedToday
    ? contestant.history.map((entry) =>
        entry.date.slice(0, 10) === readingDate ? { ...entry, followers: reading.followers } : entry
      )
    : [...contestant.history, newHistoryEntry];

  return {
    ...contestant,
    followersBefore: isFirstReading ? reading.followers : contestant.followersBefore,
    beforeDate: isFirstReading ? reading.fetchedAt : contestant.beforeDate,
    followersLast: isFirstReading ? contestant.followersLast : contestant.followersCurrent,
    lastDate: isFirstReading ? contestant.lastDate : contestant.currentDate,
    followersCurrent: reading.followers,
    currentDate: reading.fetchedAt,
    history
  };
}
