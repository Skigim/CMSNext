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

export interface PositionAssignmentRecord {
  masterCaseId: string;
  caseName?: string;
  applicationDate?: string;
  caseStatus?: string;
}

/**
 * A single parsed position assignment entry.
 */
export interface ParsedPositionEntry {
  /** Master Case Number (numeric string) */
  mcn: string;
  /** Case name as "LASTNAME, FIRSTNAME MI" from the export */
  name: string;
  /** Case status as recorded in the export (exact value from the XML) */
  status?: string;
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

const XML_FIELD_MAP: Record<string, keyof PositionAssignmentRecord> = {
  mstcase: "masterCaseId",
  mastercase: "masterCaseId",
  mastercasenumber: "masterCaseId",
  mastercaseno: "masterCaseId",
  mastercaseid: "masterCaseId",
  mcn: "masterCaseId",
  sfmastercaseidnbr: "masterCaseId",
  genviewsfmastercase: "masterCaseId",
  programcasename: "caseName",
  casename: "caseName",
  clientname: "caseName",
  sfpcnameorowner: "caseName",
  genviewsfprogramcasename: "caseName",
  sfapplicationreceiveddateortext: "applicationDate",
  genviewapplicationreceiveddateortext: "applicationDate",
  // Status field — N-FOCUS Crystal Reports uses abbreviated column name "St"
  st: "caseStatus",
  casestatus: "caseStatus",
  sfcasestatus: "caseStatus",
  sfstatus: "caseStatus",
  sfstatuscode: "caseStatus",
  genviewsfstatus: "caseStatus",
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

function normalizeFieldKey(value: string): string {
  return normalizeFieldName(value).replaceAll(/\d+$/g, "");
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

function stripNamespace(name: string): string {
  const parts = name.split(":");
  return parts[parts.length - 1] ?? name;
}

function matchesLocalName(name: string, localName: string): boolean {
  return stripNamespace(name).toLowerCase() === localName.toLowerCase();
}

function getPropertyByLocalName(record: Record<string, unknown>, localName: string): unknown {
  for (const [key, value] of Object.entries(record)) {
    if (matchesLocalName(key, localName)) {
      return value;
    }
  }
  return undefined;
}

function collectObjectChildren(value: unknown): Record<string, unknown>[] {
  return toArray(value).filter(
    (child): child is Record<string, unknown> =>
      child !== null && typeof child === "object" && !Array.isArray(child),
  );
}

function getObjectChildrenByLocalName(node: unknown, localName: string): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    return node.flatMap(item => getObjectChildrenByLocalName(item, localName));
  }

  const record = node as Record<string, unknown>;
  const matchingChildren: Record<string, unknown>[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (!matchesLocalName(key, localName)) continue;
    matchingChildren.push(...collectObjectChildren(value));
  }

  return matchingChildren;
}

function findDetailNodes(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) {
    return node.flatMap(findDetailNodes);
  }

  const record = node as Record<string, unknown>;
  const details = getObjectChildrenByLocalName(record, "Details");
  if (details.length > 0) return details;

  return Object.values(record).flatMap(findDetailNodes);
}

const PREFERRED_VALUE_KEYS = ["FormattedValue", "Value", "Text", "#text", "_text"] as const;

function extractByPreferredKeys(record: Record<string, unknown>): string {
  for (const key of PREFERRED_VALUE_KEYS) {
    const value = extractFieldValue(getPropertyByLocalName(record, key));
    if (value) return normalizeField(value);
  }
  return "";
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
  const byPreferred = extractByPreferredKeys(record);
  if (byPreferred) return byPreferred;

  for (const [key, value] of Object.entries(record)) {
    if (matchesLocalName(key, "Name")) continue;
    const extracted = extractFieldValue(value);
    if (extracted) return normalizeField(extracted);
  }

  return "";
}

function mapFieldToRecord(
  record: Partial<PositionAssignmentRecord>,
  fieldName: string,
  fieldValue: string,
  fieldSource?: string
): void {
  const mappedKey = XML_FIELD_MAP[normalizeFieldKey(fieldName)]
    ?? (fieldSource ? XML_FIELD_MAP[normalizeFieldKey(fieldSource)] : undefined);

  if (!mappedKey) return;

  record[mappedKey] = fieldValue;
}

function processSectionFields(section: Record<string, unknown>): PositionAssignmentRecord {
  const fields = getObjectChildrenByLocalName(section, "Field");
  const record: Partial<PositionAssignmentRecord> = {};

  for (const field of fields) {
    const rawName = getPropertyByLocalName(field, "Name");
    const rawFieldName = getPropertyByLocalName(field, "FieldName");
    const name = normalizeField(String(rawName ?? ""));
    const fieldSource = normalizeField(String(rawFieldName ?? ""));
    if (!name && !fieldSource) continue;

    const value = extractFieldValue(field);
    if (!value) continue;

    mapFieldToRecord(record, name, value, fieldSource);
  }

  return { masterCaseId: "", ...record };
}

export function parseCrystalReportXML(xmlString: string): PositionAssignmentRecord[] {
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
  const parsedRecords: PositionAssignmentRecord[] = [];

  for (const detail of details) {
    const sections = getObjectChildrenByLocalName(detail, "Section");
    for (const section of sections) {
      parsedRecords.push(processSectionFields(section));
    }
  }

  return parsedRecords;
}

/**
 * Parse an N-FOCUS "List Position Assignments" XML export.
 *
 * Extracts MCN and case name from each record. Deduplicates by MCN —
 * later rows for the same MCN can backfill missing fields (e.g. a group
 * header row that carries the MCN but no status will be completed by the
 * detail row that follows it).  Skips rows without a valid MCN.
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

  const entriesByMcn = new Map<string, ParsedPositionEntry>();
  let skippedRows = 0;
  let duplicatesRemoved = 0;

  for (const record of records) {
    const rawMcn = normalizeField(record.masterCaseId);
    const rawName = normalizeField(record.caseName);
    const rawStatus = normalizeField(record.caseStatus);

    if (!isValidMcn(rawMcn)) {
      skippedRows++;
      continue;
    }

    const existing = entriesByMcn.get(rawMcn);
    if (existing) {
      // Backfill fields the first-seen row was missing (e.g. a group
      // header carries MCN but no status; the detail row has both).
      if (!existing.status && rawStatus) existing.status = rawStatus;
      if (existing.name === "Unknown" && rawName) existing.name = rawName;
      duplicatesRemoved++;
      continue;
    }

    entriesByMcn.set(rawMcn, {
      mcn: rawMcn,
      name: rawName || "Unknown",
      ...(rawStatus ? { status: rawStatus } : {}),
    });
  }

  const entries = Array.from(entriesByMcn.values());

  return {
    entries,
    totalRows: records.length,
    skippedRows,
    duplicatesRemoved,
  };
}
