"use client";

import type { ContestantFilters, SortDirection, SortField } from "@/lib/query";
import type { Show } from "@/types/tracker";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  filters: ContestantFilters;
  onFiltersChange: (filters: ContestantFilters) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  shows: Show[];
  showShowFilter?: boolean;
}

export function TrackerControls({
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  shows,
  showShowFilter = true,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-center mb-6">
      <input
        className="input max-w-xs"
        placeholder="Search name, handle, profession"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Search contestants"
      />

      {showShowFilter && (
        <select
          className="input max-w-[10rem]"
          value={filters.show ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, show: e.target.value || undefined })}
          aria-label="Filter by show"
        >
          <option value="">All shows</option>
          {shows.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <select
        className="input max-w-[10rem]"
        value={filters.status ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, status: (e.target.value || undefined) as ContestantFilters["status"] })
        }
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="eliminated">Eliminated</option>
        <option value="winner">Winner</option>
        <option value="runner_up">Runner up</option>
        <option value="withdrawn">Withdrawn</option>
      </select>

      <select
        className="input max-w-[10rem]"
        value={filters.gender ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, gender: (e.target.value || undefined) as ContestantFilters["gender"] })
        }
        aria-label="Filter by gender"
      >
        <option value="">All genders</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="other">Other</option>
      </select>

      <select
        className="input max-w-[10rem]"
        value={filters.tier ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, tier: (e.target.value || undefined) as ContestantFilters["tier"] })
        }
        aria-label="Filter by tier"
      >
        <option value="">All tiers</option>
        <option value="A">Tier A</option>
        <option value="B">Tier B</option>
        <option value="C">Tier C</option>
        <option value="unranked">Unranked</option>
      </select>

      <select
        className="input max-w-[12rem]"
        value={`${sortField}:${sortDirection}`}
        onChange={(e) => {
          const [field, direction] = e.target.value.split(":") as [SortField, SortDirection];
          onSortChange(field, direction);
        }}
        aria-label="Sort contestants"
      >
        <option value="followers:desc">Followers: high to low</option>
        <option value="followers:asc">Followers: low to high</option>
        <option value="growth:desc">Growth: high to low</option>
        <option value="growth:asc">Growth: low to high</option>
        <option value="name:asc">Name: A to Z</option>
        <option value="show:asc">Show: A to Z</option>
        <option value="status:asc">Status: A to Z</option>
      </select>
    </div>
  );
}
