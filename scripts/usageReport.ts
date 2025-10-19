#!/usr/bin/env npx tsx

import { promises as fs } from "fs";
import path from "path";
import process from "process";

interface UsageEvent {
  id: string;
  componentId: string;
  action: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

interface UsageSnapshot {
  generatedAt: string;
  totals?: Record<string, number>;
  events?: UsageEvent[];
}

interface CliOptions {
  inputPath: string;
  outputPath?: string;
  help: boolean;
}

const DEFAULT_INPUT = path.resolve(process.cwd(), "usage/usage-metrics.json");

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputPath: DEFAULT_INPUT,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--input":
      case "-i":
        if (next) {
          options.inputPath = path.resolve(process.cwd(), next);
          i += 1;
        }
        break;
      case "--output":
      case "-o":
        if (next) {
          options.outputPath = path.resolve(process.cwd(), next);
          i += 1;
        }
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`CMSNext Usage Metrics Reporter\n\nUSAGE\n  npx tsx scripts/usageReport.ts [options]\n\nOPTIONS\n  --input,  -i  Path to usage JSON (default: usage/usage-metrics.json)\n  --output, -o  Path to write CSV (stdout when omitted)\n  --help,   -h  Show this message\n`);
}

async function loadSnapshot(filePath: string): Promise<UsageSnapshot | null> {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    if (!contents.trim()) {
      return null;
    }
    return JSON.parse(contents) as UsageSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function escapeCsv(value: string): string {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatSnapshot(snapshot: UsageSnapshot): string {
  const rows: string[] = [];
  rows.push(["recordType", "id", "componentId", "action", "count", "timestamp", "metadata"].join(","));

  const totalsEntries = Object.entries(snapshot.totals ?? {});
  totalsEntries.sort(([a], [b]) => a.localeCompare(b));

  totalsEntries.forEach(([componentId, count]) => {
    rows.push([
      "total",
      "",
      escapeCsv(componentId),
      "",
      String(count ?? 0),
      escapeCsv(snapshot.generatedAt ?? ""),
      "",
    ].join(","));
  });

  const events = [...(snapshot.events ?? [])];
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  events.forEach(event => {
    rows.push([
      "event",
      escapeCsv(event.id ?? ""),
      escapeCsv(event.componentId ?? ""),
      escapeCsv(event.action ?? ""),
      "1",
      escapeCsv(event.timestamp ?? ""),
      event.metadata ? escapeCsv(JSON.stringify(event.metadata)) : "",
    ].join(","));
  });

  return rows.join("\n");
}

async function ensureDirectory(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const snapshot = await loadSnapshot(options.inputPath);

  if (!snapshot) {
    console.warn(`ℹ️  No usage metrics found at ${options.inputPath}.`);
    return;
  }

  const csv = formatSnapshot(snapshot);

  if (options.outputPath) {
    await ensureDirectory(options.outputPath);
    await fs.writeFile(options.outputPath, `${csv}\n`, "utf8");
    console.log(`✅ Usage metrics written to ${options.outputPath}`);
  } else {
    console.log(csv);
  }
}

main().catch(error => {
  console.error("❌ Failed to generate usage report:", error instanceof Error ? error.message : error);
  process.exit(1);
});
