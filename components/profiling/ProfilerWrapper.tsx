/**
 * ProfilerWrapper Component
 * 
 * Wraps application content with React.Profiler to capture rendering performance data.
 * Useful for manual profiling sessions to identify slow components and render bottlenecks.
 * 
 * USAGE:
 * 1. Wrap your app content in development/staging:
 *    <ProfilerWrapper id="AppContent">
 *      <YourApp />
 *    </ProfilerWrapper>
 * 
 * 2. Enable profiling in App.tsx by uncommenting ProfilerWrapper
 * 3. Perform user workflows in browser
 * 4. Check console for profiling data
 * 5. Download profiling data using window.downloadProfilerData()
 * 
 * FEATURES:
 * - Captures mount and update phases
 * - Records duration, base duration, start time
 * - Tracks interactions (user events that triggered renders)
 * - Console logging for real-time feedback
 * - JSON export for analysis
 */

import React, { Profiler, ProfilerOnRenderCallback, useRef, useEffect } from 'react';

interface ProfilerData {
  id: string;
  phase: 'mount' | 'update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions: Set<unknown>;
  timestamp: string;
}

interface ProfilerWrapperProps {
  id: string;
  children: React.ReactNode;
  enabled?: boolean;
}

// Global storage for profiler data (accessible via window.profilerData)
declare global {
  interface Window {
    profilerData: ProfilerData[];
    downloadProfilerData: () => void;
    clearProfilerData: () => void;
  }
}

const profilerDataStore: ProfilerData[] = [];

const DEFAULT_PROFILER_ENABLED =
  typeof import.meta !== 'undefined' ? import.meta.env.DEV : false;

/**
 * ProfilerWrapper Component
 * 
 * Wraps children with React.Profiler and captures rendering metrics.
 */
export function ProfilerWrapper({ id, children, enabled = DEFAULT_PROFILER_ENABLED }: ProfilerWrapperProps) {
  const renderCountRef = useRef(0);

  useEffect(() => {
    if (enabled) {
      // Initialize global access
      window.profilerData = profilerDataStore;
      window.downloadProfilerData = downloadProfilerData;
      window.clearProfilerData = clearProfilerData;

      console.log('%c🔬 ProfilerWrapper initialized', 'color: #8b5cf6; font-weight: bold;');
      console.log('%c  Use window.profilerData to access render data', 'color: #a78bfa;');
      console.log('%c  Use window.downloadProfilerData() to export JSON', 'color: #a78bfa;');
      console.log('');
    }

    return () => {
      // Cleanup on unmount
      if (enabled && window.profilerData) {
        console.log('%c🔬 ProfilerWrapper unmounted', 'color: #8b5cf6; font-weight: bold;');
        console.log(`   Total renders captured: ${profilerDataStore.length}`);
        console.log('');
      }
    };
  }, [enabled]);

  const onRenderCallback: ProfilerOnRenderCallback = (
    ...args
  ) => {
    const [
      profilerId,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    ] = args;
    const maybeInteractions = (args as unknown[])[6] as Set<unknown> | undefined;
    if (!enabled) return;
    const safePhase: 'mount' | 'update' = phase === 'mount' ? 'mount' : 'update';

    renderCountRef.current++;

    const data: ProfilerData = {
      id: profilerId,
      phase: safePhase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
  interactions: maybeInteractions instanceof Set ? new Set(maybeInteractions) : new Set(),
      timestamp: new Date().toISOString(),
    };

    profilerDataStore.push(data);

    // Log significant renders (>16ms indicates potential jank)
    if (actualDuration > 16) {
      console.log(
        `%c⚠️ Slow render detected`,
        'color: #f59e0b; font-weight: bold;',
        `${profilerId} (${safePhase})`,
        `${actualDuration.toFixed(2)}ms`
      );
    }

    // Log every 10th render for progress tracking
    if (renderCountRef.current % 10 === 0) {
      console.log(
        `%c📊 Profiler progress:`,
        'color: #3b82f6;',
        `${renderCountRef.current} renders captured`
      );
    }
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
}

/**
 * Download profiler data as JSON file
 */
function downloadProfilerData() {
  if (profilerDataStore.length === 0) {
    console.warn('⚠️ No profiler data to download. Perform some interactions first.');
    return;
  }

  const report = {
    capturedAt: new Date().toISOString(),
    browser: navigator.userAgent,
    totalRenders: profilerDataStore.length,
    data: profilerDataStore.map(d => ({
      ...d,
      interactions: Array.from(d.interactions), // Convert Set to Array for JSON
    })),
    summary: generateSummary(profilerDataStore),
  };

  const dataStr = JSON.stringify(report, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `profiler-session-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('✅ Profiler data downloaded!');
  console.log(`   Total renders: ${profilerDataStore.length}`);
  console.log(`   File: profiler-session-${new Date().toISOString().split('T')[0]}.json`);
}

/**
 * Clear all profiler data
 */
function clearProfilerData() {
  profilerDataStore.length = 0;
  console.log('✅ Profiler data cleared.');
}

/**
 * Generate summary statistics from profiler data
 */
function generateSummary(data: ProfilerData[]) {
  if (data.length === 0) return null;

  const durations = data.map(d => d.actualDuration);
  const sorted = [...durations].sort((a, b) => a - b);

  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = totalDuration / durations.length;
  const minDuration = sorted[0];
  const maxDuration = sorted[sorted.length - 1];
  const len = sorted.length;
  const medianDuration = len % 2 === 0
    ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
    : sorted[Math.floor(len / 2)];
  const p95Index = Math.min(Math.ceil(len * 0.95) - 1, len - 1);
  const p95Duration = sorted[Math.max(p95Index, 0)];

  const slowRenders = data.filter(d => d.actualDuration > 16).length;
  const slowRenderPercent = (slowRenders / data.length) * 100;

  const mountCount = data.filter(d => d.phase === 'mount').length;
  const updateCount = data.filter(d => d.phase === 'update').length;

  return {
    totalRenders: data.length,
    totalDuration: Math.round(totalDuration * 100) / 100,
    avgDuration: Math.round(avgDuration * 100) / 100,
    minDuration: Math.round(minDuration * 100) / 100,
    maxDuration: Math.round(maxDuration * 100) / 100,
    medianDuration: Math.round(medianDuration * 100) / 100,
    p95Duration: Math.round(p95Duration * 100) / 100,
    slowRenders,
    slowRenderPercent: Math.round(slowRenderPercent * 100) / 100,
    mountCount,
    updateCount,
  };
}
