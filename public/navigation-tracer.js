/**
 * Navigation Tracer - Manual Browser Console Script
 * 
 * PURPOSE:
 * Capture real user navigation timing through CMSNext app.
 * This script is designed to be pasted into the browser DevTools console.
 * 
 * USAGE:
 * 1. Open app in browser (https://skigim.github.io/CMSNext/ or localhost:5173)
 * 2. Open DevTools Console (F12 or Cmd+Option+I)
 * 3. Paste this entire script and press Enter
 * 4. Follow the on-screen prompts to navigate through the app
 * 5. Script will collect timing data and provide JSON for download
 * 
 * WORKFLOW:
 * Dashboard → Case List → Case Detail → Back to Dashboard (repeat 5x)
 */

(function NavigationTracer() {
  'use strict';

  console.clear();
  console.log('%c📊 CMSNext Navigation Tracer', 'font-size: 16px; font-weight: bold; color: #3b82f6;');
  console.log('%c═══════════════════════════════════════', 'color: #3b82f6;');
  console.log('');
  console.log('This script will capture navigation performance data.');
  console.log('You will be prompted to navigate through the app 5 times.');
  console.log('');

  // Data storage
  const traces = [];
  let currentIteration = 0;
  let currentStep = 0;
  const totalIterations = 5;

  const navigationSteps = [
    { name: 'dashboard-load', label: '📊 Dashboard loaded', instruction: 'Make sure you are on the Dashboard (Home)' },
    { name: 'navigate-to-list', label: '📋 Navigate to Case List', instruction: 'Click "View All Cases" button' },
    { name: 'list-loaded', label: '📋 Case List loaded', instruction: 'Wait for list to fully load' },
    { name: 'navigate-to-detail', label: '📄 Navigate to Case Detail', instruction: 'Click on the first case in the list' },
    { name: 'detail-loaded', label: '📄 Case Detail loaded', instruction: 'Wait for case details to fully load' },
    { name: 'navigate-back', label: '🔙 Navigate back to Dashboard', instruction: 'Click browser back button or dashboard link' },
  ];

  // Utility: Capture current performance metrics
  function captureMetrics() {
    const now = performance.now();
    const memory = performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    } : null;

    return {
      timestamp: now,
      memory,
      url: window.location.href,
      pathname: window.location.pathname,
    };
  }

  // Main capture logic
  function captureStep(stepName) {
    const metrics = captureMetrics();
    const step = navigationSteps.find(s => s.name === stepName);

    const trace = {
      iteration: currentIteration + 1,
      stepIndex: currentStep,
      stepName,
      stepLabel: step?.label || stepName,
      ...metrics,
    };

    traces.push(trace);

    // Calculate duration from previous step
    if (traces.length > 1) {
      const prevTrace = traces[traces.length - 2];
      trace.durationFromPrevious = metrics.timestamp - prevTrace.timestamp;
    }

    performance.mark(`nav-${stepName}-${currentIteration}`);

    console.log(`%c✅ ${step?.label || stepName}`, 'color: #10b981; font-weight: bold;');
    if (trace.durationFromPrevious) {
      console.log(`   Duration from previous: ${trace.durationFromPrevious.toFixed(2)}ms`);
    }
    if (memory) {
      console.log(`   Memory used: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    }
    console.log('');
  }

  // Interactive prompt system
  function promptNextStep() {
    if (currentIteration >= totalIterations) {
      finishCapture();
      return;
    }

    const step = navigationSteps[currentStep];

    console.log(`%c🔔 Iteration ${currentIteration + 1}/${totalIterations} - Step ${currentStep + 1}/${navigationSteps.length}`, 'color: #f59e0b; font-weight: bold;');
    console.log(`📌 ${step.instruction}`);
    console.log('');
    console.log(`When ready, call: %cwindow.navStep()`, 'background: #1e293b; color: #fbbf24; padding: 2px 6px; border-radius: 3px;');
    console.log('');
  }

  // Step handler
  window.navStep = function() {
    const step = navigationSteps[currentStep];
    captureStep(step.name);

    currentStep++;

    // Check if iteration complete
    if (currentStep >= navigationSteps.length) {
      currentStep = 0;
      currentIteration++;

      if (currentIteration < totalIterations) {
        console.log('%c✨ Iteration complete! Starting next iteration...', 'color: #8b5cf6; font-weight: bold;');
        console.log('');
        setTimeout(promptNextStep, 1000);
      } else {
        finishCapture();
      }
    } else {
      promptNextStep();
    }
  };

  // Finish and export data
  function finishCapture() {
    console.log('');
    console.log('%c🎉 Navigation tracing complete!', 'font-size: 16px; font-weight: bold; color: #10b981;');
    console.log('%c═══════════════════════════════════════', 'color: #10b981;');
    console.log('');

    // Calculate summary statistics
    const summary = calculateSummary();

    const report = {
      capturedAt: new Date().toISOString(),
      browser: navigator.userAgent,
      totalIterations,
      totalSteps: traces.length,
      traces,
      summary,
    };

    console.log('📊 Summary Statistics:');
    console.log(summary);
    console.log('');
    console.log('📥 Download the full trace data:');
    console.log(`Call: %cwindow.downloadTrace()`, 'background: #1e293b; color: #3b82f6; padding: 2px 6px; border-radius: 3px;');
    console.log('');
    console.log('Or access the data directly:');
    console.log(`%cwindow.navigationTraceData`, 'background: #1e293b; color: #3b82f6; padding: 2px 6px; border-radius: 3px;');
    console.log('');

    window.navigationTraceData = report;

    // Auto-download function
    window.downloadTrace = function() {
      const dataStr = JSON.stringify(report, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `navigation-trace-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('✅ Trace data downloaded!');
    };
  }

  // Calculate summary statistics
  function calculateSummary() {
    const stepGroups = {};

    traces.forEach(trace => {
      if (!stepGroups[trace.stepName]) {
        stepGroups[trace.stepName] = [];
      }
      if (trace.durationFromPrevious) {
        stepGroups[trace.stepName].push(trace.durationFromPrevious);
      }
    });

    const summary = {};

    Object.keys(stepGroups).forEach(stepName => {
      const durations = stepGroups[stepName];
      if (durations.length === 0) return;

      const sorted = [...durations].sort((a, b) => a - b);
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];

      summary[stepName] = {
        count: durations.length,
        avg: Math.round(avg * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        median: Math.round(median * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
      };
    });

    return summary;
  }

  // Start the process
  console.log('');
  console.log('%c🚀 Ready to start!', 'color: #3b82f6; font-weight: bold;');
  console.log('');
  promptNextStep();

})();
