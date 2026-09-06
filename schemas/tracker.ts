import { z } from "zod";

export const ContestantStatusSchema = z.enum([
  "active",
  "eliminated",
  "winner",
  "runner-up",
  "withdrawn",
  "unknown"
]);

export const ContestantGenderSchema = z.enum(["male", "female", "non-binary", "unspecified"]);

export const ContestantTierSchema = z.enum(["lead", "featured", "supporting", "guest", "unranked"]);

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Must be a valid ISO date" });

export const FollowerHistoryEntrySchema = z.object({
  date: isoDate,
  followers: z.number().int().nonnegative(),
  source: z.enum(["apify", "manual", "import"])
});

/** Instagram handles: letters, numbers, periods, underscores, 1-30 chars, no leading @ stored. */
export const instagramHandlePattern = /^[a-zA-Z0-9._]{1,30}$/;

export const ContestantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  gender: ContestantGenderSchema,
  status: ContestantStatusSchema,
  tier: ContestantTierSchema,
  profession: z.string().max(200).default(""),
  instagramHandle: z.string().regex(instagramHandlePattern, "Invalid Instagram handle").or(z.literal("")),
  followersBefore: z.number().int().nonnegative().nullable(),
  beforeDate: isoDate.nullable(),
  followersLast: z.number().int().nonnegative().nullable(),
  lastDate: isoDate.nullable(),
  followersCurrent: z.number().int().nonnegative().nullable(),
  currentDate: isoDate.nullable(),
  knownFor: z.string().max(500).default(""),
  bio: z.string().max(4000).default(""),
  photo: z.string().max(1000).default(""),
  showId: z.string().min(1),
  history: z.array(FollowerHistoryEntrySchema).default([])
});

export const ShowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  description: z.string().max(1000).default(""),
  active: z.boolean().default(true)
});

export const TrackerDataSchema = z
  .object({
    shows: z.array(ShowSchema).min(1),
    contestants: z.array(ContestantSchema),
    publishedAt: z.string().nullable()
  })
  .superRefine((data, ctx) => {
    const showIds = new Set(data.shows.map((s) => s.id));
    const seenContestantIds = new Set<string>();

    for (const [index, contestant] of data.contestants.entries()) {
      if (seenContestantIds.has(contestant.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate contestant id: ${contestant.id}`,
          path: ["contestants", index, "id"]
        });
      }
      seenContestantIds.add(contestant.id);

      if (!showIds.has(contestant.showId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Contestant ${contestant.id} references unknown showId: ${contestant.showId}`,
          path: ["contestants", index, "showId"]
        });
      }

      const historyDates = new Set<string>();
      for (const entry of contestant.history) {
        if (historyDates.has(entry.date)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate history entry date for ${contestant.id}: ${entry.date}`,
            path: ["contestants", index, "history"]
          });
        }
        historyDates.add(entry.date);
      }
    }

    const slugs = new Set<string>();
    for (const [index, show] of data.shows.entries()) {
      if (slugs.has(show.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate show slug: ${show.slug}`,
          path: ["shows", index, "slug"]
        });
      }
      slugs.add(show.slug);
    }
  });

export type ValidatedTrackerData = z.infer<typeof TrackerDataSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateTrackerData(data: unknown):
  | { ok: true; data: ValidatedTrackerData }
  | { ok: false; issues: ValidationIssue[] } {
  const result = TrackerDataSchema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

/** Row shape accepted by bulk import (CSV/JSON rows), matched by Instagram handle. */
export const BulkImportRowSchema = z.object({
  instagramHandle: z.string().regex(instagramHandlePattern, "Invalid Instagram handle"),
  name: z.string().min(1).optional(),
  showId: z.string().min(1).optional(),
  status: ContestantStatusSchema.optional(),
  gender: ContestantGenderSchema.optional(),
  tier: ContestantTierSchema.optional(),
  profession: z.string().optional(),
  knownFor: z.string().optional(),
  bio: z.string().optional(),
  photo: z.string().optional()
});

export type BulkImportRow = z.infer<typeof BulkImportRowSchema>;
