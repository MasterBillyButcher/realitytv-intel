import type { TrackerData } from "@/types";

const DRAFT_KEY = "rtvi-admin-draft-v1";

export interface Draft {
  data: TrackerData;
  baseSha: string | null;
  updatedAt: string; // ISO timestamp, used to protect newer edits
}

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

/**
 * Saves a draft, but refuses to overwrite a draft that was updated more
 * recently than the one being saved. This guards against an in-flight
 * stale write (for example from a slow tab) clobbering newer edits made
 * elsewhere.
 */
export function saveDraft(draft: Draft): { ok: true } | { ok: false; reason: "stale" | "storage_error" } {
  if (typeof window === "undefined") return { ok: false, reason: "storage_error" };
  const existing = loadDraft();
  if (existing && new Date(existing.updatedAt).getTime() > new Date(draft.updatedAt).getTime()) {
    return { ok: false, reason: "stale" };
  }
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage_error" };
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_KEY);
}
