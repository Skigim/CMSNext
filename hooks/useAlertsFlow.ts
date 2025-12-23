import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsMounted } from "./useIsMounted";
import { useAlertResolve } from "./useAlertResolve";
import type { StoredCase } from "@/types/case";
import type { DataManager } from "@/utils/DataManager";
import { useFileStorageDataChange } from "@/contexts/FileStorageContext";
import { createEmptyAlertsIndex, filterOpenAlerts, type AlertsIndex, type AlertWithMatch } from "@/utils/alertsData";
import { ENABLE_SAMPLE_ALERTS } from "@/utils/featureFlags";
import { createLogger } from "@/utils/logger";
import { LegacyFormatError } from "@/utils/services/FileStorageService";

interface UseAlertsFlowOptions {
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

export function useAlertsFlow({ selectedCase, hasLoadedData, dataManager }: UseAlertsFlowOptions): UseAlertsFlowResult {
  const isMounted = useIsMounted();
  const [alertsIndex, setAlertsIndex] = useState<AlertsIndex>(() => createEmptyAlertsIndex());
  const previousAlertCountsRef = useRef({ unmatched: 0, missingMcn: 0 });
  const dataChangeCount = useFileStorageDataChange();

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
      setAlertsIndex(applyOverridesRef.current(nextAlerts));
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

  // Reload alerts when data changes
  useEffect(() => {
    reloadAlerts().catch(err => {
      logger.error("Unexpected error during alert reload", { error: err instanceof Error ? err.message : String(err) });
    });
  }, [reloadAlerts, dataChangeCount]);

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
