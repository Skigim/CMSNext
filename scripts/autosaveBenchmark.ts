#!/usr/bin/env tsx
/**
 * Autosave Benchmark - Automated Performance Testing
 * 
 * Measures autosave performance under various conditions:
 * - Small payload (1 case, few items)
 * - Medium payload (10 cases, moderate items)
 * - Large payload (50+ cases, many items)
 * 
 * Validates against baseline: 5s debounce should complete in <100ms
 * 
 * USAGE:
 *   npx tsx scripts/autosaveBenchmark.ts
 * 
 * OUTPUT:
 *   reports/performance/autosave-benchmark-YYYY-MM-DD.json
 *   reports/performance/autosave-benchmark-YYYY-MM-DD.md
 */

import { performance } from 'node:perf_hooks';
import { Buffer } from 'node:buffer';
import {
  BenchmarkReport,
  buildFailedScenarioLines,
  calculateBenchmarkStats,
  collectScenarioTimings,
  createBenchmarkSummary,
  generateBenchmarkMarkdown,
  logBenchmarkComplete,
  logScenarioCompletion,
  runBenchmarkScript,
  writeBenchmarkReports,
} from './benchmarkMarkdown';

interface BenchmarkResult {
  scenario: string;
  payloadSize: number;
  iterations: number;
  timings: number[];
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  passed: boolean;
  threshold: number;
}

// Simulate autosave operations
function simulateAutosave(payload: unknown): number {
  const start = performance.now();

  // Simulate data serialization (JSON.stringify is typically the bottleneck)
  const serialized = JSON.stringify(payload);

  // Parse to simulate processing
  JSON.parse(serialized);

  const end = performance.now();
  return end - start;
}

function generatePayload(sizeKB: number): { cases: Array<Record<string, unknown>> } {
  const targetBytes = sizeKB * 1024;
  const baseItem = {
    title: 'Case Template',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5),
    status: 'Active',
    priority: 'Medium',
    metadata: {
      tags: ['tag1', 'tag2', 'tag3'],
      customFields: {
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
      },
    },
  };

  const baseItemBytes = Buffer.byteLength(JSON.stringify(baseItem), 'utf8');
  const itemsNeeded = Math.max(1, Math.ceil(targetBytes / baseItemBytes));

  const cases = Array.from({ length: itemsNeeded }, (_, index) => ({
    id: `case-${index}`,
    title: `${baseItem.title} #${index}`,
    description: baseItem.description,
    status: index % 2 === 0 ? 'Active' : 'Pending',
    priority: index % 3 === 0 ? 'High' : 'Medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      ...baseItem.metadata,
    },
  }));

  return { cases };
}

async function runBenchmark(): Promise<BenchmarkReport<BenchmarkResult>> {
  console.log('⚡ Autosave Benchmark');
  console.log('═══════════════════════════════════════\n');

  const scenarios = [
    { name: 'Small Payload (1-5 cases)', sizeKB: 10, threshold: 50, iterations: 50 },
    { name: 'Medium Payload (10-20 cases)', sizeKB: 50, threshold: 75, iterations: 30 },
    { name: 'Large Payload (50+ cases)', sizeKB: 200, threshold: 100, iterations: 20 },
    { name: 'Very Large Payload (100+ cases)', sizeKB: 500, threshold: 600, iterations: 10 },
  ];

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    const payload = generatePayload(scenario.sizeKB);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    const payloadSizeKB = Math.round((payloadBytes / 1024) * 100) / 100;

    console.log(`🔄 Running: ${scenario.name}`);
    console.log(`   Payload: ~${payloadSizeKB}KB (target ${scenario.sizeKB}KB), Iterations: ${scenario.iterations}`);

    const timings = collectScenarioTimings(scenario.iterations, () => simulateAutosave(payload));

    const stats = calculateBenchmarkStats(timings);
    const passed = stats.avg < scenario.threshold;

    results.push({
      scenario: scenario.name,
  payloadSize: payloadSizeKB,
      iterations: scenario.iterations,
      timings,
      ...stats,
      passed,
      threshold: scenario.threshold,
    });

    logScenarioCompletion(stats.avg, scenario.threshold, passed);
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    summary: createBenchmarkSummary(results),
  };
}

function generateMarkdownReport(report: BenchmarkReport<BenchmarkResult>): string {
  const resultRows = report.results.map((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    return `| ${result.scenario} | ${result.payloadSize}KB | ${result.iterations} | ${result.avg.toFixed(2)} | ${result.min.toFixed(2)} | ${result.max.toFixed(2)} | ${result.p95.toFixed(2)} | ${result.threshold} | ${status} |`;
  });

  const failedScenarioLines = buildFailedScenarioLines(report.results);

  return generateBenchmarkMarkdown({
    title: '# Autosave Performance Benchmark',
    timestamp: report.timestamp,
    summary: report.summary,
    tableHeader: '| Scenario | Payload | Iterations | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Threshold (ms) | Result |',
    tableDivider: '|----------|---------|------------|----------|----------|----------|----------|----------------|--------|',
    resultRows,
    successLines: [
      '✅ **All autosave operations completed within acceptable thresholds.**',
      '',
      'The 5-second debounce window provides sufficient time for autosave completion across all payload sizes.',
    ],
    failureHeading: '❌ **Some autosave operations exceeded performance thresholds.**',
    failedScenarioLines,
    recommendations: [
      '- Consider increasing debounce delay for large payloads',
      '- Investigate serialization optimizations',
      '- Implement progressive saving for very large datasets',
    ],
  });
}

async function main() {
  const report = await runBenchmark();
  const markdown = generateMarkdownReport(report);
  await writeBenchmarkReports('autosave-benchmark', report, markdown);
  logBenchmarkComplete(report.summary);
}

runBenchmarkScript(main);
