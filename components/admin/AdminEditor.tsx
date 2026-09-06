"use client";

import { useEffect, useRef, useState } from "react";
import type { Contestant, TrackerData } from "@/types";
import { Button } from "@/components/Button";
import { ContestantForm } from "@/components/admin/ContestantForm";
import { BulkImportPanel } from "@/components/admin/BulkImportPanel";
import { fetchPublishedData, publishData, refreshFollowers } from "@/lib/adminApi";
import { loadDraft, saveDraft, clearDraft } from "@/lib/draftStorage";
import { applyFollowerReading } from "@/lib/followerUpdate";
import { applyBulkImport } from "@/lib/bulkImport";
import { validateTrackerData } from "@/schemas/tracker";
import { StatusBadge } from "@/components/StatusBadge";

type LoadState = "loading" | "ready" | "load_failed";
type SaveState = "saved" | "unsaved" | "saving" | "publish_required" | "save_failed";
type PublishState = "idle" | "publishing" | "success" | "failed";

const AUTOSAVE_DEBOUNCE_MS = 800;

export function AdminEditor({ onLogout }: { onLogout: () => void }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<TrackerData | null>(null);
  const [baseSha, setBaseSha] = useState<string | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const [editing, setEditing] = useState<Contestant | "new" | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState<string>("");

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const published = await fetchPublishedData();
        const draft = loadDraft();
        setBaseSha(published.sha);
        setPublishedSnapshot(JSON.stringify(published.data));

        if (draft && new Date(draft.updatedAt).getTime() > 0) {
          setData(draft.data);
          setSaveState(JSON.stringify(draft.data) === JSON.stringify(published.data) ? "saved" : "publish_required");
        } else {
          setData(published.data);
          setSaveState("saved");
        }
        setLoadState("ready");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load tracker data.");
        setLoadState("load_failed");
      }
    })();
  }, []);

  function updateData(updater: (current: TrackerData) => TrackerData) {
    setData((current) => {
      if (!current) return current;
      const next = updater(current);
      scheduleAutosave(next);
      return next;
    });
  }

  function scheduleAutosave(next: TrackerData) {
    setSaveState("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const result = saveDraft({ data: next, baseSha, updatedAt: new Date().toISOString() });
      if (!result.ok) {
        setSaveState("save_failed");
        return;
      }
      setSaveState(publishedSnapshot === JSON.stringify(next) ? "saved" : "publish_required");
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function handleSaveContestant(contestant: Contestant) {
    updateData((current) => {
      const exists = current.contestants.some((c) => c.id === contestant.id);
      const contestants = exists
        ? current.contestants.map((c) => (c.id === contestant.id ? contestant : c))
        : [...current.contestants, contestant];
      return { ...current, contestants };
    });
    setEditing(null);
  }

  function handleDelete(contestant: Contestant) {
    const confirmed = window.confirm(`Remove ${contestant.name}? This cannot be undone after you publish.`);
    if (!confirmed) return;
    updateData((current) => ({
      ...current,
      contestants: current.contestants.filter((c) => c.id !== contestant.id)
    }));
  }

  async function handleRefresh(targets: Contestant[]) {
    const validTargets = targets.filter((c) => c.instagramHandle.length > 0);
    if (validTargets.length === 0) return;
    setRefreshingIds((prev) => new Set([...prev, ...validTargets.map((c) => c.id)]));
    try {
      const response = await refreshFollowers(
        validTargets.map((c) => ({ contestantId: c.id, instagramHandle: c.instagramHandle }))
      );
      updateData((current) => {
        let contestants = current.contestants;
        for (const result of response.results) {
          if (!result.ok || result.followers === undefined) continue;
          contestants = contestants.map((c) =>
            c.id === result.contestantId
              ? applyFollowerReading(c, { followers: result.followers as number, fetchedAt: new Date().toISOString() })
              : c
          );
        }
        return { ...current, contestants };
      });
      const failures = response.results.filter((r) => !r.ok);
      if (failures.length > 0) {
        setPublishMessage(`${failures.length} refresh(es) failed: ${failures.map((f) => f.error).join("; ")}`);
      } else {
        setPublishMessage(null);
      }
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        validTargets.forEach((c) => next.delete(c.id));
        return next;
      });
    }
  }

  function handleBulkApply(rows: Parameters<typeof applyBulkImport>[1]) {
    updateData((current) => {
      const outcome = applyBulkImport(current.contestants, rows);
      setPublishMessage(
        `Bulk import: ${outcome.updatedCount} updated, ${outcome.createdCount} created${
          outcome.skipped.length > 0 ? `, ${outcome.skipped.length} skipped` : ""
        }.`
      );
      return { ...current, contestants: outcome.contestants };
    });
    setShowBulkImport(false);
  }

  async function handlePublish() {
    if (!data) return;
    const validation = validateTrackerData(data);
    if (!validation.ok) {
      setPublishState("failed");
      setPublishMessage(`Data failed validation: ${validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
      return;
    }

    setPublishState("publishing");
    setPublishMessage(null);
    try {
      const result = await publishData(data, baseSha, "Publish live: update tracker data");
      setPublishState("success");
      setPublishMessage(`Published successfully. Commit: ${result.commitSha.slice(0, 7)}`);
      setPublishedSnapshot(JSON.stringify(data));
      setSaveState("saved");
      clearDraft();
    } catch (error) {
      setPublishState("failed");
      setPublishMessage(error instanceof Error ? error.message : "Publish failed unexpectedly.");
    }
  }

  if (loadState === "loading") {
    return <div className="mx-auto max-w-4xl px-5 py-16 text-center text-ink-500">Loading tracker data...</div>;
  }

  if (loadState === "load_failed" || !data) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-signal-down">{loadError}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const visibleContestants = showFilter ? data.contestants.filter((c) => c.showId === showFilter) : data.contestants;

  const saveStateLabel: Record<SaveState, string> = {
    saved: "Saved locally",
    unsaved: "Unsaved changes",
    saving: "Saving...",
    publish_required: "Publish required",
    save_failed: "Save failed"
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 pb-5">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink-900">Admin workspace</h1>
          <p className="mt-1 text-sm text-ink-500">
            Save state: <span className="font-medium text-ink-700">{saveStateLabel[saveState]}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => handleRefresh(data.contestants)} disabled={refreshingIds.size > 0}>
            Refresh all followers
          </Button>
          <Button onClick={handlePublish} disabled={publishState === "publishing"}>
            {publishState === "publishing" ? "Publishing..." : "Publish Live"}
          </Button>
          <Button variant="ghost" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>

      {publishMessage && (
        <p role="status" className={`mt-4 text-sm ${publishState === "failed" ? "text-signal-down" : "text-signal-up"}`}>
          {publishMessage}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Filter by show"
          value={showFilter}
          onChange={(e) => setShowFilter(e.target.value)}
          className="focus-ring rounded-md border border-ink-300 px-3 py-2 text-sm"
        >
          <option value="">All shows</option>
          {data.shows.map((show) => (
            <option key={show.id} value={show.id}>
              {show.name}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          {showFilter && (
            <Button
              variant="secondary"
              onClick={() => handleRefresh(data.contestants.filter((c) => c.showId === showFilter))}
              disabled={refreshingIds.size > 0}
            >
              Refresh this show
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowBulkImport((v) => !v)}>
            Bulk import
          </Button>
          <Button onClick={() => setEditing("new")}>Add contestant</Button>
        </div>
      </div>

      {showBulkImport && (
        <div className="mt-4">
          <BulkImportPanel onApply={handleBulkApply} onClose={() => setShowBulkImport(false)} />
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <ContestantForm
            shows={data.shows}
            initial={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={handleSaveContestant}
          />
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-md border border-ink-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Show
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Followers
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleContestants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-400">
                  No contestants yet. Add one or use bulk import.
                </td>
              </tr>
            )}
            {visibleContestants.map((c) => (
              <tr key={c.id} className="border-b border-ink-100 last:border-0">
                <td className="px-3 py-3 font-medium text-ink-900">{c.name || "(unnamed)"}</td>
                <td className="px-3 py-3 text-ink-600">{data.shows.find((s) => s.id === c.showId)?.name ?? c.showId}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-3 py-3 text-ink-700">
                  {c.followersCurrent !== null ? c.followersCurrent.toLocaleString("en-US") : "Unavailable"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleRefresh([c])}
                      disabled={refreshingIds.has(c.id) || c.instagramHandle.length === 0}
                    >
                      {refreshingIds.has(c.id) ? "Refreshing..." : "Refresh"}
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(c)}>
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
