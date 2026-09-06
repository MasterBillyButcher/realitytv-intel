import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded">
          <span aria-hidden="true" className="flex h-7 w-7 items-end gap-[3px] rounded bg-ink-900 p-1">
            <span className="h-[40%] w-1 rounded-sm bg-accent-100" />
            <span className="h-[65%] w-1 rounded-sm bg-accent-400" />
            <span className="h-[95%] w-1 rounded-sm bg-accent-500" />
          </span>
          <span className="text-base font-semibold tracking-tight text-ink-900">RealityTV Intel</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm font-medium text-ink-700">
          <Link className="focus-ring rounded hover:text-ink-900" href="/rankings">
            Rankings
          </Link>
          <Link className="focus-ring rounded hover:text-ink-900" href="/#shows">
            Shows
          </Link>
          <Link className="focus-ring rounded hover:text-ink-900" href="/admin">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
