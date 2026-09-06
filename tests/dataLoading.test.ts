import { describe, expect, it } from "vitest";
import { loadTrackerData, getShowNameMap } from "@/lib/data";

describe("loadTrackerData", () => {
  it("loads and validates the canonical data file without throwing", async () => {
    const data = await loadTrackerData();
    expect(Array.isArray(data.shows)).toBe(true);
    expect(Array.isArray(data.contestants)).toBe(true);
  });

  it("includes the five shows named in the project brief", async () => {
    const data = await loadTrackerData();
    const names = data.shows.map((s) => s.name).sort();
    expect(names).toEqual(["Alliance India", "Bigg Boss", "KKK", "Lock Upp", "Traitors India"].sort());
  });

  it("builds a show id to name lookup map", async () => {
    const data = await loadTrackerData();
    const map = getShowNameMap(data);
    expect(map.get("bigg-boss")).toBe("Bigg Boss");
  });
});
