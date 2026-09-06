import trackerData from "@/data/tracker-data.json";
import { TrackerClient } from "./tracker-client";
import type { TrackerData } from "@/types/tracker";

export const metadata = {
  title: "Tracker — RealityTV Intel",
};

export default function TrackerPage() {
  return <TrackerClient data={trackerData as TrackerData} />;
}
