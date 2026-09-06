import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadTrackerData } from "@/lib/data";
import { rankContestants } from "@/lib/rankings";
import { TrackerExplorer } from "@/components/TrackerExplorer";

export const revalidate = 0;

interface ShowPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ShowPageProps): Promise<Metadata> {
  const data = await loadTrackerData();
  const show = data.shows.find((s) => s.slug === params.slug);
  return { title: show ? show.name : "Show not found" };
}

export default async function ShowPage({ params }: ShowPageProps) {
  const data = await loadTrackerData();
  const show = data.shows.find((s) => s.slug === params.slug);

  if (!show) {
    notFound();
  }

  const contestants = data.contestants.filter((c) => c.showId === show.id);
  const ranked = rankContestants(contestants);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink-900">{show.name}</h1>
      {show.description && <p className="mt-2 max-w-2xl text-ink-600">{show.description}</p>}
      <div className="mt-8">
        {ranked.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-300 p-8 text-center text-ink-500">
            No contestants have been published for this show yet.
          </p>
        ) : (
          <TrackerExplorer contestants={ranked} shows={data.shows} showFilterEnabled={false} />
        )}
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  const data = await loadTrackerData();
  return data.shows.map((show) => ({ slug: show.slug }));
}
