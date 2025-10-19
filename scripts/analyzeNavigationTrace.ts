#!/usr/bin/env tsx
/**
 * Navigation Trace Analyzer
 * 
 * Processes captured navigation trace JSON and generates markdown analysis report.
 * 
 * USAGE:
 *   npx tsx scripts/analyzeNavigationTrace.ts <input-json-file>
 * 
 * EXAMPLE:
 *   npx tsx scripts/analyzeNavigationTrace.ts reports/performance/navigation-trace-2025-10-17.json
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

interface NavigationTrace {
  iteration: number;
  stepIndex: number;
  stepName: string;
  stepLabel: string;
  timestamp: number;
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null;
  url: string;
  pathname: string;
  durationFromPrevious?: number;
}

interface NavigationReport {
  capturedAt: string;
  browser: string;
  totalIterations: number;
  totalSteps: number;
  traces: NavigationTrace[];
  summary: Record<string, {
    count: number;
    avg: number;
    min: number;
    max: number;
    median: number;
    p95: number;
  }>;
}

async function analyzeNavigationTrace(inputFile: string): Promise<void> {
  console.log('📊 Navigation Trace Analyzer');
  console.log('═══════════════════════════════════════\n');

  // Read input file
  console.log(`📂 Reading: ${inputFile}`);
  const rawData = await readFile(inputFile, 'utf-8');
  const report: NavigationReport = JSON.parse(rawData);

  console.log(`✅ Loaded ${report.totalSteps} traces from ${report.totalIterations} iterations\n`);

  // Generate analysis
  const analysis = generateAnalysis(report);

  // Write markdown report
  const outputFile = inputFile.replace('.json', '.md');
  console.log(`📝 Writing analysis: ${outputFile}`);
  await writeFile(outputFile, analysis, 'utf-8');

  console.log('✅ Analysis complete!\n');
  console.log(`📄 Report: ${outputFile}`);
}

function generateAnalysis(report: NavigationReport): string {
  const { capturedAt, browser, totalIterations, traces, summary } = report;

  const lines: string[] = [];

  // Header
  lines.push(`# Navigation Trace Analysis`);
  lines.push('');
  lines.push(`**Captured:** ${new Date(capturedAt).toLocaleString()}`);
  lines.push(`**Browser:** ${browser}`);
  lines.push(`**Iterations:** ${totalIterations}`);
  lines.push('');

  // Overview
  lines.push(`## Overview`);
  lines.push('');
  lines.push(`Analysis of real user navigation through CMSNext application across ${totalIterations} complete workflows.`);
  lines.push('');

  // Navigation Steps
  lines.push(`## Navigation Workflow`);
  lines.push('');
  lines.push('1. **Dashboard Load** - Initial page load');
  lines.push('2. **Navigate to List** - Click "View All Cases"');
  lines.push('3. **List Loaded** - Case list rendered');
  lines.push('4. **Navigate to Detail** - Click first case');
  lines.push('5. **Detail Loaded** - Case details rendered');
  lines.push('6. **Navigate Back** - Return to dashboard');
  lines.push('');

  // Performance Summary Table
  lines.push(`## Performance Summary`);
  lines.push('');
  lines.push('| Step | Count | Avg (ms) | Min (ms) | Max (ms) | Median (ms) | P95 (ms) |');
  lines.push('|------|-------|----------|----------|----------|-------------|----------|');

  Object.entries(summary).forEach(([stepName, stats]) => {
    const label = getStepLabel(stepName);
    lines.push(`| ${label} | ${stats.count} | ${stats.avg} | ${stats.min} | ${stats.max} | ${stats.median} | ${stats.p95} |`);
  });

  lines.push('');

  // Key Findings
  lines.push(`## Key Findings`);
  lines.push('');

  const findings = generateFindings(summary, traces);
  findings.forEach(finding => lines.push(finding));
  lines.push('');

  // Memory Analysis
  if (traces.some(t => t.memory)) {
    lines.push(`## Memory Analysis`);
    lines.push('');
    const memoryAnalysis = analyzeMemory(traces);
    memoryAnalysis.forEach(line => lines.push(line));
    lines.push('');
  }

  // Detailed Traces
  lines.push(`## Detailed Trace Data`);
  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Click to expand full trace data</summary>');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(traces, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</details>');
  lines.push('');

  // Recommendations
  lines.push(`## Recommendations`);
  lines.push('');
  const recommendations = generateRecommendations(summary);
  recommendations.forEach(rec => lines.push(rec));
  lines.push('');

  return lines.join('\n');
}

function getStepLabel(stepName: string): string {
  const labels: Record<string, string> = {
    'dashboard-load': '📊 Dashboard Load',
    'navigate-to-list': '→ Navigate to List',
    'list-loaded': '📋 List Loaded',
    'navigate-to-detail': '→ Navigate to Detail',
    'detail-loaded': '📄 Detail Loaded',
    'navigate-back': '← Navigate Back',
  };
  return labels[stepName] || stepName;
}

function generateFindings(summary: NavigationReport['summary'], traces: NavigationTrace[]): string[] {
  const findings: string[] = [];

  // Find slowest step
  let slowestStep = '';
  let slowestAvg = 0;
  Object.entries(summary).forEach(([step, stats]) => {
    if (stats.avg > slowestAvg) {
      slowestAvg = stats.avg;
      slowestStep = step;
    }
  });

  findings.push(`### Slowest Navigation Step`);
  findings.push(`**${getStepLabel(slowestStep)}** - Average: ${slowestAvg.toFixed(2)}ms`);
  findings.push('');

  // Find fastest step
  let fastestStep = '';
  let fastestAvg = Infinity;
  Object.entries(summary).forEach(([step, stats]) => {
    if (stats.avg < fastestAvg) {
      fastestAvg = stats.avg;
      fastestStep = step;
    }
  });

  findings.push(`### Fastest Navigation Step`);
  findings.push(`**${getStepLabel(fastestStep)}** - Average: ${fastestAvg.toFixed(2)}ms`);
  findings.push('');

  // Variance analysis
  findings.push(`### Consistency Analysis`);
  Object.entries(summary).forEach(([step, stats]) => {
    const variance = stats.max - stats.min;
    const variancePercent = stats.avg > 0 ? (variance / stats.avg) * 100 : 0;
    if (variancePercent > 50) {
      findings.push(`⚠️ **${getStepLabel(step)}**: High variance (${variancePercent.toFixed(0)}% - ${stats.min}ms to ${stats.max}ms)`);
    }
  });
  findings.push('');

  return findings;
}

function analyzeMemory(traces: NavigationTrace[]): string[] {
  const lines: string[] = [];

  const memoryTraces = traces.filter(t => t.memory);
  if (memoryTraces.length === 0) return ['No memory data available.'];

  const firstMemory = memoryTraces[0].memory!.usedJSHeapSize;
  const lastMemory = memoryTraces[memoryTraces.length - 1].memory!.usedJSHeapSize;
  const deltaMemory = lastMemory - firstMemory;
  const deltaMB = deltaMemory / 1024 / 1024;

  lines.push(`**Initial Memory:** ${(firstMemory / 1024 / 1024).toFixed(2)} MB`);
  lines.push(`**Final Memory:** ${(lastMemory / 1024 / 1024).toFixed(2)} MB`);
  lines.push(`**Memory Delta:** ${deltaMB > 0 ? '+' : ''}${deltaMB.toFixed(2)} MB`);
  lines.push('');

  if (deltaMB > 5) {
    lines.push(`⚠️ **Potential memory leak detected**: Memory increased by ${deltaMB.toFixed(2)} MB over ${traces.length} navigation steps.`);
  } else if (deltaMB > 2) {
    lines.push(`ℹ️ **Moderate memory growth**: Memory increased by ${deltaMB.toFixed(2)} MB. Monitor for leaks.`);
  } else {
    lines.push(`✅ **Memory stable**: Memory delta is within acceptable range.`);
  }

  return lines;
}

function generateRecommendations(summary: NavigationReport['summary']): string[] {
  const recommendations: string[] = [];

  // Check for slow navigations
  Object.entries(summary).forEach(([step, stats]) => {
    if (stats.avg > 500) {
      recommendations.push(`- ⚠️ **${getStepLabel(step)}** averages ${stats.avg.toFixed(0)}ms - consider optimizing route transitions or data loading.`);
    }
  });

  // Check for high variance
  Object.entries(summary).forEach(([step, stats]) => {
    const variance = stats.max - stats.min;
    const variancePercent = stats.avg > 0 ? (variance / stats.avg) * 100 : 0;
    if (variancePercent > 100) {
      recommendations.push(`- ⚠️ **${getStepLabel(step)}** shows high variance (${variancePercent.toFixed(0)}%) - investigate inconsistent performance.`);
    }
  });

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push(`- ✅ Navigation performance is within acceptable thresholds.`);
    recommendations.push(`- 💡 Consider code-splitting to further reduce initial load times.`);
    recommendations.push(`- 💡 Implement route preloading for frequently accessed paths.`);
  }

  return recommendations;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Missing input file');
  console.error('');
  console.error('Usage: npx tsx scripts/analyzeNavigationTrace.ts <input-json-file>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/analyzeNavigationTrace.ts reports/performance/navigation-trace-2025-10-17.json');
  process.exit(1);
}

const inputFile = resolve(args[0]);

analyzeNavigationTrace(inputFile)
  .then(() => {
    console.log('');
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
