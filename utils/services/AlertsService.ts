import type { CaseDisplay } from '../../types/case';
import type {
  AlertWithMatch,
  AlertsIndex,
  AlertsSummary,
  AlertMatchStatus,
} from '../alertsData';
import {
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  buildAlertStorageKey,
  normalizeMcn,
} from '../alertsData';
import { createLogger } from '../logger';
import type { AlertsStorageService, StoredAlertWorkflowState, AlertsStoragePayload } from './AlertsStorageService';
import type { AlertWorkflowStatus } from '../../types/case';

const logger = createLogger('AlertsService');

// ============================================================================
// Type Definitions
// ============================================================================

interface AlertLookupCandidate {
  key: string;
  fallback: boolean;
}

interface AlertsServiceConfig {
  alertsStorage: AlertsStorageService;
}

// ============================================================================
// AlertsService
// ============================================================================

/**
 * AlertsService
 * 
 * Business logic layer for alerts management.
 * Handles alert matching, workflow orchestration, and deduplication.
 * 
 * Responsibilities:
 * - Get alerts index with case matching
 * - Update alert status with workflow management
 * - Merge alerts from CSV with deduplication
 * - Match alerts to cases via MCN/metadata
 * - Apply stored workflow states
 * - Generate alert lookup candidates for matching
 * 
 * Pattern: Cases must be passed as parameters (no FileStorageService dependency)
 */
export class AlertsService {
  private alertsStorage: AlertsStorageService;

  constructor(config: AlertsServiceConfig) {
    this.alertsStorage = config.alertsStorage;
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Get alerts index with case matching
   * 
   * @param cases - Cases for alert matching (required)
   * @returns AlertsIndex with matched/unmatched/missingMcn classifications
   */
  async getAlertsIndex(cases: CaseDisplay[]): Promise<AlertsIndex> {
    const loadResult = await this.alertsStorage.loadAlertsFromStore();
    let alerts = loadResult.alerts ?? [];
    let shouldPersist = loadResult.needsMigration || !!loadResult.error;
    let sourceFile = loadResult.sourceFile;

    // If no alerts in storage, try CSV import
    if (alerts.length === 0) {
      const imported = await this.alertsStorage.importAlertsFromCsv(cases);
      alerts = imported.alerts;
      sourceFile = imported.sourceFile ?? sourceFile;

      if (alerts.length === 0) {
        // No alerts found anywhere - persist empty if migration needed
        if (shouldPersist) {
          const emptyIndex = createEmptyAlertsIndex();
          void this.saveAlertsInternal(emptyIndex.alerts, emptyIndex.summary, { sourceFile });
        }
        return createEmptyAlertsIndex();
      }

      // Apply legacy workflows if any
      if (loadResult.legacyWorkflows.length > 0) {
        const applied = this.applyStoredAlertWorkflows(alerts, loadResult.legacyWorkflows);
        alerts = applied.alerts;
        if (applied.changed || applied.unmatchedIds.length > 0) {
          shouldPersist = true;
        }
      }

      shouldPersist = true;
    }

    const originalAlerts = alerts;

    // Rematch alerts to current cases
    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);

    // Check if rematching changed anything
    if (this.haveAlertsChanged(originalAlerts, rematchedAlerts)) {
      shouldPersist = true;
    }

    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    // Persist if needed
    if (shouldPersist) {
      void this.saveAlertsInternal(index.alerts, index.summary, { sourceFile });
    }

    return index;
  }

