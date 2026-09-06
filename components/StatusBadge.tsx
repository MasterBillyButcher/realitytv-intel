import type { ContestantStatus } from "@/types";

const LABELS: Record<ContestantStatus, string> = {
  active: "Active",
  eliminated: "Eliminated",
  winner: "Winner",
  "runner-up": "Runner-up",
  withdrawn: "Withdrawn",
  unknown: "Unknown"
};

const STYLES: Record<ContestantStatus, string> = {
  active: "bg-signal-up/10 text-signal-up border-signal-up/30",
  eliminated: "bg-ink-100 text-ink-500 border-ink-300",
  winner: "bg-accent-100 text-accent-700 border-accent-400",
  "runner-up": "bg-accent-100 text-accent-600 border-accent-400",
  withdrawn: "bg-signal-down/10 text-signal-down border-signal-down/30",
  unknown: "bg-ink-100 text-ink-500 border-ink-300"
};

export function StatusBadge({ status }: { status: ContestantStatus }) {
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
