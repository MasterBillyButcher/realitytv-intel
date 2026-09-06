import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { GrowthResult } from "@/types";
import { formatGrowthAbsolute, formatGrowthPercent } from "@/lib/growth";

export function GrowthBadge({ growth }: { growth: GrowthResult }) {
  if (!growth.available) {
    return <span className="text-sm text-ink-400">Unavailable</span>;
  }

  const direction = (growth.absolute ?? 0) > 0 ? "up" : (growth.absolute ?? 0) < 0 ? "down" : "flat";
  const colorClass =
    direction === "up" ? "text-signal-up" : direction === "down" ? "text-signal-down" : "text-ink-500";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${colorClass}`}>
      <Icon aria-hidden="true" size={14} />
      <span>
        {formatGrowthAbsolute(growth)}
        {growth.percent !== null ? ` (${formatGrowthPercent(growth)})` : ""}
      </span>
    </span>
  );
}
