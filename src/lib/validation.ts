import { z } from "zod";

// Instagram usernames: letters, numbers, periods, underscores, 1-30 chars.
const INSTAGRAM_HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;

export function isValidInstagramHandle(handle: string): boolean {
  const cleaned = handle.trim().replace(/^@/, "");
  return INSTAGRAM_HANDLE_RE.test(cleaned) && !cleaned.includes("..");
}

export function normalizeInstagramHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

const isoDateOrNull = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
  .nullable();

export const followerSnapshotSchema = z.object({
  count: z.number().int().nonnegative(),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" }),
});

export const contestantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "other"]),
  status: z.enum(["active", "eliminated", "winner", "runner_up", "withdrawn"]),
  tier: z.enum(["A", "B", "C", "unranked"]),
  profession: z.string(),
  instagramHandle: z.string().refine(isValidInstagramHandle, { message: "Invalid Instagram handle" }),
  followersBefore: z.number().int().nonnegative().nullable(),
  beforeDate: isoDateOrNull,
  followersLast: z.number().int().nonnegative().nullable(),
  lastDate: isoDateOrNull,
  followersCurrent: z.number().int().nonnegative().nullable(),
  currentDate: isoDateOrNull,
  knownFor: z.string(),
  history: z.array(followerSnapshotSchema),
  photo: z.string().nullable(),
  bio: z.string(),
  show: z.string().min(1),
});

export const showSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  network: z.string().nullable(),
  season: z.string().nullable(),
  active: z.boolean(),
});

export const trackerDataSchema = z.object({
  version: z.number().int().nonnegative(),
  updatedAt: z.string(),
  shows: z.array(showSchema),
  contestants: z.array(contestantSchema),
});

export type ValidationIssue = { path: string; message: string };

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates a full tracker dataset before publish, including cross-references
 * between contestants and shows and duplicate-id checks the schema alone
 * cannot express.
 */
export function validateTrackerData(data: unknown): ValidationResult {
  const parsed = trackerDataSchema.safeParse(data);

  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const issues: ValidationIssue[] = [];
  const { shows, contestants } = parsed.data;
  const showIds = new Set(shows.map((s) => s.id));
  const seenContestantIds = new Set<string>();

  for (const contestant of contestants) {
    if (seenContestantIds.has(contestant.id)) {
      issues.push({ path: `contestants.${contestant.id}`, message: "Duplicate contestant id" });
    }
    seenContestantIds.add(contestant.id);

    if (!showIds.has(contestant.show)) {
      issues.push({
        path: `contestants.${contestant.id}.show`,
        message: `References unknown show "${contestant.show}"`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

/** Prevents a duplicate history entry from being recorded on the same date. */
export function shouldAppendHistoryEntry(
  history: { count: number; date: string }[],
  newDate: string
): boolean {
  const newDay = newDate.slice(0, 10);
  return !history.some((h) => h.date.slice(0, 10) === newDay);
}
