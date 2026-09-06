import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/export/route";

describe("GET /api/export", () => {
  it("returns CSV by default with the expected header row", async () => {
    const response = await GET(new NextRequest("http://localhost/api/export"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    const text = await response.text();
    expect(text.split("\n")[0]).toContain("name");
    expect(text.split("\n")[0]).toContain("instagramHandle");
  });

  it("returns JSON when format=json is requested", async () => {
    const response = await GET(new NextRequest("http://localhost/api/export?format=json"));
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.contestants)).toBe(true);
  });

  it("produces the same output for the same input (deterministic)", async () => {
    const first = await (await GET(new NextRequest("http://localhost/api/export?format=json"))).json();
    const second = await (await GET(new NextRequest("http://localhost/api/export?format=json"))).json();
    expect(first.contestants).toEqual(second.contestants);
  });
});
