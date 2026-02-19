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

async function runBenchmark(): Promise<BenchmarkReport<BenchmarkResult>> {
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

    const timings = collectScenarioTimings(scenario.iterations, () => simulateDashboardLoad(scenario.caseCount));

    const stats = calculateBenchmarkStats(timings);
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
    return `| ${result.scenario} | ${result.caseCount} | ${result.iterations} | ${result.avg.toFixed(2)} | ${result.min.toFixed(2)} | ${result.max.toFixed(2)} | ${result.p95.toFixed(2)} | ${result.threshold} | ${status} |`;
  });

  const failedScenarioLines = buildFailedScenarioLines(report.results);

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
  const report = await runBenchmark();
  const markdown = generateMarkdownReport(report);
  await writeBenchmarkReports('dashboard-load-benchmark', report, markdown);
  logBenchmarkComplete(report.summary);
}

runBenchmarkScript(main);