  /**
   * Update alert status with workflow management
   * 
   * @param alertId - Alert identifier (id, reportId, or lookup key)
   * @param updates - Status updates to apply
   * @param cases - Cases for alert rematching (required)
   * @returns Updated alert or null if not found
   */
  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    cases: CaseDisplay[]
  ): Promise<AlertWithMatch | null> {
    const loadResult = await this.alertsStorage.loadAlertsFromStore();
    let alerts = loadResult.alerts ?? [];
    let sourceFile = loadResult.sourceFile;

    // If no alerts in storage, try CSV import
    if (alerts.length === 0) {
      const imported = await this.alertsStorage.importAlertsFromCsv(cases);
      alerts = imported.alerts;
      sourceFile = imported.sourceFile ?? sourceFile;

      if (alerts.length === 0) {
        logger.warn('No alerts available to update status', { alertId });
        return null;
      }

      // Apply legacy workflows if any
      if (loadResult.legacyWorkflows.length > 0) {
        const applied = this.applyStoredAlertWorkflows(alerts, loadResult.legacyWorkflows);
        alerts = applied.alerts;
      }
    }

    const normalizedAlertId = typeof alertId === 'string' ? alertId.trim() : '';
    if (normalizedAlertId.length === 0) {
      logger.warn('Invalid alert identifier for status update', { alertId });
      return null;
    }

    // Find alert by ID (exact match first)
    let targetIndex = alerts.findIndex(alert => alert.id === normalizedAlertId);

    // If not found by ID, try multi-tier matching
    if (targetIndex === -1) {
      const strongMatches: number[] = [];
      const fallbackMatches: number[] = [];

      alerts.forEach((alert, index) => {
        const candidates = this.buildAlertLookupCandidates(alert);
        candidates.forEach(candidate => {
          if (candidate.key !== normalizedAlertId) {
            return;
          }

          if (candidate.fallback) {
            if (!fallbackMatches.includes(index)) {
              fallbackMatches.push(index);
            }
            return;
          }

          if (!strongMatches.includes(index)) {
            strongMatches.push(index);
          }
        });
      });

      if (strongMatches.length === 1) {
        targetIndex = strongMatches[0];
      } else if (strongMatches.length > 1) {
        logger.warn('Multiple alerts matched status update request by strong key', {
          alertId,
          matchedCount: strongMatches.length,
        });
        return null;
      } else if (fallbackMatches.length === 1) {
        targetIndex = fallbackMatches[0];
      } else if (fallbackMatches.length > 1) {
        logger.warn('Multiple alerts matched status update request by fallback key', {
          alertId,
          matchedCount: fallbackMatches.length,
        });
        return null;
      }
    }

    if (targetIndex === -1) {
      logger.warn('Could not find alert to update', { alertId });
      return null;
    }

    const targetAlert = alerts[targetIndex];
    const nextStatus: AlertWorkflowStatus = updates.status ?? targetAlert.status ?? 'new';
    let nextResolvedAt: string | null =
      updates.resolvedAt !== undefined ? updates.resolvedAt : targetAlert.resolvedAt ?? null;

    // Auto-set resolvedAt when marking as resolved
    if (nextStatus === 'resolved' && !nextResolvedAt) {
      nextResolvedAt = new Date().toISOString();
    }

    // Clear resolvedAt when not resolved
    if (nextStatus !== 'resolved') {
      nextResolvedAt = updates.resolvedAt !== undefined ? updates.resolvedAt : null;
    }

    const updatedAlertBase: AlertWithMatch = {
      ...targetAlert,
      status: nextStatus,
      resolvedAt: nextResolvedAt,
      resolutionNotes: updates.resolutionNotes ?? targetAlert.resolutionNotes,
      updatedAt: new Date().toISOString(),
    };

    alerts[targetIndex] = updatedAlertBase;

    // Rematch with current cases
    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    await this.saveAlertsInternal(index.alerts, index.summary, { sourceFile });

    const rematchedAlert = rematchedAlerts.find(alert => alert.id === updatedAlertBase.id);
    if (!rematchedAlert) {
      logger.warn('Updated alert missing after rematch', {
        alertId,
        alertKey: this.alertKey(updatedAlertBase),
      });
      return null;
    }

    return rematchedAlert;
  }

  /**
   * Merge alerts from CSV content with deduplication
   * 
   * @param csvContent - Raw CSV content to merge
   * @param cases - Cases for alert matching (required)
   * @returns Array of merged alerts
   */
  async mergeAlertsFromCsvContent(
    csvContent: string,
    cases: CaseDisplay[]
  ): Promise<AlertWithMatch[]> {
    const { parseAlertsFromCsv } = await import('../alerts/alertsCsvParser');
    const incomingIndex = parseAlertsFromCsv(csvContent, cases);
    const incoming = incomingIndex.alerts;

    if (incoming.length === 0) {
      logger.info('No alerts to merge from CSV');
      return [];
    }

    const loadResult = await this.alertsStorage.loadAlertsFromStore();
    let existing = loadResult.alerts ?? [];

    // If no existing alerts, import from CSV
    if (existing.length === 0) {
      const imported = await this.alertsStorage.importAlertsFromCsv(cases);
      existing = imported.alerts;
    }

    // Build lookup maps for efficient matching
    const strongCandidates = new Map<string, number[]>();
    const fallbackCandidates = new Map<string, number[]>();

    existing.forEach((alert, index) => {
      this.buildAlertLookupCandidates(alert).forEach(candidate => {
        const target = candidate.fallback ? fallbackCandidates : strongCandidates;
        const indices = target.get(candidate.key);
        if (indices) {
          indices.push(index);
        } else {
          target.set(candidate.key, [index]);
        }
      });
    });

    const usedIndices = new Set<number>();
    const merged: AlertWithMatch[] = [];

    incoming.forEach(incomingAlert => {
      const candidates = this.buildAlertLookupCandidates(incomingAlert);
      const incomingStrongKeys = candidates
        .filter(c => !c.fallback)
        .map(c => c.key);

      let matchedIndex = -1;
      let matchedExisting: AlertWithMatch | null = null;

      // Try strong key matching first
      for (const { key: candidate, fallback } of candidates) {
        if (fallback) {
          continue;
        }

        const indices = strongCandidates.get(candidate);
        if (!indices?.length) {
          continue;
        }

        for (const index of indices) {
          if (usedIndices.has(index)) {
            continue;
          }

          matchedIndex = index;
          matchedExisting = existing[index];
          break;
        }

        if (matchedExisting) {
          break;
        }
      }

      // If no strong match, try fallback matching with validation
      if (matchedIndex === -1) {
        for (const { key: candidate } of candidates) {
          const indices = fallbackCandidates.get(candidate);
          if (!indices?.length) {
            continue;
          }

          for (const index of indices) {
            if (usedIndices.has(index)) {
              continue;
            }

            const candidateExisting = existing[index];
            if (this.shouldMatchUsingFallback(incomingAlert, candidateExisting, incomingStrongKeys)) {
              matchedIndex = index;
              matchedExisting = candidateExisting;
              break;
            }
          }

          if (matchedExisting) {
            break;
          }
        }
      }

      // Merge or add new alert
      if (matchedExisting) {
        usedIndices.add(matchedIndex);
        const mergedAlert = this.mergeAlertDetails(matchedExisting, incomingAlert);
        merged.push(mergedAlert);
      } else {
        // New alert - auto-resolve if no MCN
        const normalized = normalizeMcn(incomingAlert.mcNumber ?? null);
        if (!normalized) {
          merged.push({
            ...incomingAlert,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolutionNotes: 'Auto-resolved: Missing MCN',
          });
        } else {
          merged.push(incomingAlert);
        }
      }
    });

    // Add unmatched existing alerts
    existing.forEach((alert, index) => {
      if (!usedIndices.has(index)) {
        merged.push(alert);
      }
    });

    // Rematch all with current cases
    const rematchedAlerts = this.rematchAlertsForCases(merged, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    await this.saveAlertsInternal(index.alerts, index.summary, {
      sourceFile: 'Merged from CSV',
    });

    return index.alerts;
  }

  // =============================================================================
  // PRIVATE UTILITIES - Case Matching
  // =============================================================================

  /**
   * Build case lookup map by MCN for efficient matching
   */
  private buildCaseLookup(cases: CaseDisplay[]): Map<string, CaseDisplay> {
    const lookup = new Map<string, CaseDisplay>();

    cases.forEach(caseItem => {
      const mcn = caseItem.caseRecord?.mcn ?? caseItem.mcn;
      const normalized = normalizeMcn(mcn);
      if (!normalized || lookup.has(normalized)) {
        return;
      }

      lookup.set(normalized, caseItem);
    });

    return lookup;
  }

  /**
   * Rematch a single alert to cases
   */
  private rematchAlertForCases(alert: AlertWithMatch, lookup: Map<string, CaseDisplay>): AlertWithMatch {
    if (!alert) {
      return alert;
    }

    const normalizedMcn = normalizeMcn(alert.mcNumber ?? null);
    const matchedCase = normalizedMcn ? lookup.get(normalizedMcn) : undefined;

    if (!matchedCase) {
      const correctStatus: AlertMatchStatus = normalizedMcn ? 'unmatched' : 'missing-mcn';
      
      // Update if status or case references need clearing
      if (alert.matchStatus !== correctStatus || alert.matchedCaseId) {
        return {
          ...alert,
          matchStatus: correctStatus,
          matchedCaseId: undefined,
          matchedCaseName: undefined,
          matchedCaseStatus: undefined,
        };
      }
      return alert;
    }

    return {
      ...alert,
      matchStatus: 'matched',
      matchedCaseId: matchedCase.id,
      matchedCaseName: matchedCase.name,
      matchedCaseStatus: matchedCase.status,
    };
  }

  /**
   * Rematch all alerts to cases
   */
  private rematchAlertsForCases(alerts: AlertWithMatch[], cases: CaseDisplay[]): AlertWithMatch[] {
    if (!alerts || alerts.length === 0) {
      return alerts ?? [];
    }

    const lookup = this.buildCaseLookup(cases);
    return alerts.map(alert => this.rematchAlertForCases(alert, lookup));
  }

  // =============================================================================
  // PRIVATE UTILITIES - Workflow Management
  // =============================================================================

  /**
   * Apply stored workflow states to alerts (v1 migration)
   */
  private applyStoredAlertWorkflows(
    alerts: AlertWithMatch[],
    storedWorkflows: StoredAlertWorkflowState[],
  ): {
    alerts: AlertWithMatch[];
    changed: boolean;
    unmatchedIds: string[];
  } {
    if (!alerts.length || !storedWorkflows.length) {
      return { alerts, changed: false, unmatchedIds: storedWorkflows.map(entry => entry.alertId) };
    }

    // Build workflow index
    const workflowKeyIndex = new Map<string, number[]>();
    storedWorkflows.forEach((workflow, index) => {
      const key = workflow?.alertId?.trim();
      if (!key) {
        return;
      }

      const existing = workflowKeyIndex.get(key);
      if (existing) {
        existing.push(index);
        return;
      }

      workflowKeyIndex.set(key, [index]);
    });

    const usedIndices = new Set<number>();

    const resolveStoredWorkflowForAlert = (alert: AlertWithMatch): { workflow: StoredAlertWorkflowState | null; index: number } => {
      const candidates = this.buildAlertLookupCandidates(alert);

      let matchedIndex = -1;
      let matchedWorkflow: StoredAlertWorkflowState | null = null;

      for (const { key: candidate } of candidates) {
        const candidateIndices = workflowKeyIndex.get(candidate);
        if (!candidateIndices?.length) {
          continue;
        }

        for (const index of candidateIndices) {
          if (usedIndices.has(index)) {
            continue;
          }

          matchedIndex = index;
          matchedWorkflow = storedWorkflows[index] ?? null;
          break;
        }

        if (matchedWorkflow) {
          break;
        }
      }

      if (matchedIndex === -1 || !matchedWorkflow) {
        return { workflow: null, index: -1 };
      }

      usedIndices.add(matchedIndex);
      return { workflow: matchedWorkflow, index: matchedIndex };
    };

    let changed = false;
    const updatedAlerts = alerts.map(alert => {
      const { workflow } = resolveStoredWorkflowForAlert(alert);
      if (!workflow) {
        return alert;
      }

      const nextAlert: AlertWithMatch = {
        ...alert,
        status: workflow.status ?? alert.status ?? 'new',
        resolvedAt:
          workflow.resolvedAt !== undefined
            ? workflow.resolvedAt
            : alert.resolvedAt ?? null,
        resolutionNotes:
          workflow.resolutionNotes ?? alert.resolutionNotes,
        updatedAt: workflow.updatedAt ?? alert.updatedAt,
      };

      if (
        !this.alertsAreEqual(alert, nextAlert) ||
        alert.updatedAt !== nextAlert.updatedAt
      ) {
        changed = true;
      }

      return nextAlert;
    });

    const unmatchedIds = storedWorkflows
      .map((workflow, index) => ({ workflow, index }))
      .filter(entry => entry.workflow.alertId && !usedIndices.has(entry.index))
      .map(entry => entry.workflow.alertId);

    return { alerts: updatedAlerts, changed, unmatchedIds };
  }

  // =============================================================================
  // PRIVATE UTILITIES - Alert Matching & Deduplication
  // =============================================================================

  /**
   * Build alert lookup candidates for matching (strong + fallback keys)
   */
  private buildAlertLookupCandidates(alert: AlertWithMatch): AlertLookupCandidate[] {
    const strong: AlertLookupCandidate[] = [];
    const fallback: AlertLookupCandidate[] = [];

    const addCandidate = (
      value: string | null | undefined,
      options: { fallback?: boolean } = {},
    ) => {
      if (!value) {
        return;
      }

      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return;
      }

      const target = options.fallback ? fallback : strong;
      if (target.some(candidate => candidate.key === trimmed)) {
        return;
      }

      target.push({ key: trimmed, fallback: !!options.fallback });
    };

    addCandidate(this.alertKey(alert));

    const legacyKey = this.alertLegacyKey(alert);
    if (legacyKey) {
      addCandidate(legacyKey, { fallback: true });
    }

    if (alert.metadata && typeof alert.metadata === 'object') {
      const metadataStrongKeys = ['uniqueId', 'unique_id', 'storageKey', 'storage_key'];
      metadataStrongKeys.forEach(key => {
        const metaValue = alert.metadata?.[key];
        if (typeof metaValue === 'string') {
          addCandidate(metaValue);
        }
      });

      const metadataFallbackKeys = [
        'alertId',
        'reportId',
        'id',
        'report_id',
        'alert_id',
        'alert_number',
        'alertNumber',
        'alertCode',
        'alert_code',
      ];
      metadataFallbackKeys.forEach(key => {
        const metaValue = alert.metadata?.[key];
        if (typeof metaValue === 'string') {
          addCandidate(metaValue, { fallback: true });
        }
      });
    }

    addCandidate(alert.reportId, { fallback: true });
    addCandidate(alert.id, { fallback: true });
    addCandidate(alert.alertCode, { fallback: true });

    if (strong.length > 0) {
      return [...strong, ...fallback];
    }

    return fallback;
  }

  /**
   * Generate primary alert key
   */
  private alertKey(alert: AlertWithMatch): string {
    if (!alert) {
      return '';
    }

    const storageKey = buildAlertStorageKey(alert);
    if (storageKey && storageKey.trim().length > 0) {
      return storageKey;
    }

    return alert.reportId ?? alert.id ?? '';
  }

  /**
   * Generate legacy alert key (for v1 migration)
   */
  private alertLegacyKey(alert: AlertWithMatch): string | null {
    if (!alert) {
      return null;
    }

    const baseId = alert.reportId?.trim() || alert.id?.trim();
    if (!baseId) {
      return null;
    }

    const dateSource = alert.alertDate || alert.updatedAt || alert.createdAt || '';
    if (!dateSource) {
      return baseId;
    }

    const parsed = new Date(dateSource);
    const normalizedDate = Number.isNaN(parsed.getTime())
      ? dateSource
      : parsed.toISOString().slice(0, 10);

    return `${baseId}|${normalizedDate}`;
  }

  /**
   * Determine if fallback matching is appropriate for two alerts
   */
  private shouldMatchUsingFallback(
    incoming: AlertWithMatch,
    existing: AlertWithMatch,
    incomingStrongKeys: string[],
  ): boolean {
    const existingStrongKeys = this.buildAlertLookupCandidates(existing)
      .filter(candidate => !candidate.fallback)
      .map(candidate => candidate.key);

    if (incomingStrongKeys.length === 0 || existingStrongKeys.length === 0) {
      return true;
    }

    if (incomingStrongKeys.some(key => existingStrongKeys.includes(key))) {
      return true;
    }

    const incomingMcn = normalizeMcn(incoming.mcNumber ?? null);
    const existingMcn = normalizeMcn(existing.mcNumber ?? null);
    if (incomingMcn && existingMcn && incomingMcn !== existingMcn) {
      return false;
    }

    const normalizeText = (value: string | undefined): string | null =>
      value && value.trim().length > 0 ? value.trim().toLowerCase() : null;

    const incomingDescription = normalizeText(incoming.description);
    const existingDescription = normalizeText(existing.description);
    const descriptionsMatch =
      incomingDescription !== null &&
      existingDescription !== null &&
      incomingDescription === existingDescription;

    const incomingRawDescription = normalizeText(incoming.metadata?.rawDescription);
    const existingRawDescription = normalizeText(existing.metadata?.rawDescription);
    const rawDescriptionsMatch =
      incomingRawDescription !== null &&
      existingRawDescription !== null &&
      incomingRawDescription === existingRawDescription;

    const hasTextualMatch = descriptionsMatch || rawDescriptionsMatch;
    if (!hasTextualMatch) {
      return false;
    }

    const incomingDate = incoming.alertDate ?? '';
    const existingDate = existing.alertDate ?? '';
    const datesMatch = incomingDate === existingDate;
    if (!datesMatch && incomingDate && existingDate) {
      return false;
    }

    return true;
  }

  /**
   * Merge details from incoming alert into existing alert
   */
  private mergeAlertDetails(existing: AlertWithMatch, incoming: AlertWithMatch): AlertWithMatch {
    const selectPreferredWorkflowStatus = (
      existingStatus: AlertWorkflowStatus | null | undefined,
      incomingStatus: AlertWorkflowStatus | null | undefined,
    ): AlertWorkflowStatus => {
      const statusPriority: Record<AlertWorkflowStatus, number> = {
        resolved: 5,
        snoozed: 4,
        'in-progress': 3,
        acknowledged: 2,
        new: 1,
      };

      const existingPriority = existingStatus ? statusPriority[existingStatus] ?? 0 : 0;
      const incomingPriority = incomingStatus ? statusPriority[incomingStatus] ?? 0 : 0;

      if (existingPriority >= incomingPriority && existingStatus) {
        return existingStatus;
      }

      return incomingStatus ?? existingStatus ?? 'new';
    };

    return {
      ...existing,
      ...incoming,
      status: selectPreferredWorkflowStatus(existing.status, incoming.status),
      resolvedAt: existing.resolvedAt ?? incoming.resolvedAt,
      resolutionNotes: existing.resolutionNotes ?? incoming.resolutionNotes,
      metadata: {
        ...incoming.metadata,
        ...existing.metadata,
      },
    };
  }

  // =============================================================================
  // PRIVATE UTILITIES - Comparison & Storage
  // =============================================================================

  /**
   * Compare two alerts for equality
   */
  private alertsAreEqual(a: AlertWithMatch, b: AlertWithMatch): boolean {
    return (
      a.id === b.id &&
      a.reportId === b.reportId &&
      a.status === b.status &&
      a.resolvedAt === b.resolvedAt &&
      a.resolutionNotes === b.resolutionNotes &&
      a.matchStatus === b.matchStatus &&
      a.matchedCaseId === b.matchedCaseId &&
      a.matchedCaseName === b.matchedCaseName &&
      a.matchedCaseStatus === b.matchedCaseStatus
    );
  }

  /**
   * Check if alerts collection has changed
   */
  private haveAlertsChanged(original: AlertWithMatch[], updated: AlertWithMatch[]): boolean {
    if (original.length !== updated.length) {
      return true;
    }

    const originalMap = new Map<string, AlertWithMatch>();
    original.forEach(alert => {
      originalMap.set(this.alertKey(alert), alert);
    });

    for (const alert of updated) {
      const key = this.alertKey(alert);
      const previous = originalMap.get(key);
      if (!previous || !this.alertsAreEqual(previous, alert)) {
        return true;
      }
      originalMap.delete(key);
    }

    return originalMap.size > 0;
  }

  /**
   * Count unique alerts by storage key
   */
  private countUniqueAlertKeys(alerts: AlertWithMatch[]): number {
    if (!alerts || alerts.length === 0) {
      return 0;
    }

    const keys = new Set<string>();
    alerts.forEach(alert => {
      const key = this.alertKey(alert);
      if (key) {
        keys.add(key);
      }
    });

    return keys.size;
  }

  /**
   * Internal save method with payload construction
   */
  private async saveAlertsInternal(
    alerts: AlertWithMatch[],
    summary?: AlertsSummary,
    options: { sourceFile?: string } = {},
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const index = summary
      ? { alerts, summary }
      : createAlertsIndexFromAlerts(alerts);

    const normalizedAlerts = index.alerts;
    const payload: AlertsStoragePayload = {
      version: 2, // Using v2 format
      generatedAt: now,
      updatedAt: now,
      summary: index.summary,
      alerts: normalizedAlerts,
      uniqueAlerts: this.countUniqueAlertKeys(normalizedAlerts),
    };

    if (options.sourceFile) {
      payload.sourceFile = options.sourceFile;
    }

    return this.alertsStorage.saveAlerts(payload);
  }
}
