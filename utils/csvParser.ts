export type ParsedCsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let fieldQuoted = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      if (!inQuotes) {
        fieldQuoted = true;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(fieldQuoted ? current : current.trim());
      current = "";
      fieldQuoted = false;
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  result.push(fieldQuoted ? current : current.trim());
  return result;
}

export function parseCsv(text: string): ParsedCsvRow[] {
  if (!text.trim()) {
    return [];
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, "").trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line).map((value) => value.replace(/^"|"$/g, ""));
    const row: ParsedCsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}
