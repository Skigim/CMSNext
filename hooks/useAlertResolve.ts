import { useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { StoredCase } from "@/types/case";
import type { DataManager } from "@/utils/DataManager";
import {
  buildAlertStorageKey,
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
  cases: StoredCase[];
  selectedCase: StoredCase | null;
  setAlertsIndex: React.Dispatch<React.SetStateAction<AlertsIndex>>;
  reloadAlerts: () => Promise<void>;
}

export interface UseAlertResolveReturn {
  onResolveAlert: (alert: AlertWithMatch) => Promise<void>;
  applyOverrides: (index: AlertsIndex) => AlertsIndex;
}

/** Handles alert resolution and reopening with optimistic updates and background persistence */
export function useAlertResolve(config: UseAlertResolveConfig): UseAlertResolveReturn {
  const { dataManager, isMounted, cases, selectedCase, setAlertsIndex, reloadAlerts } = config;
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

    const identifier = buildAlertStorageKey(alert) ?? alert.id;
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
    // Capture current cases to avoid stale closure
    const currentCases = [...cases];
    alertWriteQueue.enqueue(alert.id, async () => {
      await dataManager.updateAlertStatus(identifier, isResolved
        ? { status: "in-progress", resolvedAt: null, resolutionNotes: alert.resolutionNotes }
        : { status: "resolved", resolvedAt, resolutionNotes: alert.resolutionNotes }, { cases: currentCases });
    });

    // Return immediately - write happens in background
  }, [applyOverrides, cases, dataManager, selectedCase, setAlertsIndex]);

  return { onResolveAlert, applyOverrides };
}
