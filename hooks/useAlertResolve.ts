import { useCallback, useRef } from "react";
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

/** Handles alert resolution and reopening with optimistic updates */
export function useAlertResolve(config: UseAlertResolveConfig): UseAlertResolveReturn {
  const { dataManager, isMounted, cases, selectedCase, setAlertsIndex, reloadAlerts } = config;
  const overridesRef = useRef(new Map<string, ResolvedOverride>());

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

    // Set optimistic override
    overridesRef.current.set(alert.id, isResolved
      ? { status: "in-progress", resolvedAt: null }
      : { status: "resolved", resolvedAt: new Date().toISOString(), resolutionNotes: alert.resolutionNotes });
    setAlertsIndex(prev => applyOverrides(prev));

    try {
      await dataManager.updateAlertStatus(identifier, isResolved
        ? { status: "in-progress", resolvedAt: null, resolutionNotes: alert.resolutionNotes }
        : { status: "resolved", resolvedAt: new Date().toISOString(), resolutionNotes: alert.resolutionNotes }, { cases });
      if (!isMounted.current) return;

      overridesRef.current.delete(alert.id);
      await reloadAlerts();
      toast.success(isResolved ? "Alert reopened" : "Alert resolved", {
        description: isResolved ? "We moved this alert back into the active queue." : "Add a note when you're ready to document the resolution.",
      });
    } catch (err) {
      logger.error(`Failed to ${isResolved ? 'reopen' : 'resolve'} alert`, { alertId: alert.id, error: err instanceof Error ? err.message : String(err) });
      if (!isMounted.current) return;
      overridesRef.current.delete(alert.id);
      await reloadAlerts();
      toast.error(`Unable to ${isResolved ? 'reopen' : 'resolve'} alert. Please try again.`);
    }
  }, [applyOverrides, cases, dataManager, isMounted, reloadAlerts, selectedCase, setAlertsIndex]);

  return { onResolveAlert, applyOverrides };
}
