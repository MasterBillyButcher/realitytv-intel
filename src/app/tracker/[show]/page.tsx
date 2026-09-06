import { notFound } from "next/navigation";
import trackerData from "@/data/tracker-data.json";
import type { TrackerData } from "@/types/tracker";
import { ShowClient } from "./show-client";

const data = trackerData as TrackerData;

export function generateStaticParams() {
  return data.shows.map((show) => ({ show: show.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ show: string }> }) {
  const { show: showId } = await params;
  const show = data.shows.find((s) => s.id === showId);
  return { title: show ? `${show.name} — RealityTV Intel` : "Show not found — RealityTV Intel" };
}

export default async function ShowPage({ params }: { params: Promise<{ show: string }> }) {
  const { show: showId } = await params;
  const show = data.shows.find((s) => s.id === showId);
  if (!show) notFound();

  const contestants = data.contestants.filter((c) => c.show === showId);
  return <ShowClient show={show} contestants={contestants} />;
}
