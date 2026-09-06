import type { Contestant } from "@/types/tracker";
import { shouldAppendHistoryEntry } from "@/lib/validation";

/**
 * Applies a newly fetched follower count to a contestant.
 *
 * - followersBefore/beforeDate are set only once, from the first-ever
 *   recorded value, and are never overwritten afterward.
 * - followersLast/lastDate capture the previous "current" value so recent
 *   growth can still be measured after this update.
 * - followersCurrent/currentDate become the new value.
 * - A history entry is appended unless one already exists for the same day.
 */
export function applyFollowerRefresh(
  contestant: Contestant,
  newCount: number,
  fetchedAt: string
): Contestant {
  const hadNoPriorValue = contestant.followersCurrent === null;

  const updated: Contestant = {
    ...contestant,
    followersBefore: contestant.followersBefore === null ? contestant.followersCurrent ?? newCount : contestant.followersBefore,
    beforeDate:
      contestant.beforeDate === null
        ? contestant.currentDate ?? fetchedAt
        : contestant.beforeDate,
    followersLast: hadNoPriorValue ? contestant.followersLast : contestant.followersCurrent,
    lastDate: hadNoPriorValue ? contestant.lastDate : contestant.currentDate,
    followersCurrent: newCount,
    currentDate: fetchedAt,
    history: contestant.history,
  };

  if (shouldAppendHistoryEntry(contestant.history, fetchedAt)) {
    updated.history = [...contestant.history, { count: newCount, date: fetchedAt }];
  }

  return updated;
}
