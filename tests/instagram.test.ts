import { describe, expect, it } from "vitest";
import { isValidInstagramHandle, normalizeInstagramHandle } from "@/lib/instagram";

describe("Instagram handle validation", () => {
  it("accepts a plain valid handle", () => {
    expect(isValidInstagramHandle("jane.doe_23")).toBe(true);
  });

  it("strips a leading @ before validating", () => {
    expect(normalizeInstagramHandle("@jane.doe")).toBe("jane.doe");
    expect(isValidInstagramHandle("@jane.doe")).toBe(true);
  });

  it("rejects an empty handle", () => {
    expect(isValidInstagramHandle("")).toBe(false);
    expect(isValidInstagramHandle("   ")).toBe(false);
  });

  it("rejects handles with spaces or invalid characters", () => {
    expect(isValidInstagramHandle("jane doe")).toBe(false);
    expect(isValidInstagramHandle("jane#doe")).toBe(false);
    expect(isValidInstagramHandle("jane/doe")).toBe(false);
  });

  it("rejects handles over 30 characters", () => {
    expect(isValidInstagramHandle("a".repeat(31))).toBe(false);
  });
});
