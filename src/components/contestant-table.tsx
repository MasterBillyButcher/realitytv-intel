"use client";

import type { Contestant } from "@/types/tracker";
import { contestantGrowth } from "@/lib/growth";

function formatCount(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatGrowth(contestant: Contestant): string {
  const growth = contestantGrowth(contestant);
  if (!growth.available || growth.absolute === null) return "Unavailable";
  const sign = growth.absolute > 0 ? "+" : "";
  const pct = growth.percent !== null ? ` (${sign}${growth.percent.toFixed(1)}%)` : "";
  return `${sign}${new Intl.NumberFormat("en-IN").format(growth.absolute)}${pct}`;
}

interface Props {
  contestants: Array<Contestant & { rank?: number | null }>;
  showRank?: boolean;
  showShowColumn?: boolean;
}

export function ContestantTable({ contestants, showRank = false, showShowColumn = true }: Props) {
  if (contestants.length === 0) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
        No contestants match the current search and filters.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b text-left" style={{ borderColor: "var(--line)" }}>
            {showRank && <th className="px-4 py-3 font-medium">Rank</th>}
            <th className="px-4 py-3 font-medium">Name</th>
            {showShowColumn && <th className="px-4 py-3 font-medium">Show</th>}
            <th className="px-4 py-3 font-medium">Instagram</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Followers</th>
            <th className="px-4 py-3 font-medium text-right">Growth</th>
          </tr>
        </thead>
        <tbody>
          {contestants.map((c) => (
            <tr key={c.id} className="border-b last:border-0" style={{ borderColor: "var(--line)" }}>
              {showRank && (
                <td className="px-4 py-3 font-[family-name:var(--font-mono)]">
                  {c.rank ?? "Unranked"}
                </td>
              )}
              <td className="px-4 py-3 font-medium">{c.name}</td>
              {showShowColumn && <td className="px-4 py-3">{c.show}</td>}
              <td className="px-4 py-3">
                <a
                  href={`https://instagram.com/${c.instagramHandle}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:underline"
                >
                  @{c.instagramHandle}
                </a>
              </td>
              <td className="px-4 py-3 capitalize">{c.status.replace("_", " ")}</td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)]">
                {formatCount(c.followersCurrent)}
              </td>
              <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)]">
                {formatGrowth(c)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
