import type { CaseDisplay } from '../../types/case';
import type { StoredCase } from './FileStorageService';
import type {
  AlertWithMatch,
  AlertsIndex,
  AlertMatchStatus,
} from '../alertsData';
import {
  createAlertsIndexFromAlerts,
  buildAlertStorageKey,
  normalizeMcn,
} from '../alertsData';
import { createLogger } from '../logger';
import type { AlertWorkflowStatus } from '../../types/case';

const logger = createLogger('AlertsService');

// ============================================================================
// Type Definitions
// ============================================================================

interface AlertLookupCandidate {
  key: string;
  fallback: boolean;
}

export interface MergeAlertsResult {
  alerts: AlertWithMatch[];
  added: number;
  updated: number;
  total: number;
}

/**
 * Minimal case interface for alert matching
 * Works with both StoredCase and CaseDisplay
 */
interface CaseForAlertMatching {
  id: string;
  name: string;
  mcn: string;
  status: string;
  caseRecord?: {
    mcn?: string;
  };
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
 * - Generate alert lookup candidates for matching
 * 
 * Pattern: Pure logic service (Stateless)
 */
export class AlertsService {
  
  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Get alerts index with case matching
   * 
   * @param alerts - Current alerts list
   * @param cases - Cases for alert matching (StoredCase or CaseDisplay)
   * @returns AlertsIndex with matched/unmatched/missingMcn classifications
   */
  getAlertsIndex(alerts: AlertWithMatch[], cases: CaseForAlertMatching[]): AlertsIndex {
    // Rematch alerts to current cases
    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    return createAlertsIndexFromAlerts(rematchedAlerts);
  }

  /**
   * Update alert status with workflow management
   * 
   * @param alerts - Current alerts list
   * @param alertId - Alert identifier (id, reportId, or lookup key)
   * @param updates - Status updates to apply
   * @param cases - Cases for alert rematching (StoredCase or CaseDisplay)
   * @returns Updated alert object or null if not found
   */
  updateAlertStatus(
    alerts: AlertWithMatch[],
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    cases: CaseForAlertMatching[]
  ): AlertWithMatch | null {
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
    let nextResolvedAt: string | null;

    // Set resolvedAt only when status is 'resolved'
    if (nextStatus === 'resolved') {
      // Use provided resolvedAt or generate new timestamp
      nextResolvedAt = updates.resolvedAt !== undefined ? updates.resolvedAt : (targetAlert.resolvedAt ?? new Date().toISOString());
    } else {
      // Force null when not resolved
      nextResolvedAt = null;
    }

    const updatedAlertBase: AlertWithMatch = {
      ...targetAlert,
      status: nextStatus,
      resolvedAt: nextResolvedAt,
      resolutionNotes: updates.resolutionNotes ?? targetAlert.resolutionNotes,
      updatedAt: new Date().toISOString(),
    };

    // Rematch with current cases
    const rematchedAlert = this.rematchAlertForCases(updatedAlertBase, this.buildCaseLookup(cases));
    
    return rematchedAlert;
  }

  /**
   * Merge alerts from CSV content with deduplication
   * 
   * @param csvContent - Raw CSV content to merge
   * @param existingAlerts - Current alerts list
   * @param cases - Cases for alert matching (StoredCase or CaseDisplay)
   * @returns Merged alerts with statistics
   */
  async mergeAlertsFromCsvContent(
    csvContent: string,
    existingAlerts: AlertWithMatch[],
    cases: CaseForAlertMatching[]
  ): Promise<MergeAlertsResult> {
    const { parseAlertsFromCsv } = await import('@/utils/alerts/alertsCsvParser');
    const incomingIndex = parseAlertsFromCsv(csvContent, cases);
    const incoming = incomingIndex.alerts;

    const existing = existingAlerts;

    // If no existing alerts and no incoming, nothing to do
    if (incoming.length === 0 && existing.length === 0) {
      logger.info('No alerts to merge from CSV and no existing alerts');
      return { alerts: [], added: 0, updated: 0, total: 0 };
    }

    let added = 0;
    let updated = 0;

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
        const beforeMerge = JSON.stringify(matchedExisting);
        const mergedAlert = this.mergeAlertDetails(matchedExisting, incomingAlert);
        const afterMerge = JSON.stringify(mergedAlert);
        
        if (beforeMerge !== afterMerge) {
          updated += 1;
        }
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
        added += 1;
      }
    });

    // Add unmatched existing alerts (auto-resolve if not already resolved)
    existing.forEach((alert, index) => {
      if (!usedIndices.has(index)) {
        if (alert.status !== 'resolved') {
          // Auto-resolve alerts missing from latest import
          const now = new Date().toISOString();
          merged.push({
            ...alert,
            status: 'resolved',
            resolvedAt: alert.resolvedAt || now,
            updatedAt: now,
          });
          updated += 1;
        } else {
          // Already resolved, keep as-is
          merged.push(alert);
        }
      }
    });

    // Rematch all with current cases
    const rematchedAlerts = this.rematchAlertsForCases(merged, cases);

    return {
      alerts: rematchedAlerts,
      added,
      updated,
      total: rematchedAlerts.length,
    };
  }

  // =============================================================================
  // PRIVATE UTILITIES - Case Matching
  // =============================================================================

  /**
   * Build case lookup map by MCN for efficient matching
   */
  private buildCaseLookup(cases: CaseForAlertMatching[]): Map<string, CaseForAlertMatching> {
    const lookup = new Map<string, CaseForAlertMatching>();

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
  private rematchAlertForCases(alert: AlertWithMatch, lookup: Map<string, CaseForAlertMatching>): AlertWithMatch {
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
  private rematchAlertsForCases(alerts: AlertWithMatch[], cases: CaseForAlertMatching[]): AlertWithMatch[] {
    if (!alerts || alerts.length === 0) {
      return alerts ?? [];
    }

    const lookup = this.buildCaseLookup(cases);
    return alerts.map(alert => this.rematchAlertForCases(alert, lookup));
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

    const preferredStatus = selectPreferredWorkflowStatus(existing.status, incoming.status);
    
    // Set resolvedAt only when status is 'resolved', force null otherwise
    const resolvedAt = preferredStatus === 'resolved'
      ? (existing.resolvedAt ?? incoming.resolvedAt ?? null)
      : null;

    return {
      ...existing,
      ...incoming,
      status: preferredStatus,
      resolvedAt,
      resolutionNotes: existing.resolutionNotes ?? incoming.resolutionNotes,
      metadata: {
        ...incoming.metadata,
        ...existing.metadata,
      },
    };
  }
}
