"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { BulkImportRowSchema, type BulkImportRow } from "@/schemas/tracker";
import { normalizeInstagramHandle } from "@/lib/instagram";

interface ParsedRowResult {
  row: number;
  ok: boolean;
  data?: BulkImportRow;
  error?: string;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = (cells[i] ?? "").trim();
    });
    return record;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseRows(text: string): unknown[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return parseCsv(trimmed);
}

interface BulkImportPanelProps {
  onApply: (rows: BulkImportRow[]) => void;
  onClose: () => void;
}

export function BulkImportPanel({ onApply, onClose }: BulkImportPanelProps) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<ParsedRowResult[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleValidate() {
    setParseError(null);
    let rawRows: unknown[];
    try {
      rawRows = parseRows(text);
    } catch {
      setParseError("Could not parse the pasted data. Provide valid CSV (with a header row) or a JSON array.");
      setResults(null);
      return;
    }

    if (rawRows.length === 0) {
      setParseError("No rows found.");
      setResults(null);
      return;
    }

    const validated = rawRows.map((row, index) => {
      const parsed = BulkImportRowSchema.safeParse(row);
      if (parsed.success) {
        return { row: index + 1, ok: true, data: { ...parsed.data, instagramHandle: normalizeInstagramHandle(parsed.data.instagramHandle) } };
      }
      return { row: index + 1, ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    });
    setResults(validated);
  }

  const validRows = (results ?? []).filter((r): r is ParsedRowResult & { ok: true; data: BulkImportRow } => r.ok && !!r.data);
  const invalidRows = (results ?? []).filter((r) => !r.ok);

  return (
    <div className="rounded-md border border-ink-200 bg-white p-5">
      <h3 className="font-serif text-lg font-semibold text-ink-900">Bulk import</h3>
      <p className="mt-1 text-sm text-ink-500">
        Paste CSV (with a header row of instagramHandle, name, showId, status, gender, tier, profession, knownFor,
        bio, photo) or a JSON array of the same fields. Rows are matched to existing contestants by exact Instagram
        handle; unmatched handles create new contestants.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder="instagramHandle,name,showId,status&#10;janedoe,Jane Doe,bigg-boss,active"
        className="focus-ring mt-3 w-full rounded-md border border-ink-300 px-3 py-2 font-mono text-xs"
      />
      {parseError && (
        <p role="alert" className="mt-2 text-sm text-signal-down">
          {parseError}
        </p>
      )}

      <div className="mt-3 flex gap-3">
        <Button type="button" variant="secondary" onClick={handleValidate} disabled={text.trim().length === 0}>
          Validate
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {results && (
        <div className="mt-4">
          <p className="text-sm text-ink-600">
            {validRows.length} valid row{validRows.length === 1 ? "" : "s"}, {invalidRows.length} invalid row
            {invalidRows.length === 1 ? "" : "s"}.
          </p>
          {invalidRows.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-signal-down/30 bg-signal-down/5 p-3 text-xs text-signal-down">
              {invalidRows.map((r) => (
                <li key={r.row}>
                  Row {r.row}: {r.error}
                </li>
              ))}
            </ul>
          )}
          {validRows.length > 0 && (
            <Button type="button" className="mt-3" onClick={() => onApply(validRows.map((r) => r.data))}>
              Apply {validRows.length} valid row{validRows.length === 1 ? "" : "s"} to draft
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
