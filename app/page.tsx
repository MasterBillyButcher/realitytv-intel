import Link from "next/link";
import { loadTrackerData, getShowNameMap } from "@/lib/data";
import { rankContestants } from "@/lib/rankings";
import { TrackerExplorer } from "@/components/TrackerExplorer";

export const revalidate = 0;

export default async function HomePage() {
  const data = await loadTrackerData();
  const showNameById = getShowNameMap(data);
  const ranked = rankContestants(data.contestants);
  const trackedCount = data.contestants.filter((c) => c.followersCurrent !== null).length;

  return (
    <div>
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-600">Reality television intelligence</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">
            Real Instagram follower data for reality television contestants
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-600">
            RealityTV Intel tracks contestants across KKK, Lock Upp, Alliance India, Traitors India, and Bigg Boss,
            recording their real Instagram follower counts over time so producers, journalists, and fans can see
            who is actually growing an audience during and after a season.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/rankings"
              className="focus-ring rounded-md bg-accent-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-700"
            >
              View cross-show rankings
            </Link>
            <Link
              href="/api/export?format=csv"
              className="focus-ring rounded-md border border-ink-300 px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              Export current data (CSV)
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-ink-100 pt-8 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Shows tracked</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink-900">{data.shows.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Contestants tracked</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink-900">{data.contestants.length}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">With live follower data</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink-900">{trackedCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-400">Data last published</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink-900">
                {data.publishedAt ? new Date(data.publishedAt).toLocaleDateString("en-US") : "Not yet published"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="shows" className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="font-serif text-2xl font-semibold text-ink-900">Shows</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.shows.map((show) => {
            const contestantCount = data.contestants.filter((c) => c.showId === show.id).length;
            return (
              <Link
                key={show.id}
                href={`/shows/${show.slug}`}
                className="focus-ring block rounded-md border border-ink-200 bg-white p-5 transition-colors hover:border-accent-400"
              >
                <p className="font-medium text-ink-900">{show.name}</p>
                <p className="mt-1 text-sm text-ink-500">
                  {contestantCount === 0 ? "No contestants published yet" : `${contestantCount} contestant${contestantCount === 1 ? "" : "s"}`}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-ink-900">All contestants</h2>
          <Link href="/rankings" className="focus-ring rounded text-sm font-medium text-accent-600 hover:underline">
            Full rankings
          </Link>
        </div>
        {ranked.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-300 p-8 text-center text-ink-500">
            No contestants have been published yet. Once the admin adds contestants and publishes, they will appear
            here with real follower data.
          </p>
        ) : (
          <TrackerExplorer contestants={ranked} shows={data.shows} />
        )}
      </section>
    </div>
  );
}
