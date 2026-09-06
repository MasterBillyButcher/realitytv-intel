import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--paper)" }}>
      <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-lg font-semibold">RealityTV Intel</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/tracker" className="hover:underline">
            Tracker
          </Link>
          <Link href="/admin" className="btn btn-secondary !py-1.5 !px-3 text-sm">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
