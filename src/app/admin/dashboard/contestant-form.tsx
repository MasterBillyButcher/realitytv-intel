"use client";

import { useState } from "react";
import type { Contestant, Show } from "@/types/tracker";
import { isValidInstagramHandle, normalizeInstagramHandle } from "@/lib/validation";

const emptyContestant = (showId: string): Contestant => ({
  id: "",
  name: "",
  gender: "other",
  status: "active",
  tier: "unranked",
  profession: "",
  instagramHandle: "",
  followersBefore: null,
  beforeDate: null,
  followersLast: null,
  lastDate: null,
  followersCurrent: null,
  currentDate: null,
  knownFor: "",
  history: [],
  photo: null,
  bio: "",
  show: showId,
});

export function ContestantForm({
  shows,
  initial,
  onSave,
  onCancel,
}: {
  shows: Show[];
  initial?: Contestant;
  onSave: (contestant: Contestant) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Contestant>(initial ?? emptyContestant(shows[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.id.trim()) {
      setError("An id is required.");
      return;
    }
    if (!draft.name.trim()) {
      setError("A name is required.");
      return;
    }
    if (!isValidInstagramHandle(draft.instagramHandle)) {
      setError("Enter a valid Instagram handle.");
      return;
    }
    setError(null);
    onSave({ ...draft, instagramHandle: normalizeInstagramHandle(draft.instagramHandle) });
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Id
          <input
            className="input"
            value={draft.id}
            disabled={!!initial}
            onChange={(e) => setDraft({ ...draft, id: e.target.value.trim() })}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Show
          <select className="input" value={draft.show} onChange={(e) => setDraft({ ...draft, show: e.target.value })}>
            {shows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Instagram handle
          <input
            className="input"
            value={draft.instagramHandle}
            onChange={(e) => setDraft({ ...draft, instagramHandle: e.target.value })}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gender
          <select className="input" value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value as Contestant["gender"] })}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Contestant["status"] })}>
            <option value="active">Active</option>
            <option value="eliminated">Eliminated</option>
            <option value="winner">Winner</option>
            <option value="runner_up">Runner up</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tier
          <select className="input" value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as Contestant["tier"] })}>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
            <option value="unranked">Unranked</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Profession
          <input className="input" value={draft.profession} onChange={(e) => setDraft({ ...draft, profession: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Photo URL
          <input className="input" value={draft.photo ?? ""} onChange={(e) => setDraft({ ...draft, photo: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Known for
          <input className="input" value={draft.knownFor} onChange={(e) => setDraft({ ...draft, knownFor: e.target.value })} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Bio
        <textarea className="input" rows={3} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
      </label>

      <details>
        <summary className="text-sm cursor-pointer" style={{ color: "var(--ink-soft)" }}>
          Manual follower baseline (advanced, optional)
        </summary>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <label className="flex flex-col gap-1 text-sm">
            Followers before
            <input
              type="number"
              className="input"
              value={draft.followersBefore ?? ""}
              onChange={(e) => setDraft({ ...draft, followersBefore: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Before date
            <input
              type="date"
              className="input"
              value={draft.beforeDate?.slice(0, 10) ?? ""}
              onChange={(e) => setDraft({ ...draft, beforeDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </label>
        </div>
      </details>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn btn-primary">
          Save contestant
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
