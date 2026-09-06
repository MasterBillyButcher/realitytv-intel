import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t mt-16" style={{ borderColor: "var(--line)" }}>
      <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col gap-4 text-sm" style={{ color: "var(--ink-soft)" }}>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/tracker" className="hover:underline">
            Tracker
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms and Conditions
          </Link>
          <Link href="/contact" className="hover:underline">
            Contact
          </Link>
        </div>
        <p>Copyright {year} RealityTV Intel. All rights reserved.</p>
      </div>
    </footer>
  );
}
