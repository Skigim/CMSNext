import type { CaseDisplay } from '../../types/case';
import type { AlertsIndex, AlertWithMatch } from '../alertsData';
import { parseStackedAlerts, buildAlertStorageKey } from '../alertsData';
import { createLogger } from '../logger';

const logger = createLogger('AlertsCsvParser');

/**
 * Count unique alert keys in a collection
 * Uses alert storage key (reportId + date) for uniqueness
 */
function countUniqueAlertKeys(alerts: AlertWithMatch[]): number {
  if (!alerts || alerts.length === 0) {
    return 0;
  }

  const keys = new Set<string>();
  alerts.forEach(alert => {
    const key = buildAlertStorageKey(alert);
    if (key) {
      keys.add(key);
    }
  });

  return keys.size;
}

/**
 * Parse alerts from CSV content with case matching
 * 
 * Extracted from DataManager.parseAlertsWithFallback
 * Uses parseStackedAlerts from alertsData.ts for the heavy lifting
 * 
 * @param csvContent - Raw CSV string content
 * @param cases - Array of cases for alert matching
 * @returns AlertsIndex with matched/unmatched/missing-mcn classifications
 */
export function parseAlertsFromCsv(
  csvContent: string,
  cases: CaseDisplay[]
): AlertsIndex {
  const stacked = parseStackedAlerts(csvContent, cases);
  const stackedUnique = countUniqueAlertKeys(stacked.alerts);

  // Debug logging with metrics
  logger.debug('Alert parser metrics', {
    metrics: {
      stacked: {
        total: stacked.alerts.length,
        unique: stackedUnique,
        uniqueRatio:
          stacked.alerts.length > 0 && Number.isFinite(stackedUnique / stacked.alerts.length)
            ? Number((stackedUnique / stacked.alerts.length).toFixed(4))
            : 0,
      },
    },
  });

  // Debug sample logging
  if (stacked.alerts.length > 0) {
    const preview = stacked.alerts.slice(0, Math.min(stacked.alerts.length, 3)).map(alert => ({
      id: alert.id,
      reportId: alert.reportId,
      alertCode: alert.alertCode,
      status: alert.status,
      program: alert.program,
      alertType: alert.alertType,
      description: alert.description,
      matchStatus: alert.matchStatus,
      mcNumber: alert.mcNumber,
      metadata: {
        rawProgram: alert.metadata?.rawProgram,
        rawType: alert.metadata?.rawType,
        rawDescription: alert.metadata?.rawDescription,
        alertNumber: alert.metadata?.alertNumber,
      },
    }));

    logger.debug('Alert preview generated', {
      source: 'csv-stacked',
      preview,
    });
  }

  return stacked;
}
