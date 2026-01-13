import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsMounted } from "./useIsMounted";
import { useAlertResolve } from "./useAlertResolve";
import { useDataSync } from "./useDataSync";
import type { StoredCase } from "@/types/case";
import type { DataManager } from "@/utils/DataManager";
import { createEmptyAlertsIndex, filterOpenAlerts, type AlertsIndex, type AlertWithMatch } from "@/utils/alertsData";
import { ENABLE_SAMPLE_ALERTS } from "@/utils/featureFlags";
import { createLogger } from "@/utils/logger";
import { LegacyFormatError } from "@/utils/services/FileStorageService";

/**
 * Options for useAlertsFlow hook.
 * @interface UseAlertsFlowOptions
 */
interface UseAlertsFlowOptions {
  /** Currently selected case (or null if none) */
  selectedCase: StoredCase | null;
  /** Whether initial case data has loaded */
  hasLoadedData: boolean;
  /** DataManager instance for alert operations */
  dataManager: DataManager | null;
}

/**
 * Return type for useAlertsFlow hook.
 * @interface UseAlertsFlowResult
 */
interface UseAlertsFlowResult {
  /** Complete alerts index with all alerts and their statuses */
  alertsIndex: AlertsIndex;
  /** Filtered list of open (unresolved) alerts */
  openAlerts: AlertWithMatch[];
  /** Handler to resolve/dismiss an alert */
  onResolveAlert: (alert: AlertWithMatch) => Promise<void>;
  /** Handler called when CSV alerts are imported */
  onAlertsCsvImported: (index: AlertsIndex) => void;
  /** Manual reload of alerts from data manager */
  reloadAlerts: () => Promise<void>;
}

const logger = createLogger("AlertsFlow");

/**
 * Alerts management workflow hook.
 * 
 * Manages the complete alerts system: loading, filtering, resolving, and matching.
 * Automatically reloads alerts when case changes or file data updates.
 * 
 * ## Workflow
 * 
 * 1. **Load**: Fetch all alerts from data manager
 * 2. **Match**: Match alerts to existing cases by MCN
 * 3. **Filter**: Show only open (unresolved) alerts
 * 4. **Resolve**: Mark alert as resolved when matched
 * 
 * ## Alerts States
 * 
 * Each alert can be in one of several states:
 * - **unmatched**: MCN present but no matching case found
 * - **missing-mcn**: No MCN in alert data
 * - **matched**: Matched to existing case
 * - **resolved**: Dismissed by user
 * 
 * ## Usage Example
 * 
 * ```typescript
 * function AlertsPanel() {
 *   const cases = useCases();
 *   const { openAlerts, onResolveAlert, reloadAlerts } = useAlertsFlow({
 *     selectedCase: cases[0] || null,
 *     hasLoadedData: true,
 *     dataManager
 *   });
 *   
 *   return (
 *     <div>
 *       <h2>Open Alerts ({openAlerts.length})</h2>
 *       {openAlerts.map(alert => (
 *         <AlertItem
 *           key={alert.id}
 *           alert={alert}
 *           onResolve={() => onResolveAlert(alert)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Auto-Reload
 * 
 * Alerts automatically reload when:
 * - Selected case changes
 * - File data is updated (CSV import, case changes)
 * - Initial data finishes loading
 * 
 * ## Match Resolution
 * 
 * When user resolves alert matching:
 * 1. Alert moves to resolved state
 * 2. Removed from open alerts list
 * 3. Case linked to alert (if match found)
 * 
 * @hook
 * @param {UseAlertsFlowOptions} options - Hook configuration
 * @returns {UseAlertsFlowResult} Alerts state and handlers
 * 
 * @see {@link useAlertResolve} for alert resolution logic
 * @see {@link DataManager} for underlying persistence
 */
export function useAlertsFlow({ selectedCase, hasLoadedData, dataManager }: UseAlertsFlowOptions): UseAlertsFlowResult {
  const isMounted = useIsMounted();
  const [alertsIndex, setAlertsIndex] = useState<AlertsIndex>(() => createEmptyAlertsIndex());
  const previousAlertCountsRef = useRef({ unmatched: 0, missingMcn: 0 });

  // Use ref to break circular dependency between reloadAlerts and resolve
  const applyOverridesRef = useRef<(index: AlertsIndex) => AlertsIndex>((i) => i);

  // Reload alerts from data manager
  const reloadAlerts = useCallback(async () => {
    if (!dataManager || !hasLoadedData) {
      setAlertsIndex(createEmptyAlertsIndex()); return;
    }
    try {
      // Don't pass cases from React state - let getAlertsIndex use cases from file
      // This ensures skeleton cases created during import are always included
      const nextAlerts = await dataManager.getAlertsIndex();
      if (!isMounted.current) return;
      const afterOverrides = applyOverridesRef.current(nextAlerts);
      setAlertsIndex(afterOverrides);
    } catch (error) {
      if (error instanceof LegacyFormatError) {
        logger.warn("Legacy format detected in alerts", { message: error.message });
      } else {
        logger.error("Failed to load alerts", { error: error instanceof Error ? error.message : String(error) });
      }
      if (isMounted.current) setAlertsIndex(createEmptyAlertsIndex());
    }
  }, [dataManager, hasLoadedData, isMounted]);

  // Use alert resolution hook (needs reloadAlerts as dependency)
  const resolve = useAlertResolve({
    dataManager,
    isMounted,
    selectedCase,
    setAlertsIndex,
    reloadAlerts,
  });

  // Keep ref in sync with resolve.applyOverrides
  useEffect(() => {
    applyOverridesRef.current = resolve.applyOverrides;
  }, [resolve.applyOverrides]);

  // Sync with file storage data changes
  useDataSync({ onRefresh: reloadAlerts });

  // Handle CSV import
  const onAlertsCsvImported = useCallback((index: AlertsIndex) => {
    setAlertsIndex(resolve.applyOverrides(index));
  }, [resolve]);

  // Filter open alerts
  const openAlerts = useMemo(() => filterOpenAlerts(alertsIndex.alerts), [alertsIndex.alerts]);

  // Show notification when alert match status changes
  useEffect(() => {
    if (!ENABLE_SAMPLE_ALERTS) return;

    const { unmatched, missingMcn } = alertsIndex.summary;
    const prev = previousAlertCountsRef.current;

    if ((unmatched > 0 || missingMcn > 0) && (unmatched !== prev.unmatched || missingMcn !== prev.missingMcn)) {
      const parts: string[] = [];
      if (unmatched > 0) parts.push(`${unmatched} alert${unmatched === 1 ? "" : "s"} need${unmatched === 1 ? "s" : ""} a case match`);
      if (missingMcn > 0) parts.push(`${missingMcn} alert${missingMcn === 1 ? "" : "s"} missing an MCN`);
      toast.warning(`Heads up: ${parts.join(" and ")}`, { id: "alerts-match-status" });
    }

    previousAlertCountsRef.current = { unmatched, missingMcn };
  }, [alertsIndex.summary]);

  return { alertsIndex, openAlerts, onResolveAlert: resolve.onResolveAlert, onAlertsCsvImported, reloadAlerts };
}
