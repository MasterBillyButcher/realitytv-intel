"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrackerData } from "@/types/tracker";
import { validateTrackerData, type ValidationIssue } from "@/lib/validation";

const DRAFT_KEY = "rti_admin_draft_v1";

type SaveState = "unsaved" | "saving" | "saved" | "save_failed";
type PublishState = "idle" | "publishing" | "published" | "publish_required" | "publish_failed" | "conflict";

interface DraftEnvelope {
  baseSha: string;
  data: TrackerData;
  savedAt: string;
}

interface LoadResult {
  loading: boolean;
  error: string | null;
}

export function useTrackerDraft() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [baseSha, setBaseSha] = useState<string | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadResult>({ loading: true, error: null });
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishIssues, setPublishIssues] = useState<ValidationIssue[]>([]);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [staleBase, setStaleBase] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFromServer = useCallback(async () => {
    setLoad({ loading: true, error: null });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch("/api/admin/data", { signal: controller.signal });
      const json = await res.json();
      if (!res.ok) {
        setLoad({ loading: false, error: json.error ?? "Could not load tracker data." });
        return;
      }

      const remoteData = json.data as TrackerData;
      const remoteSha = json.sha as string;

      let draft: DraftEnvelope | null = null;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        draft = raw ? (JSON.parse(raw) as DraftEnvelope) : null;
      } catch {
        draft = null;
      }

      if (draft && draft.baseSha === remoteSha) {
        setData(draft.data);
        setBaseSha(remoteSha);
        setStaleBase(false);
      } else if (draft && draft.baseSha !== remoteSha) {
        // The published file changed since this draft was started. Keep the
        // local edits (never silently discard them) but flag it so the
        // admin reviews before publishing over someone else's change.
        setData(draft.data);
        setBaseSha(remoteSha);
        setStaleBase(true);
      } else {
        setData(remoteData);
        setBaseSha(remoteSha);
        setStaleBase(false);
      }

      setPublishedSnapshot(JSON.stringify(remoteData));
      setLoad({ loading: false, error: null });
    } catch {
      setLoad({ loading: false, error: "Could not reach the server. Check your connection and try again." });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    // loadFromServer only sets state inside its async fetch continuations,
    // not synchronously during this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromServer();
  }, [loadFromServer]);

  const persistDraft = useCallback(
    (next: TrackerData, sha: string) => {
      setSaveState("saving");
      try {
        const envelope: DraftEnvelope = { baseSha: sha, data: next, savedAt: new Date().toISOString() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
        setSaveState("saved");
      } catch {
        setSaveState("save_failed");
      }
    },
    []
  );

  const updateData = useCallback(
    (updater: (current: TrackerData) => TrackerData) => {
      setData((current) => {
        if (!current || !baseSha) return current;
        const next = updater(current);
        setSaveState("unsaved");
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persistDraft(next, baseSha), 400);
        return next;
      });
    },
    [baseSha, persistDraft]
  );

  const isDirty = data !== null && publishedSnapshot !== null && JSON.stringify(data) !== publishedSnapshot;

  const publish = useCallback(async () => {
    if (!data || !baseSha) return;

    const validation = validateTrackerData(data);
    if (!validation.valid) {
      setPublishState("publish_required");
      setPublishIssues(validation.issues);
      setPublishMessage("Fix validation issues before publishing.");
      return;
    }

    setPublishState("publishing");
    setPublishIssues([]);
    setPublishMessage(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, expectedSha: baseSha }),
        signal: controller.signal,
      });
      const json = await res.json();

      if (res.status === 409) {
        setPublishState("conflict");
        setPublishMessage(json.error ?? "The data changed since you loaded it. Reload and reapply your edit.");
        return;
      }
      if (!res.ok) {
        setPublishState("publish_failed");
        setPublishMessage(json.error ?? "Publish failed.");
        return;
      }

      setPublishState("published");
      setPublishMessage(`Published successfully (${(json.commitSha as string).slice(0, 7)}).`);
      setPublishedSnapshot(JSON.stringify(data));
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Non-fatal: the next load will still treat this as the new base.
      }
      await loadFromServer();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setPublishState("publish_failed");
        setPublishMessage("Publish timed out. Check your connection and try again.");
      } else {
        setPublishState("publish_failed");
        setPublishMessage("Unexpected error while publishing.");
      }
    } finally {
      clearTimeout(timeout);
    }
  }, [data, baseSha, loadFromServer]);

  return {
    data,
    setData: updateData,
    loading: load.loading,
    loadError: load.error,
    reload: loadFromServer,
    saveState,
    publishState,
    publishIssues,
    publishMessage,
    isDirty,
    staleBase,
    publish,
  };
}
