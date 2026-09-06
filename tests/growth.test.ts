import { describe, expect, it } from "vitest";
import { calculateGrowth, formatGrowthAbsolute, formatGrowthPercent } from "@/lib/growth";

describe("calculateGrowth", () => {
  it("returns unavailable when followersBefore is missing", () => {
    const result = calculateGrowth({ followersBefore: null, followersCurrent: 1000 });
    expect(result.available).toBe(false);
    expect(result.absolute).toBeNull();
    expect(result.percent).toBeNull();
  });

  it("returns unavailable when followersCurrent is missing", () => {
    const result = calculateGrowth({ followersBefore: 1000, followersCurrent: null });
    expect(result.available).toBe(false);
  });

  it("calculates absolute and percent growth correctly", () => {
    const result = calculateGrowth({ followersBefore: 1000, followersCurrent: 1200 });
    expect(result.available).toBe(true);
    expect(result.absolute).toBe(200);
    expect(result.percent).toBeCloseTo(20, 5);
  });

  it("calculates negative growth correctly", () => {
    const result = calculateGrowth({ followersBefore: 1000, followersCurrent: 800 });
    expect(result.absolute).toBe(-200);
    expect(result.percent).toBeCloseTo(-20, 5);
  });

  it("returns absolute-only when baseline is zero to avoid a misleading percentage", () => {
    const result = calculateGrowth({ followersBefore: 0, followersCurrent: 500 });
    expect(result.available).toBe(true);
    expect(result.absolute).toBe(500);
    expect(result.percent).toBeNull();
  });

  it("formats growth strings with explicit sign and unavailable state", () => {
    const positive = calculateGrowth({ followersBefore: 1000, followersCurrent: 1100 });
    expect(formatGrowthAbsolute(positive)).toBe("+100");
    expect(formatGrowthPercent(positive)).toBe("+10.0%");

    const unavailable = calculateGrowth({ followersBefore: null, followersCurrent: null });
    expect(formatGrowthAbsolute(unavailable)).toBe("Unavailable");
    expect(formatGrowthPercent(unavailable)).toBe("Unavailable");
  });
});
