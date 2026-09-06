"use client";

import { useMemo, useState } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import type { RankedContestant, Show, SortDirection, SortField, TrackerFilters } from "@/types";
import { filterContestants, searchContestants, sortContestants } from "@/lib/query";
import { GrowthBadge } from "@/components/GrowthBadge";
import { StatusBadge } from "@/components/StatusBadge";

interface TrackerExplorerProps {
  contestants: RankedContestant[];
  shows: Show[];
  showFilterEnabled?: boolean;
}

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "followers", label: "Followers" },
  { field: "growth", label: "Growth" },
  { field: "name", label: "Name" },
  { field: "show", label: "Show" },
  { field: "status", label: "Status" }
];

export function TrackerExplorer({ contestants, shows, showFilterEnabled = true }: TrackerExplorerProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TrackerFilters>({});
  const [sortField, setSortField] = useState<SortField>("followers");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const showNameById = useMemo(() => new Map(shows.map((s) => [s.id, s.name])), [shows]);

  const results = useMemo(() => {
    const searched = searchContestants(contestants, query, showNameById);
    const filtered = filterContestants(searched, filters);
    return sortContestants(filtered, sortField, sortDirection, showNameById);
  }, [contestants, query, filters, sortField, sortDirection, showNameById]);

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-xs">
          <span className="sr-only">Search contestants</span>
          <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, handle, profession"
            className="focus-ring w-full rounded-md border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {showFilterEnabled && (
            <select
              aria-label="Filter by show"
              className="focus-ring rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-700"
              value={filters.showId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, showId: e.target.value || undefined }))}
            >
              <option value="">All shows</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filter by status"
            className="focus-ring rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-700"
            value={filters.status ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as TrackerFilters["status"] }))}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="eliminated">Eliminated</option>
            <option value="winner">Winner</option>
            <option value="runner-up">Runner-up</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select
            aria-label="Filter by gender"
            className="focus-ring rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-700"
            value={filters.gender ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, gender: (e.target.value || undefined) as TrackerFilters["gender"] }))}
          >
            <option value="">All genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non-binary">Non-binary</option>
          </select>
          <select
            aria-label="Filter by tier"
            className="focus-ring rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-700"
            value={filters.tier ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, tier: (e.target.value || undefined) as TrackerFilters["tier"] }))}
          >
            <option value="">All tiers</option>
            <option value="lead">Lead</option>
            <option value="featured">Featured</option>
            <option value="supporting">Supporting</option>
            <option value="guest">Guest</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-ink-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">
                Rank
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Contestant
              </th>
              {showFilterEnabled && (
                <th scope="col" className="px-3 py-3 font-medium">
                  Show
                </th>
              )}
              <th scope="col" className="px-3 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <button type="button" onClick={() => toggleSort("followers")} className="focus-ring inline-flex items-center gap-1 rounded">
                  Followers <ArrowUpDown aria-hidden="true" size={12} />
                </button>
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <button type="button" onClick={() => toggleSort("growth")} className="focus-ring inline-flex items-center gap-1 rounded">
                  Growth <ArrowUpDown aria-hidden="true" size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && (
              <tr>
                <td colSpan={showFilterEnabled ? 6 : 5} className="px-3 py-8 text-center text-ink-400">
                  No contestants match your search and filters.
                </td>
              </tr>
            )}
            {results.map((c) => (
              <tr key={c.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                <td className="px-3 py-3 text-ink-500">{c.rank ?? "\u2014"}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {c.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photo} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-200 text-xs font-medium text-ink-500" aria-hidden="true">
                        {c.name.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-ink-900">{c.name}</p>
                      {c.instagramHandle && (
                        <a
                          href={`https://instagram.com/${c.instagramHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring rounded text-xs text-ink-500 hover:text-accent-600"
                        >
                          @{c.instagramHandle}
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                {showFilterEnabled && <td className="px-3 py-3 text-ink-600">{showNameById.get(c.showId) ?? c.showId}</td>}
                <td className="px-3 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-3 py-3 font-medium text-ink-900">
                  {c.followersCurrent !== null ? c.followersCurrent.toLocaleString("en-US") : "Unavailable"}
                </td>
                <td className="px-3 py-3">
                  <GrowthBadge growth={c.growth} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
