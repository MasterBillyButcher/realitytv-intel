import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ink-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">RealityTV Intel</p>
            <p className="mt-2 text-sm text-ink-500">
              Follower tracking and editorial data for reality television contestants.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Tracker</p>
            <ul className="mt-2 space-y-2 text-sm text-ink-600">
              <li>
                <Link className="focus-ring rounded hover:text-ink-900" href="/rankings">
                  Cross-show rankings
                </Link>
              </li>
              <li>
                <Link className="focus-ring rounded hover:text-ink-900" href="/#shows">
                  Shows
                </Link>
              </li>
              <li>
                <Link className="focus-ring rounded hover:text-ink-900" href="/api/export?format=csv">
                  Export data (CSV)
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Legal</p>
            <ul className="mt-2 space-y-2 text-sm text-ink-600">
              <li>
                <Link className="focus-ring rounded hover:text-ink-900" href="/privacy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="focus-ring rounded hover:text-ink-900" href="/terms">
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-ink-100 pt-6 text-xs text-ink-400">
          Copyright {year} RealityTV Intel. Follower counts are retrieved from public Instagram profile data and may
          lag behind the live count on Instagram.
        </p>
      </div>
    </footer>
  );
}
