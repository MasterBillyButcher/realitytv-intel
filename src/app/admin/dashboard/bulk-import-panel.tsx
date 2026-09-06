"use client";

import { useState } from "react";
import type { Contestant } from "@/types/tracker";
import { isValidInstagramHandle, normalizeInstagramHandle } from "@/lib/validation";

interface ImportRow {
  instagramHandle: string;
  [key: string]: unknown;
}

export function BulkImportPanel({
  contestants,
  onApply,
}: {
  contestants: Contestant[];
  onApply: (updated: Contestant[]) => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ matched: number; skipped: number } | null>(null);

  function handleValidateAndApply() {
    setErrors([]);
    setPreview(null);

    let rows: ImportRow[];
    try {
      rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("Expected a JSON array.");
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Invalid JSON."]);
      return;
    }

    const rowErrors: string[] = [];
    let matched = 0;
    let skipped = 0;

    const byHandle = new Map(contestants.map((c) => [normalizeInstagramHandle(c.instagramHandle), c]));
    const updated = [...contestants];

    rows.forEach((row, index) => {
      if (typeof row.instagramHandle !== "string" || !isValidInstagramHandle(row.instagramHandle)) {
        rowErrors.push(`Row ${index + 1}: missing or invalid instagramHandle.`);
        skipped += 1;
        return;
      }
      const handle = normalizeInstagramHandle(row.instagramHandle);
      const existing = byHandle.get(handle);
      if (!existing) {
        rowErrors.push(`Row ${index + 1}: no existing contestant with handle "${handle}". Add new contestants individually.`);
        skipped += 1;
        return;
      }

      const idx = updated.findIndex((c) => c.id === existing.id);
      // Only apply known, safe fields — never let an import row overwrite
      // unrelated records or inject arbitrary keys into the dataset.
      const allowedFields: (keyof Contestant)[] = ["name", "profession", "knownFor", "bio", "photo", "status", "tier"];
      const patch: Partial<Contestant> = {};
      for (const field of allowedFields) {
        if (field in row) {
          (patch as Record<string, unknown>)[field] = row[field];
        }
      }
      updated[idx] = { ...updated[idx], ...patch };
      matched += 1;
    });

    setErrors(rowErrors);
    setPreview({ matched, skipped });

    if (matched > 0) {
      onApply(updated);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        Paste a JSON array of updates. Each row must include <code>instagramHandle</code> to match an
        existing contestant. Only name, profession, known for, bio, photo, status, and tier can be updated
        this way; follower counts are only ever set by a real refresh.
      </p>
      <textarea
        className="input font-[family-name:var(--font-mono)]"
        rows={8}
        placeholder='[{"instagramHandle": "example", "status": "eliminated"}]'
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {errors.length > 0 && (
        <ul className="text-sm" style={{ color: "var(--danger)" }}>
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {preview && (
        <p className="text-sm" style={{ color: "var(--success)" }}>
          Applied {preview.matched} update(s) to the local draft. {preview.skipped} row(s) skipped.
        </p>
      )}
      <button type="button" className="btn btn-secondary self-start" onClick={handleValidateAndApply}>
        Validate and apply
      </button>
    </div>
  );
}
