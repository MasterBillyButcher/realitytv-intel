"use client";

import { useMemo, useState } from "react";
import type { Contestant, Show } from "@/types/tracker";
import { searchContestants, filterContestants, sortContestants, rankContestants } from "@/lib/query";
import type { ContestantFilters, SortDirection, SortField } from "@/lib/query";
import { TrackerControls } from "@/components/tracker-controls";
import { ContestantTable } from "@/components/contestant-table";

export function ShowClient({ show, contestants }: { show: Show; contestants: Contestant[] }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ContestantFilters>({});
  const [sortField, setSortField] = useState<SortField>("followers");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const results = useMemo(() => {
    let list = searchContestants(contestants, query);
    list = filterContestants(list, filters);
    const ranked = rankContestants(list);
    return sortContestants(ranked, sortField, sortDirection);
  }, [contestants, query, filters, sortField, sortDirection]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl mb-2">{show.name}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--ink-soft)" }}>
        {contestants.length === 0
          ? "No contestants have been published for this show yet."
          : `${contestants.length} contestants, ranked by real current follower counts.`}
      </p>

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
        shows={[show]}
        showShowFilter={false}
      />

      <ContestantTable contestants={results} showRank showShowColumn={false} />
    </div>
  );
}
