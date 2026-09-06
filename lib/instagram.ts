import { instagramHandlePattern } from "@/schemas/tracker";

export function normalizeInstagramHandle(rawHandle: string): string {
  return rawHandle.trim().replace(/^@/, "");
}

export function isValidInstagramHandle(handle: string): boolean {
  const normalized = normalizeInstagramHandle(handle);
  return normalized.length > 0 && instagramHandlePattern.test(normalized);
}
