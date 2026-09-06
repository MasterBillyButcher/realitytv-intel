import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { TrackerData } from "@/types";
import { validateTrackerData } from "@/schemas/tracker";

const DATA_FILE_PATH = path.join(process.cwd(), "data", "data.json");

/**
 * Loads the canonical tracker dataset from the repository's data file.
 * This is the file that Publish Live writes to via the GitHub API; in the
 * deployed app it is read directly from the filesystem bundled at build
 * time (or on each request in dev), so the public tracker always reflects
 * whatever was last published.
 */
export async function loadTrackerData(): Promise<TrackerData> {
  const raw = await fs.readFile(DATA_FILE_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const validation = validateTrackerData(parsed);
  if (!validation.ok) {
    const details = validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
    throw new Error(`Canonical tracker data failed validation: ${details}`);
  }
  return validation.data;
}

export function getShowNameMap(data: TrackerData): Map<string, string> {
  return new Map(data.shows.map((show) => [show.id, show.name]));
}
