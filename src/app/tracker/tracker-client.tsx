"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TrackerData } from "@/types/tracker";
import { searchContestants, filterContestants, sortContestants, rankContestants } from "@/lib/query";
import type { ContestantFilters, SortDirection, SortField } from "@/lib/query";
import { TrackerControls } from "@/components/tracker-controls";
import { ContestantTable } from "@/components/contestant-table";

export function TrackerClient({ data }: { data: TrackerData }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ContestantFilters>({});
  const [sortField, setSortField] = useState<SortField>("followers");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const results = useMemo(() => {
    let list = searchContestants(data.contestants, query);
    list = filterContestants(list, filters);
    const ranked = rankContestants(list);
    return sortContestants(ranked, sortField, sortDirection);
  }, [data.contestants, query, filters, sortField, sortDirection]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl mb-2">Cross-show tracker</h1>
      <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
        Rankings use real current follower counts only. Contestants without a recorded count are shown as
        unranked.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {data.shows.map((show) => (
          <Link key={show.id} href={`/tracker/${show.id}`} className="btn btn-secondary !py-1.5 !px-3 text-sm">
            {show.name}
          </Link>
        ))}
      </div>

      <TrackerControls
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFiltersChange={setFilters}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={(f, d) => {
          setSortField(f);
          setSortDirection(d);
        }}
        shows={data.shows}
      />

      <ContestantTable contestants={results} showRank />
    </div>
  );
}
