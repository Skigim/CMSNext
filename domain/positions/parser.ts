/**
 * @fileoverview Position Assignments Parser
 *
 * Pure function to parse N-FOCUS "List Position Assignments - Program Case"
 * XML exports. Extracts Master Case Number (MCN) and case name from each record.
 *
 * ## File Format
 *
 * Crystal Reports XML exports include repeated `<Details><Section><Field ...>`
 * nodes. Each field stores values by display name, including "Mst Case" and
 * "Program Case Name". The parser maps these fields to a normalized record
 * shape and extracts MCN/name from each record.
 *
 * @module domain/positions/parser
 */

import { XMLParser, XMLValidator } from "fast-xml-parser";

// ============================================================================
// Types
// ============================================================================

export interface CaseRecord {
  masterCaseId: string;
  program?: string;
  caseName?: string;
  status?: string;
  statusDate?: string;
  reviewRecertDate?: string;
  isExpedited?: boolean;
  assistanceType?: string;
  primaryLanguage?: string;
  caseworkerRole?: string;
  assignmentBeginDate?: string;
  applicationReceivedDate?: string;
  daysPending?: number | string;
}

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

const XML_FIELD_MAP: Record<string, keyof CaseRecord> = {
  mstcase: "masterCaseId",
  program: "program",
  programcasename: "caseName",
  st: "status",
  statusdt: "statusDate",
  revrecrt: "reviewRecertDate",
  exp: "isExpedited",
  assistance: "assistanceType",
  language: "primaryLanguage",
  wrkrrole: "caseworkerRole",
  assignbegdt: "assignmentBeginDate",
  applrcvd: "applicationReceivedDate",
  dayspndg: "daysPending",
};

// ============================================================================
// Parser
// ============================================================================

/**
 * Normalize a raw field value by trimming whitespace and embedded newlines.
 */
function normalizeField(value: string | undefined | null): string {
  if (!value) return "";
  return value.replaceAll(/[\r\n]+/g, " ").trim();
}

function normalizeFieldName(value: string): string {
  return normalizeField(value).toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

/**
 * Check if a value looks like a valid numeric MCN.
 * MCNs from N-FOCUS are numeric strings (e.g., "123456").
 */
function isValidMcn(value: string): boolean {
  return /^\d{3,}$/.test(value);
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function findDetailNodes(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    return node.flatMap(findDetailNodes);
  }

  const record = node as Record<string, unknown>;
  const details = toArray(record.Details as Record<string, unknown> | Record<string, unknown>[] | undefined);
  if (details.length > 0) return details;

  return Object.values(record).flatMap(findDetailNodes);
}

function extractFieldValue(node: unknown): string {
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
    return String(node);
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const value = extractFieldValue(item);
      if (value) return value;
    }
    return "";
  }

  const record = node as Record<string, unknown>;
  const preferredKeys = ["FormattedValue", "Value", "Text", "#text", "_text"];
  for (const key of preferredKeys) {
    const value = extractFieldValue(record[key]);
    if (value) return normalizeField(value);
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "Name") continue;
    const extracted = extractFieldValue(value);
    if (extracted) return normalizeField(extracted);
  }

  return "";
}

function mapFieldToRecord(record: Partial<CaseRecord>, fieldName: string, fieldValue: string): void {
  const mappedKey = XML_FIELD_MAP[normalizeFieldName(fieldName)];
  if (!mappedKey) return;

  if (mappedKey === "isExpedited") {
    const normalized = fieldValue.toLowerCase();
    record.isExpedited = ["y", "yes", "true", "1"].includes(normalized);
    return;
  }

  if (mappedKey === "daysPending") {
    const numericValue = Number(fieldValue);
    record.daysPending = Number.isFinite(numericValue) ? numericValue : fieldValue;
    return;
  }

  record[mappedKey] = fieldValue;
}

export function parseCrystalReportXML(xmlString: string): CaseRecord[] {
  if (!xmlString.trim()) return [];
  const validation = XMLValidator.validate(xmlString);
  if (validation !== true) {
    throw new Error("Invalid XML document format.");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    trimValues: true,
    parseTagValue: false,
  });
  const parsed = parser.parse(xmlString) as Record<string, unknown>;

  const details = findDetailNodes(parsed);
  const parsedRecords: CaseRecord[] = [];

  for (const detail of details) {
    const sections = toArray((detail as Record<string, unknown>)?.Section);
    for (const section of sections) {
      const fields = toArray((section as Record<string, unknown>)?.Field);
      const record: Partial<CaseRecord> = {};

      for (const field of fields) {
        const fieldRecord = field as Record<string, unknown>;
        const name = normalizeField(String(fieldRecord.Name ?? ""));
        if (!name) continue;

        const value = extractFieldValue(fieldRecord);
        if (!value) continue;

        mapFieldToRecord(record, name, value);
      }

      parsedRecords.push({ masterCaseId: "", ...record });
    }
  }

  return parsedRecords;
}

/**
 * Parse an N-FOCUS "List Position Assignments" XML export.
 *
 * Extracts MCN and case name from each record. Deduplicates by MCN
 * (first occurrence wins). Skips rows without a valid MCN.
 *
 * @param xmlText - Raw text content of the XML file
 * @returns Parse result with entries and statistics
 *
 * @example
 * const result = parsePositionAssignments(await file.text());
 * console.log(`Parsed ${result.entries.length} unique cases`);
 * console.log(`Skipped ${result.skippedRows} invalid rows`);
 */
export function parsePositionAssignments(xmlText: string): PositionParseResult {
  if (!xmlText.trim()) {
    return { entries: [], totalRows: 0, skippedRows: 0, duplicatesRemoved: 0 };
  }
  const records = parseCrystalReportXML(xmlText);

  const seenMcns = new Set<string>();
  const entries: ParsedPositionEntry[] = [];
  let skippedRows = 0;
  let duplicatesRemoved = 0;

  for (const record of records) {
    const rawMcn = normalizeField(record.masterCaseId);
    const rawName = normalizeField(record.caseName);

    if (!isValidMcn(rawMcn)) {
      skippedRows++;
      continue;
    }

    const entry: ParsedPositionEntry = { mcn: rawMcn, name: rawName || "Unknown" };

    if (seenMcns.has(entry.mcn)) {
      duplicatesRemoved++;
      continue;
    }

    seenMcns.add(entry.mcn);
    entries.push(entry);
  }

  return {
    entries,
    totalRows: records.length,
    skippedRows,
    duplicatesRemoved,
  };
}
