import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsMounted } from "./useIsMounted";
import type { StoredCase } from "@/types/case";
import type { DataManager } from "@/utils/DataManager";
import { useFileStorageDataChange } from "@/contexts/FileStorageContext";
import {
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  buildAlertStorageKey,
  filterOpenAlerts,
  type AlertsIndex,
  type AlertWithMatch,
} from "@/utils/alertsData";
import { ENABLE_SAMPLE_ALERTS } from "@/utils/featureFlags";
import { createLogger } from "@/utils/logger";
import { LegacyFormatError } from "@/utils/services/FileStorageService";

interface UseAlertsFlowOptions {
  cases: StoredCase[];
  selectedCase: StoredCase | null;
  hasLoadedData: boolean;
  dataManager: DataManager | null;
}

interface UseAlertsFlowResult {
  alertsIndex: AlertsIndex;
  openAlerts: AlertWithMatch[];
  onResolveAlert: (alert: AlertWithMatch) => Promise<void>;
  onAlertsCsvImported: (index: AlertsIndex) => void;
  reloadAlerts: () => Promise<void>;
}

const logger = createLogger("AlertsFlow");

export function useAlertsFlow({
  cases,
  selectedCase,
  hasLoadedData,
  dataManager,
}: UseAlertsFlowOptions): UseAlertsFlowResult {
  const isMounted = useIsMounted();
  const [alertsIndex, setAlertsIndex] = useState<AlertsIndex>(() => createEmptyAlertsIndex());
  const resolvedAlertOverridesRef = useRef(
    new Map<string, { status?: AlertWithMatch["status"]; resolvedAt?: string | null; resolutionNotes?: string }>(),
  );
  const previousAlertCountsRef = useRef({ unmatched: 0, missingMcn: 0 });
  const dataChangeCount = useFileStorageDataChange();

  const applyAlertOverrides = useCallback(
    (index: AlertsIndex): AlertsIndex => {
      if (resolvedAlertOverridesRef.current.size === 0) {
        return index;
      }

      let hasChanges = false;
      const adjustedAlerts = index.alerts.map(alert => {
        const override = resolvedAlertOverridesRef.current.get(alert.id);
        if (!override) {
          return alert;
        }

        const nextStatus = override.status ?? alert.status;
        const hasResolvedAtOverride = Object.prototype.hasOwnProperty.call(override, "resolvedAt");
        const nextResolvedAt = hasResolvedAtOverride ? override.resolvedAt ?? null : alert.resolvedAt ?? null;
        const nextResolutionNotes = override.resolutionNotes ?? alert.resolutionNotes;

        if (
          alert.status === nextStatus &&
          (alert.resolvedAt ?? null) === nextResolvedAt &&
          alert.resolutionNotes === nextResolutionNotes
        ) {
          return alert;
        }

        hasChanges = true;
        return {
          ...alert,
          status: nextStatus,
          resolvedAt: nextResolvedAt,
          resolutionNotes: nextResolutionNotes,
        } satisfies AlertWithMatch;
      });

      if (!hasChanges) {
        return index;
      }

      return createAlertsIndexFromAlerts(adjustedAlerts);
    },
    [],
  );

  const syncAlertsIndex = useCallback(
    (index: AlertsIndex) => {
      setAlertsIndex(applyAlertOverrides(index));
    },
    [applyAlertOverrides],
  );

  const reloadAlerts = useCallback(async () => {
    if (!dataManager || !hasLoadedData) {
      setAlertsIndex(createEmptyAlertsIndex());
      return;
    }

    try {
      const nextAlerts = await dataManager.getAlertsIndex({ cases });
      
      // Check if still mounted after async operation
      if (!isMounted.current) return;
      
      syncAlertsIndex(nextAlerts);
    } catch (error) {
      // LegacyFormatError is expected when opening old data files - handle gracefully
      if (error instanceof LegacyFormatError) {
        logger.warn("Legacy format detected in alerts", { message: error.message });
      } else {
        logger.error("Failed to load alerts", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      // Check if still mounted before updating state
      if (isMounted.current) {
        setAlertsIndex(createEmptyAlertsIndex());
      }
    }
  }, [cases, dataManager, hasLoadedData, isMounted, syncAlertsIndex]);

  useEffect(() => {
    reloadAlerts().catch(err => {
      logger.error("Unexpected error during alert reload", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, [reloadAlerts, dataChangeCount]);

  const onAlertsCsvImported = useCallback(
    (index: AlertsIndex) => {
      syncAlertsIndex(index);
    },
    [syncAlertsIndex],
  );

  const onResolveAlert = useCallback(
    async (alert: AlertWithMatch) => {
      if (selectedCase && alert.matchedCaseId && alert.matchedCaseId !== selectedCase.id) {
        toast.error("Unable to update alert for this case.");
        return;
      }

      if (!dataManager) {
        toast.error("Alerts service is not ready. Try again after reconnecting.");
        return;
      }

      const identifier = buildAlertStorageKey(alert) ?? alert.id;
      const isResolved = alert.status === "resolved";

      if (!identifier) {
        logger.warn("Alert identifier missing; skipping resolution", { alertId: alert.id });
        toast.error("Unable to resolve alert. Please try again.");
        return;
      }

      if (isResolved) {
        resolvedAlertOverridesRef.current.set(alert.id, {
          status: "in-progress",
          resolvedAt: null,
        });
        setAlertsIndex(prev => applyAlertOverrides(prev));

        try {
          await dataManager.updateAlertStatus(
            identifier,
            {
              status: "in-progress",
              resolvedAt: null,
              resolutionNotes: alert.resolutionNotes,
            },
            { cases },
          );

          // Check if still mounted after async operation
          if (!isMounted.current) return;

          resolvedAlertOverridesRef.current.delete(alert.id);
          await reloadAlerts();

          toast.success("Alert reopened", {
            description: "We moved this alert back into the active queue.",
          });
        } catch (err) {
          logger.error("Failed to reopen alert", {
            alertId: alert.id,
            error: err instanceof Error ? err.message : String(err),
          });
          
          // Check if still mounted before updating state
          if (!isMounted.current) return;
          
          resolvedAlertOverridesRef.current.delete(alert.id);
          await reloadAlerts();
          toast.error("Unable to reopen alert. Please try again.");
        }

        return;
      }

      const resolvedAt = new Date().toISOString();
      resolvedAlertOverridesRef.current.set(alert.id, {
        status: "resolved",
        resolvedAt,
        resolutionNotes: alert.resolutionNotes,
      });
      setAlertsIndex(prev => applyAlertOverrides(prev));

      try {
        await dataManager.updateAlertStatus(
          identifier,
          {
            status: "resolved",
            resolvedAt,
            resolutionNotes: alert.resolutionNotes,
          },
          { cases },
        );

        // Check if still mounted after async operation
        if (!isMounted.current) return;

        resolvedAlertOverridesRef.current.delete(alert.id);
        await reloadAlerts();

        toast.success("Alert resolved", {
          description: "Add a note when you're ready to document the resolution.",
        });
      } catch (err) {
        logger.error("Failed to resolve alert", {
          alertId: alert.id,
          error: err instanceof Error ? err.message : String(err),
        });
        
        // Check if still mounted before updating state
        if (!isMounted.current) return;
        
        resolvedAlertOverridesRef.current.delete(alert.id);
        await reloadAlerts();
        toast.error("Unable to resolve alert. Please try again.");
      }
    },
    [applyAlertOverrides, cases, dataManager, isMounted, reloadAlerts, selectedCase],
  );

  const openAlerts = useMemo(() => filterOpenAlerts(alertsIndex.alerts), [alertsIndex.alerts]);

  useEffect(() => {
    if (!ENABLE_SAMPLE_ALERTS) {
      return;
    }

    const { unmatched, missingMcn } = alertsIndex.summary;
    const prev = previousAlertCountsRef.current;

    if ((unmatched > 0 || missingMcn > 0) && (unmatched !== prev.unmatched || missingMcn !== prev.missingMcn)) {
      const messageParts: string[] = [];
      if (unmatched > 0) {
        messageParts.push(`${unmatched} alert${unmatched === 1 ? "" : "s"} need${unmatched === 1 ? "s" : ""} a case match`);
      }
      if (missingMcn > 0) {
        messageParts.push(`${missingMcn} alert${missingMcn === 1 ? "" : "s"} missing an MCN`);
      }

      toast.warning(`Heads up: ${messageParts.join(" and ")}`, {
        id: "alerts-match-status",
      });
    }

    previousAlertCountsRef.current = { unmatched, missingMcn };
  }, [alertsIndex.summary]);

  return {
    alertsIndex,
    openAlerts,
    onResolveAlert,
    onAlertsCsvImported,
    reloadAlerts,
  };
}