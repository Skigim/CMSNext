/**
 * Chrome Performance Trace Script
 * 
 * Uses Puppeteer to record a performance trace for a given URL,
 * then extracts key metrics and generates a report.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

interface PerformanceMetrics {
  url: string;
  timestamp: string;
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    speedIndex: number;
    timeToInteractive: number;
  };
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  longTasks: Array<{ duration: number; startTime: number }>;
  scriptingTime: number;
  renderingTime: number;
  paintingTime: number;
  recommendations: string[];
}

async function analyzePerformance(url: string): Promise<PerformanceMetrics> {
  console.log(`🚀 Starting performance analysis for: ${url}`);
  
  // Import puppeteer dynamically to avoid bundling issues
  const puppeteer = await import('puppeteer');
  
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  // Enable performance tracking
  await page.evaluateOnNewDocument(() => {
    (window as any).__performanceMetrics = {
      longTasks: [],
      marks: {},
    };
  });

  console.log('📊 Starting trace...');
  await page.tracing.start({ 
    path: join(process.cwd(), 'reports', 'performance', `trace-${Date.now()}.json`),
    screenshots: true,
    categories: ['devtools.timeline', 'v8.execute', 'disabled-by-default-v8.cpu_profiler'],
  });

  const startTime = Date.now();
  
  // Navigate and wait for network idle
  console.log('🌐 Navigating to page...');
  await page.goto(url, { 
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // Collect Web Vitals
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const vitals: any = {};
        
        entries.forEach((entry) => {
          if (entry.entryType === 'largest-contentful-paint') {
            vitals.lcp = entry.startTime;
          }
          if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime;
          }
        });
        
        resolve(vitals);
      });
      
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
      
      // Fallback timeout
      setTimeout(() => resolve({}), 5000);
    });
  });

  // Get additional metrics
  const performanceMetrics = await page.metrics();
  
  console.log('⏱️  Collecting metrics...');
  
  const loadTime = Date.now() - startTime;
  console.log(`✅ Page loaded in ${loadTime}ms`);

  await page.tracing.stop();
  await browser.close();

  // Calculate recommendations
  const recommendations: string[] = [];
  const fcp = (metrics as any).fcp || 0;
  const lcp = (metrics as any).lcp || 0;

  if (fcp > 1800) {
    recommendations.push('❌ First Contentful Paint is slow (>1.8s). Consider optimizing critical rendering path.');
  } else if (fcp > 1000) {
    recommendations.push('⚠️  First Contentful Paint could be faster (<1s is ideal).');
  } else {
    recommendations.push('✅ First Contentful Paint is good.');
  }

  if (lcp > 2500) {
    recommendations.push('❌ Largest Contentful Paint is slow (>2.5s). Optimize largest image/text block.');
  } else if (lcp > 2000) {
    recommendations.push('⚠️  Largest Contentful Paint could be improved.');
  } else {
    recommendations.push('✅ Largest Contentful Paint is good.');
  }

  if (performanceMetrics.ScriptDuration && performanceMetrics.ScriptDuration > 2) {
    recommendations.push('⚠️  JavaScript execution time is high. Consider code splitting or lazy loading.');
  }

  if (performanceMetrics.LayoutDuration && performanceMetrics.LayoutDuration > 0.5) {
    recommendations.push('⚠️  Layout duration is significant. Check for layout thrashing.');
  }

  const result: PerformanceMetrics = {
    url,
    timestamp: new Date().toISOString(),
    metrics: {
      firstContentfulPaint: fcp,
      largestContentfulPaint: lcp,
      totalBlockingTime: 0,
      cumulativeLayoutShift: 0,
      speedIndex: 0,
      timeToInteractive: loadTime,
    },
    longTasks: [],
    scriptingTime: performanceMetrics.ScriptDuration || 0,
    renderingTime: performanceMetrics.LayoutDuration || 0,
    paintingTime: 0,
    recommendations,
  };

  return result;
}

async function main() {
  const url = process.argv[2] || 'https://developers.chrome.com';
  
  try {
    const results = await analyzePerformance(url);
    
    // Save report
    const reportPath = join(process.cwd(), 'reports', 'performance', `perf-report-${Date.now()}.json`);
    await writeFile(reportPath, JSON.stringify(results, null, 2));
    
    console.log('\n📈 Performance Report');
    console.log('═'.repeat(60));
    console.log(`URL: ${results.url}`);
    console.log(`Timestamp: ${results.timestamp}`);
    console.log('\n📊 Core Web Vitals:');
    console.log(`  First Contentful Paint: ${results.metrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`  Largest Contentful Paint: ${results.metrics.largestContentfulPaint.toFixed(2)}ms`);
    console.log(`  Time to Interactive: ${results.metrics.timeToInteractive.toFixed(2)}ms`);
    console.log('\n⚡ Resource Timing:');
    console.log(`  Scripting Time: ${results.scriptingTime.toFixed(3)}s`);
    console.log(`  Rendering Time: ${results.renderingTime.toFixed(3)}s`);
    console.log('\n💡 Recommendations:');
    results.recommendations.forEach((rec) => console.log(`  ${rec}`));
    console.log('\n📁 Full report saved to:', reportPath);
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('❌ Error during performance analysis:', error);
    process.exit(1);
  }
}

main();
