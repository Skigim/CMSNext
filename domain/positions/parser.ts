/**
 * @fileoverview Position Assignments Parser
 *
 * Pure function to parse N-FOCUS "List Position Assignments - Program Case"
 * CSV exports. Extracts Master Case Number (MCN) and case name from each row.
 *
 * ## File Format
 *
 * Each CSV row represents a single case embedded in repeated header/footer
 * metadata. The row contains column headers ("Mst Case", "Program", etc.)
 * followed by their corresponding values. The parser locates the "Mst Case"
 * sentinel in each row and extracts the MCN and name at known field offsets.
 *
 * ## Row Structure (field positions relative to "Mst Case" sentinel):
 *
 * ```
 * "Mst Case","Program","Program Case Name\n","St","Status Dt","Rev/Recrt",
 * "Appl Rcvd","Days\nPndg","Exp","Assistance","Language","Wrkr Role",
 * "Assign\nBeg. Dt", <MCN>, "MEDICAID", "<LASTNAME, FIRSTNAME MI>", ...
 * ```
 *
 * The MCN appears 13 fields after the "Mst Case" header, and the name
 * appears 15 fields after (i.e., 2 after the MCN).
 *
 * @module domain/positions/parser
 */

import Papa from "papaparse";

// ============================================================================
// Types
// ============================================================================

/**
 * A single parsed position assignment entry.
 */
export interface ParsedPositionEntry {
  /** Master Case Number (numeric string) */
  mcn: string;
  /** Case name as "LASTNAME, FIRSTNAME MI" from the export */
  name: string;
}

/**
 * Result of parsing a position assignments file.
 */
export interface PositionParseResult {
  /** Deduplicated entries (by MCN) */
  entries: ParsedPositionEntry[];
  /** Total raw rows found before deduplication */
  totalRows: number;
  /** Rows skipped (no valid MCN found) */
  skippedRows: number;
  /** Duplicate rows removed */
  duplicatesRemoved: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Sentinel value to locate the column header section within each row */
const MST_CASE_SENTINEL = "Mst Case";

/** Offset from "Mst Case" sentinel to the MCN value field */
const MCN_OFFSET = 13;

/** Offset from "Mst Case" sentinel to the case name value field */
const NAME_OFFSET = 15;

// ============================================================================
// Parser
// ============================================================================

/**
 * Normalize a raw field value by trimming whitespace and embedded newlines.
 */
function normalizeField(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Check if a value looks like a valid numeric MCN.
 * MCNs from N-FOCUS are numeric strings (e.g., "123456").
 */
function isValidMcn(value: string): boolean {
  return /^\d{3,}$/.test(value);
}

/**
 * Find the index of the "Mst Case" sentinel within a row's fields.
 * Handles whitespace/newlines in the header value.
 *
 * @param fields - Array of field values from the CSV row
 * @returns Index of the sentinel, or -1 if not found
 */
function findSentinelIndex(fields: string[]): number {
  for (let i = 0; i < fields.length; i++) {
    const normalized = normalizeField(fields[i]);
    if (normalized === MST_CASE_SENTINEL) {
      return i;
    }
  }
  return -1;
}

/**
 * Parse a single CSV row to extract position assignment data.
 *
 * @param fields - Array of field values from the row
 * @returns Parsed entry, or null if the row doesn't contain valid data
 */
function parseRow(fields: string[]): ParsedPositionEntry | null {
  const sentinelIdx = findSentinelIndex(fields);
  if (sentinelIdx === -1) {
    return null;
  }

  const mcnIdx = sentinelIdx + MCN_OFFSET;
  const nameIdx = sentinelIdx + NAME_OFFSET;

  if (mcnIdx >= fields.length || nameIdx >= fields.length) {
    return null;
  }

  const rawMcn = normalizeField(fields[mcnIdx]);
  const rawName = normalizeField(fields[nameIdx]);

  if (!isValidMcn(rawMcn)) {
    return null;
  }

  return {
    mcn: rawMcn,
    name: rawName || "Unknown",
  };
}

/**
 * Parse an N-FOCUS "List Position Assignments" CSV export.
 *
 * Extracts MCN and case name from each row. Deduplicates by MCN
 * (first occurrence wins). Skips rows without a valid MCN.
 *
 * @param csvText - Raw text content of the CSV file
 * @returns Parse result with entries and statistics
 *
 * @example
 * const result = parsePositionAssignments(await file.text());
 * console.log(`Parsed ${result.entries.length} unique cases`);
 * console.log(`Skipped ${result.skippedRows} invalid rows`);
 */
export function parsePositionAssignments(csvText: string): PositionParseResult {
  if (!csvText.trim()) {
    return { entries: [], totalRows: 0, skippedRows: 0, duplicatesRemoved: 0 };
  }

  // Parse without headers — each row is a flat array of fields
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const seenMcns = new Set<string>();
  const entries: ParsedPositionEntry[] = [];
  let skippedRows = 0;
  let duplicatesRemoved = 0;

  for (const row of parsed.data) {
    if (!Array.isArray(row) || row.length === 0) {
      skippedRows++;
      continue;
    }

    const entry = parseRow(row);
    if (!entry) {
      skippedRows++;
      continue;
    }

    if (seenMcns.has(entry.mcn)) {
      duplicatesRemoved++;
      continue;
    }

    seenMcns.add(entry.mcn);
    entries.push(entry);
  }

  return {
    entries,
    totalRows: parsed.data.length,
    skippedRows,
    duplicatesRemoved,
  };
}
