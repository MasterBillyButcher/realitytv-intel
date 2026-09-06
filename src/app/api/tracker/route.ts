import { NextResponse } from "next/server";
import trackerData from "@/data/tracker-data.json";

export const runtime = "nodejs";

/**
 * Serves the canonical, published tracker data. This reads the file that
 * was committed to the repository and deployed by Vercel, not a live
 * GitHub API call, so public page loads stay fast and never depend on
 * GitHub availability.
 */
export async function GET() {
  return NextResponse.json(trackerData);
}
