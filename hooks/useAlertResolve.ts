import { useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { StoredCase } from "@/types/case";
import type { DataManager } from "@/utils/DataManager";
import {
  createAlertsIndexFromAlerts,
  type AlertsIndex,
  type AlertWithMatch,
} from "@/utils/alertsData";
import { createLogger } from "@/utils/logger";
import { alertWriteQueue } from "@/utils/alertWriteQueue";

const logger = createLogger("AlertResolve");

interface ResolvedOverride {
  status?: AlertWithMatch["status"];
  resolvedAt?: string | null;
  resolutionNotes?: string;
}

export interface UseAlertResolveConfig {
  dataManager: DataManager | null;
  isMounted: React.MutableRefObject<boolean>;
  selectedCase: StoredCase | null;
  setAlertsIndex: React.Dispatch<React.SetStateAction<AlertsIndex>>;
  reloadAlerts: () => Promise<void>;
}

export interface UseAlertResolveReturn {
  onResolveAlert: (alert: AlertWithMatch) => Promise<void>;
  applyOverrides: (index: AlertsIndex) => AlertsIndex;
}

/**
 * Hook for handling alert resolution with optimistic UI updates and background persistence
 * 
 * Provides optimistic alert status updates (toggle resolved ↔ in-progress) with:
 * - Immediate UI update via applyOverrides()
 * - Background write via alertWriteQueue for persistence
 * - Automatic reload on success, error toast on failure
 * - Error recovery without blocking UI
 * 
 * **Status Transitions:**
 * - resolved → in-progress: Mark as work-in-progress (clear resolvedAt)
 * - in-progress → resolved: Mark complete (set resolvedAt = now, preserve notes)
 * 
 * **Optimistic Update Flow:**
 * 1. User clicks resolve button on alert
 * 2. onResolveAlert() immediately updates local state via applyOverrides()
 * 3. UI re-renders with new status (alert appears resolved/reopened)
 * 4. Background queue persists change to file system
 * 5. On success: Silent reload to sync with any other clients
 * 6. On error: Show toast, clear override to revert optimistic update
 * 
 * **Resolution Notes:**
 * - Persisted when toggling resolved → in-progress
 * - User can edit in modal before resolving
 * - Preserved on status changes for context/audit trail
 * 
 * **Background Write Queue:**
 * - Uses alertWriteQueue to serialize writes and handle retries
 * - Non-blocking: Returns immediately after setting override
 * - If unmounted during write: Continues in background, no UI feedback
 * - On failure: Only shows error toast if still mounted
 * 
 * **Case Validation:**
 * - Alert.matchedCaseId must match selectedCase.id (or be undefined)
 * - Prevents updating alerts for wrong case in multi-select scenario
 * - Silent error toast if case mismatch detected
 * 
 * **Dependencies:**
 * - Requires alerts have unique `alert.id` (primary key for updates)
 * - Requires dataManager for updateAlertStatus() operations
 * - Requires useIsMounted to prevent updates after unmount
 * 
 * **Usage Example:**
 * ```typescript
 * const alerts = useAlertResolve({
 *   dataManager: dm,
 *   isMounted: isMountedRef,
 *   selectedCase: currentCase,
 *   setAlertsIndex: setAlerts,
 *   reloadAlerts: async () => {
 *     const fresh = await dm.getAlertsIndex({ cases: [currentCase] });
 *     setAlerts(fresh);
 *   }
 * });
 * 
 * // In alert list item
 * <button onClick={() => alerts.onResolveAlert(alert)}>
 *   {alert.status === "resolved" ? "Reopen" : "Resolve"}
 * </button>
 * 
 * // In selector
 * const visibleAlerts = alerts.applyOverrides(alertsIndex).alerts
 *   .filter(a => a.status !== "resolved");
 * ```
 * 
 * **Error Handling:**
 * - Missing dataManager: Error toast "Alerts service is not ready..."
 * - Case mismatch: Silent error (internal state inconsistency)
 * - Write queue failure: Error toast "Alert update failed. Please try again."
 * - Unmounted errors: Logs but no UI feedback
 * 
 * @param {UseAlertResolveConfig} config
 *   - `dataManager`: DataManager instance for updateAlertStatus calls
 *   - `isMounted`: Ref to boolean indicating component mount state
 *   - `selectedCase`: Current case context (alerts must belong to this case)
 *   - `setAlertsIndex`: State setter to apply overrides to UI
 *   - `reloadAlerts`: Async function to refresh alerts after background write succeeds
 * 
 * @returns {UseAlertResolveReturn} Resolution handlers:
 * - `onResolveAlert(alert)`: Toggle alert resolution (optimistic + background)
 * - `applyOverrides(index)`: Apply pending overrides to alerts index for UI
 */
export function useAlertResolve(config: UseAlertResolveConfig): UseAlertResolveReturn {
  const { dataManager, isMounted, selectedCase, setAlertsIndex, reloadAlerts } = config;
  const overridesRef = useRef(new Map<string, ResolvedOverride>());

  // Set up queue callbacks for background write results
  useEffect(() => {
    alertWriteQueue.setCallbacks({
      onSuccess: (alertId) => {
        // Clear override after successful write
        overridesRef.current.delete(alertId);
        // Silently reload alerts if still mounted
        if (isMounted.current) {
          reloadAlerts().catch(() => {
            // Silent reload failure - data will sync on next user action
          });
        }
      },
      onError: (alertId, error) => {
        logger.error('Background alert write failed', { alertId, error: error.message });
        // Clear override to revert optimistic update
        overridesRef.current.delete(alertId);
        // Show error toast only if mounted
        if (isMounted.current) {
          toast.error("Alert update failed. Please try again.");
          reloadAlerts().catch(() => {});
        }
      },
    });

    return () => {
      // Clear callbacks on unmount (writes continue but no notifications)
      alertWriteQueue.setCallbacks({});
    };
  }, [isMounted, reloadAlerts]);

  const applyOverrides = useCallback((index: AlertsIndex): AlertsIndex => {
    if (overridesRef.current.size === 0) return index;

    let hasChanges = false;
    const adjustedAlerts = index.alerts.map(alert => {
      const override = overridesRef.current.get(alert.id);
      if (!override) return alert;

      const nextStatus = override.status ?? alert.status;
      const hasResolvedAtOverride = Object.prototype.hasOwnProperty.call(override, "resolvedAt");
      const nextResolvedAt = hasResolvedAtOverride ? override.resolvedAt ?? null : alert.resolvedAt ?? null;
      const nextResolutionNotes = override.resolutionNotes ?? alert.resolutionNotes;

      if (alert.status === nextStatus && (alert.resolvedAt ?? null) === nextResolvedAt && alert.resolutionNotes === nextResolutionNotes) {
        return alert;
      }

      hasChanges = true;
      return { ...alert, status: nextStatus, resolvedAt: nextResolvedAt, resolutionNotes: nextResolutionNotes } satisfies AlertWithMatch;
    });

    return hasChanges ? createAlertsIndexFromAlerts(adjustedAlerts) : index;
  }, []);

  const onResolveAlert = useCallback(async (alert: AlertWithMatch) => {
    if (selectedCase && alert.matchedCaseId && alert.matchedCaseId !== selectedCase.id) {
      toast.error("Unable to update alert for this case."); return;
    }
    if (!dataManager) {
      toast.error("Alerts service is not ready. Try again after reconnecting."); return;
    }

    // Use alert.id directly - it's unique per alert in our data store
    // buildAlertStorageKey is for deduplication during CSV import, not for updates
    const identifier = alert.id;
    if (!identifier) {
      logger.warn("Alert identifier missing; skipping resolution", { alertId: alert.id });
      toast.error("Unable to resolve alert. Please try again."); return;
    }

    const isResolved = alert.status === "resolved";
    const resolvedAt = new Date().toISOString();

    // Set optimistic override immediately
    overridesRef.current.set(alert.id, isResolved
      ? { status: "in-progress", resolvedAt: null }
      : { status: "resolved", resolvedAt, resolutionNotes: alert.resolutionNotes });
    setAlertsIndex(prev => applyOverrides(prev));

    // Queue write to happen in background - don't await
    // Don't pass cases from React state - updateAlertStatus will use cases from file
    // This ensures skeleton cases created during import are always included
    alertWriteQueue.enqueue(alert.id, async () => {
      await dataManager.updateAlertStatus(identifier, isResolved
        ? { status: "in-progress", resolvedAt: null, resolutionNotes: alert.resolutionNotes }
        : { status: "resolved", resolvedAt, resolutionNotes: alert.resolutionNotes });
    });

    // Return immediately - write happens in background
  }, [applyOverrides, dataManager, selectedCase, setAlertsIndex]);

  return { onResolveAlert, applyOverrides };
}
