/**
 * Tombstone Hook for Dead Code Detection
 * =======================================
 * Drop this hook into components suspected of being dead code.
 * If the component mounts, it logs a warning via the logger service.
 * 
 * This is a runtime verification tool for the dead code detection workflow:
 * 1. Knip identifies statically unused code
 * 2. Chrome Coverage shows runtime execution
 * 3. useTombstone provides explicit logging for ambiguous components
 * 
 * After adding the hook, wait 2 weeks of normal usage. If no logs appear,
 * the component is likely safe to remove.
 * 
 * @example
 * ```tsx
 * import { useTombstone } from '@/hooks';
 * 
 * export const SuspectComponent = () => {
 *   useTombstone('SuspectComponent');
 *   return <div>Legacy Feature</div>;
 * };
 * ```
 * 
 * @module useTombstone
 */

import { useEffect } from 'react';
import { createLogger } from '@/utils/logger';

const logger = createLogger('Tombstone');

/**
 * Logs a warning when a component mounts, indicating it is still alive.
 * Only active in development mode to avoid production console noise.
 * 
 * @param componentName - The name of the component being monitored
 * @param metadata - Optional additional context about the component
 */
export function useTombstone(
  componentName: string,
  metadata?: Record<string, unknown>
): void {
  useEffect(() => {
    // Only log in development to avoid production noise
    if (import.meta.env.DEV) {
      logger.warn(`⚰️ TOMBSTONE ALERT: ${componentName} mounted and is ALIVE`, {
        componentName,
        timestamp: new Date().toISOString(),
        ...metadata,
      });
    }
  }, [componentName, metadata]);
}
