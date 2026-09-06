import type { Metadata } from "next";
import { loadTrackerData } from "@/lib/data";
import { rankContestants } from "@/lib/rankings";
import { TrackerExplorer } from "@/components/TrackerExplorer";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cross-show rankings"
};

export default async function RankingsPage() {
  const data = await loadTrackerData();
  const ranked = rankContestants(data.contestants);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink-900">Cross-show rankings</h1>
      <p className="mt-2 max-w-2xl text-ink-600">
        Every tracked contestant, ranked by real current Instagram follower count across all shows. Contestants
        without a recorded follower count are listed separately and are not assigned a rank.
      </p>
      <div className="mt-8">
        {ranked.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-300 p-8 text-center text-ink-500">
            No contestants have been published yet.
          </p>
        ) : (
          <TrackerExplorer contestants={ranked} shows={data.shows} />
        )}
      </div>
    </div>
  );
}
