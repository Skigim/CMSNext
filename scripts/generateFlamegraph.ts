#!/usr/bin/env tsx
/**
 * Generate Flamegraph from React Profiler Data
 * 
 * Converts captured React Profiler JSON data into speedscope-compatible format
 * for interactive flamegraph visualization.
 * 
 * USAGE:
 *   npx tsx scripts/generateFlamegraph.ts <input-json-file>
 * 
 * EXAMPLE:
 *   npx tsx scripts/generateFlamegraph.ts reports/performance/profiler-session-2025-10-17.json
 * 
 * OUTPUT:
 *   Creates .speedscope.json file that can be uploaded to https://www.speedscope.app/
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

interface ProfilerDataEntry {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions: any[];
  timestamp: string;
}

interface ProfilerReport {
  capturedAt: string;
  browser: string;
  totalRenders: number;
  data: ProfilerDataEntry[];
  summary: any;
}

interface SpeedscopeFrame {
  name: string;
}

interface SpeedscopeProfile {
  type: 'evented';
  name: string;
  unit: 'milliseconds';
  startValue: number;
  endValue: number;
  events: Array<{
    type: 'O' | 'C';
    at: number;
    frame: number;
  }>;
}

interface SpeedscopeFile {
  $schema: string;
  shared: {
    frames: SpeedscopeFrame[];
  };
  profiles: SpeedscopeProfile[];
  name: string;
  activeProfileIndex: number;
  exporter: string;
}

async function generateFlamegraph(inputFile: string): Promise<void> {
  console.log('🔥 Flamegraph Generator');
  console.log('═══════════════════════════════════════\n');

  // Read profiler data
  console.log(`📂 Reading: ${inputFile}`);
  const rawData = await readFile(inputFile, 'utf-8');
  const report: ProfilerReport = JSON.parse(rawData);

  console.log(`✅ Loaded ${report.totalRenders} renders\n`);

  // Convert to speedscope format
  console.log('🔄 Converting to speedscope format...');
  const speedscopeData = convertToSpeedscope(report);

  // Write output file
  const outputFile = inputFile.replace('.json', '.speedscope.json');
  console.log(`💾 Writing: ${outputFile}`);
  await writeFile(outputFile, JSON.stringify(speedscopeData, null, 2), 'utf-8');

  console.log('✅ Flamegraph generated!\n');
  console.log('📊 Next steps:');
  console.log('  1. Visit https://www.speedscope.app/');
  console.log(`  2. Upload ${outputFile}`);
  console.log('  3. Analyze the flamegraph to identify rendering bottlenecks');
  console.log('');
}

function convertToSpeedscope(report: ProfilerReport): SpeedscopeFile {
  const frames: SpeedscopeFrame[] = [];
  const frameMap = new Map<string, number>();

  // Helper to get or create frame index
  function getFrameIndex(name: string): number {
    if (frameMap.has(name)) {
      return frameMap.get(name)!;
    }
    const index = frames.length;
    frames.push({ name });
    frameMap.set(name, index);
    return index;
  }

  // Build events from profiler data
  const events: SpeedscopeProfile['events'] = [];

  report.data.forEach((entry, index) => {
    const frameName = `${entry.id} (${entry.phase})`;
    const frameIndex = getFrameIndex(frameName);

    // Open event
    events.push({
      type: 'O',
      at: entry.startTime,
      frame: frameIndex,
    });

    // Close event
    events.push({
      type: 'C',
      at: entry.startTime + entry.actualDuration,
      frame: frameIndex,
    });
  });

  // Sort events by time
  events.sort((a, b) => a.at - b.at);

  // Calculate time range
  const startValue = events.length > 0 ? events[0].at : 0;
  const endValue = events.length > 0 ? events[events.length - 1].at : 0;

  const profile: SpeedscopeProfile = {
    type: 'evented',
    name: 'React Profiler Session',
    unit: 'milliseconds',
    startValue,
    endValue,
    events,
  };

  const speedscopeFile: SpeedscopeFile = {
    $schema: 'https://www.speedscope.app/file-format-schema.json',
    shared: {
      frames,
    },
    profiles: [profile],
    name: `CMSNext Profiler - ${report.capturedAt}`,
    activeProfileIndex: 0,
    exporter: 'CMSNext Telemetry Scripts',
  };

  return speedscopeFile;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Missing input file');
  console.error('');
  console.error('Usage: npx tsx scripts/generateFlamegraph.ts <input-json-file>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/generateFlamegraph.ts reports/performance/profiler-session-2025-10-17.json');
  process.exit(1);
}

const inputFile = resolve(args[0]);

generateFlamegraph(inputFile)
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
