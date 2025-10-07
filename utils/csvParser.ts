import Papa from "papaparse";

export type ParsedCsvRow = Record<string, string>;

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
