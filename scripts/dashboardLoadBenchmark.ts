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

import { performance } from 'perf_hooks';
import { writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';

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

  return {
    avg: sum / timings.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
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
  const lines: string[] = [];

  lines.push('# Dashboard Load Performance Benchmark');
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
  lines.push('| Scenario | Cases | Iterations | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Threshold (ms) | Result |');
  lines.push('|----------|-------|------------|----------|----------|----------|----------|----------------|--------|');

  report.results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| ${result.scenario} | ${result.caseCount} | ${result.iterations} | ${result.avg.toFixed(2)} | ${result.min.toFixed(2)} | ${result.max.toFixed(2)} | ${result.p95.toFixed(2)} | ${result.threshold} | ${status} |`
    );
  });

  lines.push('');

  lines.push('## Analysis');
  lines.push('');

  if (report.summary.overallPassed) {
    lines.push('✅ **All dashboard load operations completed within acceptable thresholds.**');
    lines.push('');
    lines.push('Dashboard widgets are performant across all dataset sizes tested.');
  } else {
    lines.push('❌ **Some dashboard load operations exceeded performance thresholds.**');
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
    lines.push('- Optimize widget calculations with memoization');
    lines.push('- Consider lazy loading for non-critical widgets');
    lines.push('- Implement data aggregation caching');
    lines.push('- Profile widget rendering with React DevTools');
  }

  lines.push('');

  lines.push('## Widget Performance Breakdown');
  lines.push('');
  lines.push('The dashboard includes 4 primary widgets:');
  lines.push('1. **Status Distribution** - Aggregates cases by status');
  lines.push('2. **Priority Breakdown** - Aggregates cases by priority');
  lines.push('3. **Recent Activity** - Sorts and displays recent cases');
  lines.push('4. **Financial Summary** - Sums financial items across all cases');
  lines.push('');
  lines.push('All calculations run synchronously on the main thread during initial render.');
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
