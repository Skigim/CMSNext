import { useMemo } from 'react';
import type { StoredCase } from '../types/case';
import type { AlertsIndex } from '../utils/alertsData';
import { getPriorityCases, type PriorityCase } from '../domain/dashboard/priorityQueue';

/**
 * Hook for Today's Work widget data.
 * 
 * Consumes cases and alerts from context, uses domain functions
 * for priority calculation, and provides data to widget component.
 * 
 * @param cases - All cases from context
 * @param alertsIndex - Alerts index with case mapping
 * @param limit - Maximum priority cases to return (default: 10)
 * @returns Priority cases sorted by score
 * 
 * @example
 * ```tsx
 * const priorityCases = useTodaysWork(cases, alertsIndex, 5);
 * ```
 */
export function useTodaysWork(
  cases: StoredCase[],
  alertsIndex: AlertsIndex,
  limit: number = 10
): PriorityCase[] {
  // Use domain logic to calculate priority cases
  const priorityCases = useMemo(() => {
    return getPriorityCases(cases, alertsIndex, limit);
  }, [cases, alertsIndex, limit]);

  return priorityCases;
}
