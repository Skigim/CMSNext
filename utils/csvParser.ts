import Papa from "papaparse";

/**
 * CSV Parsing Utilities
 * ====================
 * Robust CSV parsing with PapaParse for handling file imports and data loading.
 * Handles header extraction, empty line removal, and data normalization.
 * 
 * ## Features
 * 
 * - **Header Detection**: Automatically extracts and trims header row
 * - **Data Normalization**: Ensures all values are strings, replaces null with empty strings
 * - **Empty Line Removal**: Skips empty rows with "greedy" strategy
 * - **Error Logging**: Logs parsing errors to console for debugging
 * - **Type Safety**: Returns typed row objects with string values
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const csv = "Name,Email\\nJohn,john@example.com\\nJane,jane@example.com";
 * const rows = parseCsv(csv);
 * // [{ Name: "John", Email: "john@example.com" }, ...]
 * ```
 * 
 * @module csvParser
 */

export type ParsedCsvRow = Record<string, string>;

/**
 * Parse CSV text into typed row objects.
 * 
 * Uses PapaParse with header detection. Headers are trimmed of whitespace.
 * All values are normalized to strings (null becomes empty string).
 * Empty lines are skipped using "greedy" strategy.
 * 
 * @param {string} text - CSV text to parse (can be multi-line)
 * @returns {ParsedCsvRow[]} Array of parsed rows as key-value objects
 */
export function parseCsv(text: string): ParsedCsvRow[] {
  if (!text.trim()) {
    return [];
  }

  const result = Papa.parse<Record<string, string | null>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (header: string): string => header.trim(),
  });

  if (result.errors.length > 0) {
    console.warn("parseCsv encountered errors", result.errors);
  }

  const headers = result.meta.fields ?? [];

  return result.data.map((row: Record<string, string | null>) => {
    const normalizedRow: ParsedCsvRow = {};

    if (headers.length > 0) {
      headers.forEach((header) => {
        const value = row[header];
        normalizedRow[header] = value == null ? "" : String(value);
      });
      return normalizedRow;
    }

    return Object.entries(row).reduce<ParsedCsvRow>((acc, [key, value]) => {
      acc[key] = value == null ? "" : String(value);
      return acc;
    }, {});
  });
}
