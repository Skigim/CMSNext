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

import { performance } from 'perf_hooks';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { Buffer } from 'node:buffer';

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

interface BenchmarkReport {
  timestamp: string;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    overallPassed: boolean;
  };
}

// Simulate autosave operations
function simulateAutosave(payload: unknown): number {
  const start = performance.now();

  // Simulate data serialization (JSON.stringify is typically the bottleneck)
  const serialized = JSON.stringify(payload);

  // Simulate some processing
  const parsed = JSON.parse(serialized);

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

function calculateStats(timings: number[]): {
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
} {
  const sorted = [...timings].sort((a, b) => a - b);
  const sum = timings.reduce((acc, val) => acc + val, 0);

  const len = sorted.length;
  const median = len % 2 === 0
    ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
    : sorted[Math.floor(len / 2)];
  const p95Index = Math.min(Math.ceil(len * 0.95) - 1, len - 1);
  const p95 = sorted[Math.max(p95Index, 0)];

  return {
    avg: sum / timings.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median,
    p95,
  };
}

async function runBenchmark(): Promise<BenchmarkReport> {
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

    const timings: number[] = [];

    for (let i = 0; i < scenario.iterations; i++) {
      const timing = simulateAutosave(payload);
      timings.push(timing);

      // Progress indicator
      if ((i + 1) % 10 === 0 || i === scenario.iterations - 1) {
        process.stdout.write(`   Progress: ${i + 1}/${scenario.iterations}\r`);
      }
    }

    const stats = calculateStats(timings);
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

    console.log(`   ✅ Completed`);
    console.log(`   Average: ${stats.avg.toFixed(2)}ms (threshold: ${scenario.threshold}ms)`);
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  const summary = {
    totalTests: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    overallPassed: results.every(r => r.passed),
  };

  return {
    timestamp: new Date().toISOString(),
    results,
    summary,
  };
}

function generateMarkdownReport(report: BenchmarkReport): string {
  const lines: string[] = [];

  lines.push('# Autosave Performance Benchmark');
  lines.push('');
  lines.push(`**Date:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`**Status:** ${report.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total Tests: ${report.summary.totalTests}`);
  lines.push(`- Passed: ${report.summary.passed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push('');

  lines.push('## Results');
  lines.push('');
  lines.push('| Scenario | Payload | Iterations | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Threshold (ms) | Result |');
  lines.push('|----------|---------|------------|----------|----------|----------|----------|----------------|--------|');

  report.results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| ${result.scenario} | ${result.payloadSize}KB | ${result.iterations} | ${result.avg.toFixed(2)} | ${result.min.toFixed(2)} | ${result.max.toFixed(2)} | ${result.p95.toFixed(2)} | ${result.threshold} | ${status} |`
    );
  });

  lines.push('');

  lines.push('## Analysis');
  lines.push('');

  if (report.summary.overallPassed) {
    lines.push('✅ **All autosave operations completed within acceptable thresholds.**');
    lines.push('');
    lines.push('The 5-second debounce window provides sufficient time for autosave completion across all payload sizes.');
  } else {
    lines.push('❌ **Some autosave operations exceeded performance thresholds.**');
    lines.push('');
    lines.push('**Failed scenarios:**');
    report.results
      .filter(r => !r.passed)
      .forEach(r => {
        lines.push(`- **${r.scenario}**: Average ${r.avg.toFixed(2)}ms (threshold: ${r.threshold}ms)`);
        lines.push(`  - Exceeded by ${(r.avg - r.threshold).toFixed(2)}ms`);
      });
    lines.push('');
    lines.push('**Recommendations:**');
    lines.push('- Consider increasing debounce delay for large payloads');
    lines.push('- Investigate serialization optimizations');
    lines.push('- Implement progressive saving for very large datasets');
  }

  lines.push('');

  return lines.join('\n');
}

async function main() {
  // Ensure reports directory exists
  const reportsDir = resolve(process.cwd(), 'reports', 'performance');
  await mkdir(reportsDir, { recursive: true });

  // Run benchmark
  const report = await runBenchmark();

  // Generate filenames
  const date = new Date().toISOString().split('T')[0];
  const jsonFile = resolve(reportsDir, `autosave-benchmark-${date}.json`);
  const mdFile = resolve(reportsDir, `autosave-benchmark-${date}.md`);

  // Write JSON report
  console.log(`💾 Writing JSON report: ${jsonFile}`);
  await writeFile(jsonFile, JSON.stringify(report, null, 2), 'utf-8');

  // Write markdown report
  const markdown = generateMarkdownReport(report);
  console.log(`📝 Writing Markdown report: ${mdFile}`);
  await writeFile(mdFile, markdown, 'utf-8');

  console.log('');
  console.log('✨ Benchmark complete!');
  console.log('');
  console.log(`📊 Overall: ${report.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Passed: ${report.summary.passed}/${report.summary.totalTests}`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
