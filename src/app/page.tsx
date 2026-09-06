import Link from "next/link";
import trackerData from "@/data/tracker-data.json";

export default function HomePage() {
  const showCount = trackerData.shows.length;
  const contestantCount = trackerData.contestants.length;

  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-14">
        <h1 className="text-4xl md:text-5xl max-w-2xl font-normal">
          Real Instagram follower numbers for Indian reality television contestants.
        </h1>
        <p className="mt-5 max-w-xl text-lg" style={{ color: "var(--ink-soft)" }}>
          RealityTV Intel tracks contestants across {showCount} shows, recording their Instagram handles,
          follower counts, and follower growth over time, pulled directly from Instagram rather than
          estimated.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/tracker" className="btn btn-primary">
            Open the tracker
          </Link>
          <Link href="/admin" className="btn btn-secondary">
            Admin login
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 border-t" style={{ borderColor: "var(--line)" }}>
        <h2 className="text-2xl mb-6">What the tracker provides</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-2">Follower tracking</h3>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Each contestant&apos;s current follower count is pulled from Instagram on refresh, alongside
              the earliest and most recent prior counts, so growth is measured against real data.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-2">Show and cross-show rankings</h3>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Contestants are ranked within their show and across all tracked shows, using current follower
              counts only. A contestant with no recorded count is shown as unranked rather than guessed.
            </p>
          </div>
          <div className="card p-5">
            <h3 className="text-base font-semibold mb-2">Search, filter, and sort</h3>
            <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
              Find contestants by name, Instagram handle, profession, or show, and narrow results by status,
              gender, or tier.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 border-t" style={{ borderColor: "var(--line)" }}>
        <h2 className="text-2xl mb-4">Currently tracked</h2>
        <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
          {contestantCount === 0
            ? "Contestant records have not been published yet."
            : `${contestantCount} contestants across ${showCount} shows.`}
        </p>
        <ul className="flex flex-wrap gap-2">
          {trackerData.shows.map((show) => (
            <li key={show.id} className="card px-3 py-1.5 text-sm">
              {show.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
