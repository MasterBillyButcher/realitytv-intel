"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Contestant } from "@/types/tracker";
import { applyFollowerRefresh } from "@/lib/refresh";
import { useTrackerDraft } from "./use-tracker-draft";
import { ContestantForm } from "./contestant-form";
import { BulkImportPanel } from "./bulk-import-panel";

type RefreshState = Record<string, "idle" | "refreshing" | "done" | "error">;

function saveStateLabel(state: string): string {
  switch (state) {
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved locally";
    case "save_failed":
      return "Save failed";
    default:
      return "Unsaved changes";
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshState, setRefreshState] = useState<RefreshState>({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const {
    data,
    setData,
    loading,
    loadError,
    reload,
    saveState,
    publishState,
    publishIssues,
    publishMessage,
    isDirty,
    staleBase,
    publish,
  } = useTrackerDraft();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch("/api/auth/session", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!json.authorized) {
          router.replace("/admin");
        } else {
          setSessionChecked(true);
        }
      })
      .catch(() => router.replace("/admin"))
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin");
  }

  const refreshHandles = useCallback(
    async (handles: string[]) => {
      if (handles.length === 0) return;
      setRefreshState((prev) => {
        const next = { ...prev };
        handles.forEach((h) => (next[h] = "refreshing"));
        return next;
      });

      try {
        const res = await fetch("/api/followers/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handles }),
        });
        const json = await res.json();

        if (!res.ok) {
          setRefreshState((prev) => {
            const next = { ...prev };
            handles.forEach((h) => (next[h] = "error"));
            return next;
          });
          return;
        }

        type Outcome = { handle: string; ok: boolean; followersCount?: number; fetchedAt?: string };
        const results = json.results as Outcome[];

        setData((current) => {
          let next = current;
          for (const result of results) {
            if (!result.ok || result.followersCount === undefined || !result.fetchedAt) continue;
            next = {
              ...next,
              contestants: next.contestants.map((c) =>
                c.instagramHandle === result.handle
                  ? applyFollowerRefresh(c, result.followersCount as number, result.fetchedAt as string)
                  : c
              ),
            };
          }
          return next;
        });

        setRefreshState((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.handle] = result.ok ? "done" : "error";
          }
          return next;
        });
      } catch {
        setRefreshState((prev) => {
          const next = { ...prev };
          handles.forEach((h) => (next[h] = "error"));
          return next;
        });
      }
    },
    [setData]
  );

  if (!sessionChecked || loading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-sm" style={{ color: "var(--ink-soft)" }}>
        Loading admin editor...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
          {loadError}
        </p>
        <button className="btn btn-secondary" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const editing = editingId ? data.contestants.find((c) => c.id === editingId) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="text-3xl">Admin editor</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {saveStateLabel(saveState)}
          </span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {staleBase && (
        <div className="card p-4 mb-6 text-sm" style={{ borderColor: "var(--danger)" }}>
          The published data has changed since your local draft was started. Your edits are kept below —
          review them before publishing so you do not overwrite the newer published change.
        </div>
      )}

      <div className="card p-5 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{isDirty ? "Publish required" : "Nothing to publish"}</p>
          {publishMessage && (
            <p
              className="text-sm mt-1"
              style={{ color: publishState === "published" ? "var(--success)" : "var(--danger)" }}
            >
              {publishMessage}
            </p>
          )}
          {publishIssues.length > 0 && (
            <ul className="text-sm mt-1" style={{ color: "var(--danger)" }}>
              {publishIssues.map((issue, i) => (
                <li key={i}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-3">
          {publishState === "conflict" && (
            <button className="btn btn-secondary" onClick={reload}>
              Reload latest and retry
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={publish}
            disabled={!isDirty || publishState === "publishing"}
          >
            {publishState === "publishing" ? "Publishing..." : "Publish live"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button className="btn btn-secondary" onClick={() => setShowAddForm(true)}>
          Add contestant
        </button>
        <button
          className="btn btn-secondary"
          disabled={refreshingAll}
          onClick={async () => {
            setRefreshingAll(true);
            await refreshHandles(data.contestants.map((c) => c.instagramHandle));
            setRefreshingAll(false);
          }}
        >
          {refreshingAll ? "Refreshing all..." : "Refresh all followers"}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-8">
          <ContestantForm
            shows={data.shows}
            onCancel={() => setShowAddForm(false)}
            onSave={(contestant) => {
              setData((current) => ({ ...current, contestants: [...current.contestants, contestant] }));
              setShowAddForm(false);
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 mb-10">
        {data.contestants.map((c) =>
          editing?.id === c.id ? (
            <ContestantForm
              key={c.id}
              shows={data.shows}
              initial={c}
              onCancel={() => setEditingId(null)}
              onSave={(updated) => {
                setData((current) => ({
                  ...current,
                  contestants: current.contestants.map((x) => (x.id === updated.id ? updated : x)),
                }));
                setEditingId(null);
              }}
            />
          ) : (
            <ContestantRow
              key={c.id}
              contestant={c}
              refreshState={refreshState[c.instagramHandle] ?? "idle"}
              confirmingDelete={confirmDeleteId === c.id}
              onEdit={() => setEditingId(c.id)}
              onRefresh={() => refreshHandles([c.instagramHandle])}
              onDeleteRequest={() => setConfirmDeleteId(c.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              onDeleteConfirm={() => {
                setData((current) => ({
                  ...current,
                  contestants: current.contestants.filter((x) => x.id !== c.id),
                }));
                setConfirmDeleteId(null);
              }}
            />
          )
        )}
        {data.contestants.length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            No contestants yet. Add one above, or use bulk import for status and profile updates once
            contestants exist.
          </p>
        )}
      </div>

      <h2 className="text-xl mb-3">Bulk import</h2>
      <BulkImportPanel
        contestants={data.contestants}
        onApply={(updated) => setData((current) => ({ ...current, contestants: updated }))}
      />
    </div>
  );
}

function ContestantRow({
  contestant,
  refreshState,
  confirmingDelete,
  onEdit,
  onRefresh,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
}: {
  contestant: Contestant;
  refreshState: "idle" | "refreshing" | "done" | "error";
  confirmingDelete: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  return (
    <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">{contestant.name}</p>
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          @{contestant.instagramHandle} · {contestant.show} ·{" "}
          {contestant.followersCurrent !== null
            ? new Intl.NumberFormat("en-IN").format(contestant.followersCurrent)
            : "No follower data"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {refreshState === "error" && (
          <span className="text-sm" style={{ color: "var(--danger)" }}>
            Refresh failed
          </span>
        )}
        <button className="btn btn-ghost" onClick={onRefresh} disabled={refreshState === "refreshing"}>
          {refreshState === "refreshing" ? "Refreshing..." : "Refresh followers"}
        </button>
        <button className="btn btn-secondary" onClick={onEdit}>
          Edit
        </button>
        {confirmingDelete ? (
          <>
            <span className="text-sm">Remove this contestant?</span>
            <button className="btn btn-danger" onClick={onDeleteConfirm}>
              Confirm
            </button>
            <button className="btn btn-ghost" onClick={onDeleteCancel}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-danger" onClick={onDeleteRequest}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
