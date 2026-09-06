"use client";

import { useState } from "react";
import type { Contestant, ContestantGender, ContestantStatus, ContestantTier, Show } from "@/types";
import { Button } from "@/components/Button";
import { isValidInstagramHandle, normalizeInstagramHandle } from "@/lib/instagram";

interface ContestantFormProps {
  shows: Show[];
  initial: Contestant | null;
  onCancel: () => void;
  onSave: (contestant: Contestant) => void;
}

function emptyContestant(showId: string): Contestant {
  return {
    id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    gender: "unspecified",
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
    bio: "",
    photo: "",
    showId,
    history: []
  };
}

export function ContestantForm({ shows, initial, onCancel, onSave }: ContestantFormProps) {
  const [form, setForm] = useState<Contestant>(initial ?? emptyContestant(shows[0]?.id ?? ""));
  const [handleError, setHandleError] = useState<string | null>(null);

  function update<K extends keyof Contestant>(key: K, value: Contestant[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.name.trim().length === 0) return;

    const normalizedHandle = normalizeInstagramHandle(form.instagramHandle);
    if (normalizedHandle.length > 0 && !isValidInstagramHandle(normalizedHandle)) {
      setHandleError("Enter a valid Instagram handle (letters, numbers, periods, underscores).");
      return;
    }
    setHandleError(null);
    onSave({ ...form, instagramHandle: normalizedHandle });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-ink-200 bg-white p-5">
      <h3 className="font-serif text-lg font-semibold text-ink-900">{initial ? "Edit contestant" : "Add contestant"}</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-name" className="block text-sm font-medium text-ink-700">
            Name
          </label>
          <input
            id="cf-name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="cf-show" className="block text-sm font-medium text-ink-700">
            Show
          </label>
          <select
            id="cf-show"
            value={form.showId}
            onChange={(e) => update("showId", e.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            {shows.map((show) => (
              <option key={show.id} value={show.id}>
                {show.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cf-handle" className="block text-sm font-medium text-ink-700">
            Instagram handle
          </label>
          <input
            id="cf-handle"
            value={form.instagramHandle}
            onChange={(e) => update("instagramHandle", e.target.value)}
            placeholder="username"
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
            aria-describedby={handleError ? "cf-handle-error" : undefined}
          />
          {handleError && (
            <p id="cf-handle-error" role="alert" className="mt-1 text-xs text-signal-down">
              {handleError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cf-status" className="block text-sm font-medium text-ink-700">
            Status
          </label>
          <select
            id="cf-status"
            value={form.status}
            onChange={(e) => update("status", e.target.value as ContestantStatus)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="eliminated">Eliminated</option>
            <option value="winner">Winner</option>
            <option value="runner-up">Runner-up</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label htmlFor="cf-gender" className="block text-sm font-medium text-ink-700">
            Gender
          </label>
          <select
            id="cf-gender"
            value={form.gender}
            onChange={(e) => update("gender", e.target.value as ContestantGender)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            <option value="unspecified">Unspecified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non-binary">Non-binary</option>
          </select>
        </div>

        <div>
          <label htmlFor="cf-tier" className="block text-sm font-medium text-ink-700">
            Tier
          </label>
          <select
            id="cf-tier"
            value={form.tier}
            onChange={(e) => update("tier", e.target.value as ContestantTier)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            <option value="unranked">Unranked</option>
            <option value="lead">Lead</option>
            <option value="featured">Featured</option>
            <option value="supporting">Supporting</option>
            <option value="guest">Guest</option>
          </select>
        </div>

        <div>
          <label htmlFor="cf-profession" className="block text-sm font-medium text-ink-700">
            Profession
          </label>
          <input
            id="cf-profession"
            value={form.profession}
            onChange={(e) => update("profession", e.target.value)}
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="cf-photo" className="block text-sm font-medium text-ink-700">
            Photo URL
          </label>
          <input
            id="cf-photo"
            value={form.photo}
            onChange={(e) => update("photo", e.target.value)}
            placeholder="/images/contestant.jpg"
            className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="cf-known-for" className="block text-sm font-medium text-ink-700">
          Known for
        </label>
        <input
          id="cf-known-for"
          value={form.knownFor}
          onChange={(e) => update("knownFor", e.target.value)}
          className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="cf-bio" className="block text-sm font-medium text-ink-700">
          Bio
        </label>
        <textarea
          id="cf-bio"
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
          rows={3}
          className="focus-ring mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit">Save contestant</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
