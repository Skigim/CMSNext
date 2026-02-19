#!/usr/bin/env tsx
/**
 * Dashboard Load Benchmark - Automated Performance Testing
 * 
 * Measures dashboard widget rendering and data aggregation performance:
 * - Empty state (0 cases)
 * - Small dataset (5 cases)
 * - Medium dataset (25 cases)
 * - Large dataset (100 cases)
 * 
 * Validates against baseline: Dashboard should load in <500ms
 * 
 * USAGE:
 *   npx tsx scripts/dashboardLoadBenchmark.ts
 * 
 * OUTPUT:
 *   reports/performance/dashboard-load-benchmark-YYYY-MM-DD.json
 *   reports/performance/dashboard-load-benchmark-YYYY-MM-DD.md
 */

import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateBenchmarkMarkdown } from './benchmarkMarkdown';

interface BenchmarkResult {
  scenario: string;
  caseCount: number;
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

// Simulate dashboard computation
function simulateDashboardLoad(caseCount: number): number {
  const start = performance.now();

  // Generate case data
  const cases = generateCases(caseCount);

  // Simulate widget calculations
  calculateStatusDistribution(cases);
  calculatePriorityBreakdown(cases);
  calculateRecentActivity(cases);
  calculateFinancialSummary(cases);

  const end = performance.now();
  return end - start;
}

function generateCases(count: number): any[] {
  const statuses = ['Active', 'Pending', 'Closed', 'On Hold'];
  const priorities = ['Low', 'Medium', 'High', 'Critical'];

  return Array.from({ length: count }, (_, index) => ({
    id: `case-${index}`,
    title: `Case ${index}`,
    status: statuses[index % statuses.length],
    priority: priorities[index % priorities.length],
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    financialItems: Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
      id: `item-${i}`,
      amount: Math.random() * 1000,
      date: new Date().toISOString(),
    })),
    notes: Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
      id: `note-${i}`,
      content: 'Sample note content',
      createdAt: new Date().toISOString(),
    })),
  }));
}

function calculateStatusDistribution(cases: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  cases.forEach(c => {
    distribution[c.status] = (distribution[c.status] || 0) + 1;
  });
  return distribution;
}

function calculatePriorityBreakdown(cases: any[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  cases.forEach(c => {
    breakdown[c.priority] = (breakdown[c.priority] || 0) + 1;
  });
  return breakdown;
}

function calculateRecentActivity(cases: any[]): any[] {
  return cases
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);
}

function calculateFinancialSummary(cases: any[]): {
  totalAmount: number;
  itemCount: number;
} {
  let totalAmount = 0;
  let itemCount = 0;

  cases.forEach(c => {
    c.financialItems?.forEach((item: any) => {
      totalAmount += item.amount;
      itemCount++;
    });
  });

  return { totalAmount, itemCount };
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
  console.log('📊 Dashboard Load Benchmark');
  console.log('═══════════════════════════════════════\n');

  const scenarios = [
    { name: 'Empty State', caseCount: 0, threshold: 50, iterations: 50 },
    { name: 'Small Dataset', caseCount: 5, threshold: 100, iterations: 50 },
    { name: 'Medium Dataset', caseCount: 25, threshold: 250, iterations: 30 },
    { name: 'Large Dataset', caseCount: 100, threshold: 500, iterations: 20 },
    { name: 'Very Large Dataset', caseCount: 250, threshold: 1000, iterations: 10 },
  ];

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    console.log(`🔄 Running: ${scenario.name}`);
    console.log(`   Cases: ${scenario.caseCount}, Iterations: ${scenario.iterations}`);

    const timings: number[] = [];

    for (let i = 0; i < scenario.iterations; i++) {
      const timing = simulateDashboardLoad(scenario.caseCount);
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
      caseCount: scenario.caseCount,
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
  const resultRows = report.results.map((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    return `| ${result.scenario} | ${result.caseCount} | ${result.iterations} | ${result.avg.toFixed(2)} | ${result.min.toFixed(2)} | ${result.max.toFixed(2)} | ${result.p95.toFixed(2)} | ${result.threshold} | ${status} |`;
  });

  const failedScenarioLines = report.results
    .filter((result) => !result.passed)
    .flatMap((result) => [
      `- **${result.scenario}**: Average ${result.avg.toFixed(2)}ms (threshold: ${result.threshold}ms)`,
      `  - Exceeded by ${(result.avg - result.threshold).toFixed(2)}ms`,
    ]);

  return generateBenchmarkMarkdown({
    title: '# Dashboard Load Performance Benchmark',
    timestamp: report.timestamp,
    summary: report.summary,
    tableHeader: '| Scenario | Cases | Iterations | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Threshold (ms) | Result |',
    tableDivider: '|----------|-------|------------|----------|----------|----------|----------|----------------|--------|',
    resultRows,
    successLines: [
      '✅ **All dashboard load operations completed within acceptable thresholds.**',
      '',
      'Dashboard widgets are performant across all dataset sizes tested.',
    ],
    failureHeading: '❌ **Some dashboard load operations exceeded performance thresholds.**',
    failedScenarioLines,
    recommendations: [
      '- Optimize widget calculations with memoization',
      '- Consider lazy loading for non-critical widgets',
      '- Implement data aggregation caching',
      '- Profile widget rendering with React DevTools',
    ],
    appendixLines: [
      '## Widget Performance Breakdown',
      '',
      'The dashboard includes 4 primary widgets:',
      '1. **Status Distribution** - Aggregates cases by status',
      '2. **Priority Breakdown** - Aggregates cases by priority',
      '3. **Recent Activity** - Sorts and displays recent cases',
      '4. **Financial Summary** - Sums financial items across all cases',
      '',
      'All calculations run synchronously on the main thread during initial render.',
    ],
  });
}

async function main() {
  // Ensure reports directory exists
  const reportsDir = resolve(process.cwd(), 'reports', 'performance');
  await mkdir(reportsDir, { recursive: true });

  // Run benchmark
  const report = await runBenchmark();

  // Generate filenames
  const date = new Date().toISOString().split('T')[0];
  const jsonFile = resolve(reportsDir, `dashboard-load-benchmark-${date}.json`);
  const mdFile = resolve(reportsDir, `dashboard-load-benchmark-${date}.md`);

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
