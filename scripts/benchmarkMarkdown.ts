export interface BenchmarkSummary {
  totalTests: number;
  passed: number;
  failed: number;
  overallPassed: boolean;
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
