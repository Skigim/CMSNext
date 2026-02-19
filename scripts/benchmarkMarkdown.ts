import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface BenchmarkSummary {
  totalTests: number;
  passed: number;
  failed: number;
  overallPassed: boolean;
}

export interface BenchmarkStats {
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
}

export interface BenchmarkResultBase {
  scenario: string;
  avg: number;
  threshold: number;
  passed: boolean;
}

export interface BenchmarkReportBase {
  timestamp: string;
  summary: BenchmarkSummary;
}

interface BenchmarkMarkdownOptions {
  title: string;
  timestamp: string;
  summary: BenchmarkSummary;
  tableHeader: string;
  tableDivider: string;
  resultRows: string[];
  successLines: string[];
  failureHeading: string;
  failedScenarioLines: string[];
  recommendations: string[];
  appendixLines?: string[];
}

export function generateBenchmarkMarkdown(options: BenchmarkMarkdownOptions): string {
  const lines: string[] = [
    options.title,
    '',
    `**Date:** ${new Date(options.timestamp).toLocaleString()}`,
    `**Status:** ${options.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`,
    '',
    '## Summary',
    '',
    `- Total Tests: ${options.summary.totalTests}`,
    `- Passed: ${options.summary.passed}`,
    `- Failed: ${options.summary.failed}`,
    '',
    '## Results',
    '',
    options.tableHeader,
    options.tableDivider,
    ...options.resultRows,
    '',
    '## Analysis',
    '',
  ];

  if (options.summary.overallPassed) {
    lines.push(...options.successLines);
  } else {
    lines.push(options.failureHeading, '', '**Failed scenarios:**', ...options.failedScenarioLines, '');
    lines.push('**Recommendations:**', ...options.recommendations);
  }

  if (options.appendixLines && options.appendixLines.length > 0) {
    lines.push('', ...options.appendixLines);
  }

  lines.push('');
  return lines.join('\n');
}

export function calculateBenchmarkStats(timings: number[]): BenchmarkStats {
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

export function createBenchmarkSummary(results: Array<{ passed: boolean }>): BenchmarkSummary {
  return {
    totalTests: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    overallPassed: results.every((result) => result.passed),
  };
}

export function buildFailedScenarioLines(results: BenchmarkResultBase[]): string[] {
  return results
    .filter((result) => !result.passed)
    .flatMap((result) => [
      `- **${result.scenario}**: Average ${result.avg.toFixed(2)}ms (threshold: ${result.threshold}ms)`,
      `  - Exceeded by ${(result.avg - result.threshold).toFixed(2)}ms`,
    ]);
}

export async function writeBenchmarkReports(
  filePrefix: string,
  report: BenchmarkReportBase,
  markdown: string,
): Promise<{ jsonFile: string; markdownFile: string }> {
  const reportsDir = resolve(process.cwd(), 'reports', 'performance');
  await mkdir(reportsDir, { recursive: true });

  const date = new Date().toISOString().split('T')[0];
  const jsonFile = resolve(reportsDir, `${filePrefix}-${date}.json`);
  const markdownFile = resolve(reportsDir, `${filePrefix}-${date}.md`);

  console.log(`💾 Writing JSON report: ${jsonFile}`);
  await writeFile(jsonFile, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`📝 Writing Markdown report: ${markdownFile}`);
  await writeFile(markdownFile, markdown, 'utf-8');

  return { jsonFile, markdownFile };
}
