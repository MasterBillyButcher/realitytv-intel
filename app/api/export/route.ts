import { NextRequest, NextResponse } from "next/server";
import { loadTrackerData, getShowNameMap } from "@/lib/data";
import { rankContestants } from "@/lib/rankings";
import { formatGrowthAbsolute, formatGrowthPercent } from "@/lib/growth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_COLUMNS = [
  "rank",
  "name",
  "show",
  "instagramHandle",
  "status",
  "tier",
  "gender",
  "profession",
  "followersCurrent",
  "currentDate",
  "growthAbsolute",
  "growthPercent"
] as const;

function toCsvValue(value: string | number | null): string {
  const str = value === null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const showId = request.nextUrl.searchParams.get("showId") ?? undefined;

  let data;
  try {
    data = await loadTrackerData();
  } catch {
    return NextResponse.json({ ok: false, error: "data_unavailable", message: "Tracker data could not be loaded." }, { status: 500 });
  }

  const showNameById = getShowNameMap(data);
  const contestants = showId ? data.contestants.filter((c) => c.showId === showId) : data.contestants;
  const ranked = rankContestants(contestants);

  if (format === "json") {
    const payload = ranked.map((c) => ({
      rank: c.rank,
      name: c.name,
      show: showNameById.get(c.showId) ?? c.showId,
      instagramHandle: c.instagramHandle,
      status: c.status,
      tier: c.tier,
      gender: c.gender,
      profession: c.profession,
      followersCurrent: c.followersCurrent,
      currentDate: c.currentDate,
      growthAbsolute: c.growth.available ? c.growth.absolute : null,
      growthPercent: c.growth.available ? c.growth.percent : null
    }));
    return NextResponse.json({ ok: true, exportedAt: new Date().toISOString(), contestants: payload });
  }

  const rows = ranked.map((c) =>
    [
      c.rank,
      c.name,
      showNameById.get(c.showId) ?? c.showId,
      c.instagramHandle,
      c.status,
      c.tier,
      c.gender,
      c.profession,
      c.followersCurrent,
      c.currentDate,
      formatGrowthAbsolute(c.growth),
      formatGrowthPercent(c.growth)
    ]
      .map(toCsvValue)
      .join(",")
  );

  const csv = [CSV_COLUMNS.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realitytv-intel-export.csv"`
    }
  });
}
