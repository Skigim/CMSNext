import type { CaseStatus } from '../../types/case';
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

/**
 * Alert lookup candidate for matching algorithms.
 * @private
 * @interface AlertLookupCandidate
 */
interface AlertLookupCandidate {
  /** Lookup key for matching */
  key: string;
  /** Whether this is a fallback match strategy */
  fallback: boolean;
}

/**
 * Result of merging alerts from CSV import.
 * @interface MergeAlertsResult
 */
export interface MergeAlertsResult {
  /** Merged alerts with match status */
  alerts: AlertWithMatch[];
  /** Number of new alerts added */
  added: number;
  /** Number of existing alerts updated */
  updated: number;
  /** Total number of alerts after merge */
  total: number;
}

/**
 * Minimal case interface for alert matching.
 * 
 * Works with both StoredCase and CaseDisplay formats,
 * extracting only the fields needed for alert-to-case matching.
 * 
 * @interface CaseForAlertMatching
 */
interface CaseForAlertMatching {
  /** Case ID */
  id: string;
  /** Case display name */
  name: string;
  /** Medical Case Number (MCN) */
  mcn: string;
  /** Case status */
  status: CaseStatus;
  /** Optional case record with MCN */
  caseRecord?: {
    mcn?: string;
  };
}

// ============================================================================
// AlertsService
// ============================================================================

/**
 * AlertsService - Alert matching, workflow, and deduplication
 * 
 * This service provides pure business logic for managing alerts imported from
 * external systems (typically via CSV). It handles intelligent matching to cases,
 * workflow state management, and deduplication during imports.
 * 
 * ## Architecture
 * 
 * ```
 * DataManager/Hooks
 *     ↓
 * AlertsService (pure logic, stateless)
 *     ↓
 * Alert matching algorithms & workflow rules
 * ```
 * 
 * **Note:** This is a stateless service with no file I/O. It operates on
 * in-memory data and returns transformed results. The caller (DataManager)
 * handles persistence.
 * 
 * ## Core Responsibilities
 * 
 * ### Alert-to-Case Matching
 * - Match alerts to cases via MCN (Medical Case Number)
 * - Handle MCN normalization (remove dashes, spaces)
 * - Generate lookup candidates with fallback strategies
 * - Classify alerts as: matched, unmatched, or missing-mcn
 * - Support rematching when case data changes
 * 
 * ### Workflow Management
 * - Update alert workflow status (pending, in-progress, resolved, dismissed)
 * - Track resolution timestamps and notes
 * - Maintain audit trail of status changes
 * - Validate workflow transitions
 * 
 * ### CSV Import & Deduplication
 * - Parse alert data from CSV content
 * - Detect duplicate alerts by multiple strategies:
 *   - Exact match (reportId + name + mcNumber)
 *   - Metadata match (name + DOB + MCN)
 *   - Fallback match (name + MCN only)
 * - Merge new alerts with existing alerts
 * - Update existing alerts with fresher data
 * - Track import statistics (added, updated, total)
 * 
 * ### Alert Classification
 * - **Matched:** Alert has MCN and matches an existing case
 * - **Unmatched:** Alert has MCN but no matching case found
 * - **Missing MCN:** Alert lacks MCN, cannot match to case
 * 
 * ## Matching Algorithm
 * 
 * The service uses a sophisticated multi-strategy matching system:
 * 
 * 1. **Primary:** Exact MCN match (normalized)
 * 2. **Fallback:** Name-based matching when MCN match fails
 * 3. **Deduplication:** Multiple strategies to detect existing alerts
 * 
 * MCN normalization handles variations:
 * - Removes dashes, spaces, and non-alphanumeric characters
 * - Case-insensitive comparison
 * 
 * ## Pattern: Stateless Pure Functions
 * 
 * All methods are pure functions:
 * - No side effects
 * - No file I/O
 * - Deterministic results
 * - Caller handles persistence
 * 
 * @class AlertsService
 * @see {@link createAlertsIndexFromAlerts} for index creation
 * @see {@link buildAlertStorageKey} for deduplication keys
 * @see {@link normalizeMcn} for MCN normalization
 */
export class AlertsService {
  
  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Get alerts index with case matching.
   * 
   * This method:
   * 1. Rematches all alerts to current cases
   * 2. Classifies alerts into matched/unmatched/missing-mcn
   * 3. Returns organized index for UI display
   * 
   * **Use Case:** Called when displaying alerts list or when case data changes.
   * 
   * @param {AlertWithMatch[]} alerts - Current alerts list
   * @param {CaseForAlertMatching[]} cases - Cases for matching (StoredCase or CaseDisplay)
   * @returns {AlertsIndex} Organized index with matched, unmatched, and missing-mcn classifications
   * 
   * @example
   * const index = alertsService.getAlertsIndex(alerts, cases);
   * console.log(`Matched: ${index.matched.length}`);
   * console.log(`Unmatched: ${index.unmatched.length}`);
   * console.log(`Missing MCN: ${index.missingMcn.length}`);
   */
  getAlertsIndex(alerts: AlertWithMatch[], cases: CaseForAlertMatching[]): AlertsIndex {
    // Rematch alerts to current cases
    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    return createAlertsIndexFromAlerts(rematchedAlerts);
  }

  /**
   * Update alert status with workflow management.
   * 
   * This method:
   * 1. Finds alert(s) by ID (handles duplicates from CSV imports)
   * 2. Updates workflow status and resolution details
   * 3. Rematches alerts to cases after update
   * 4. Returns first updated alert with match info
   * 
   * **Note:** Handles alerts with duplicate IDs by updating all matching alerts.
   * This can occur when the same alert appears in multiple CSV imports.
   * 
   * @param {AlertWithMatch[]} alerts - Current alerts list
   * @param {string} alertId - Alert identifier (id, reportId, or lookup key)
   * @param {Object} updates - Status updates to apply
   * @param {AlertWorkflowStatus} [updates.status] - New workflow status
   * @param {string | null} [updates.resolvedAt] - Resolution timestamp
   * @param {string} [updates.resolutionNotes] - Notes about resolution
   * @param {CaseForAlertMatching[]} cases - Cases for rematching
   * @returns {AlertWithMatch | null} Updated alert with match info, or null if not found
   * 
   * @example
   * const updated = alertsService.updateAlertStatus(
   *   alerts,
   *   "alert-123",
   *   { status: "resolved", resolvedAt: new Date().toISOString() },
   *   cases
   * );
   * if (updated) {
   *   console.log(`Alert resolved: ${updated.alertType}`);
   * }
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

    // Rematch with current cases, preserving existing link if case not found in lookup
    // This prevents race conditions where React state hasn't synced skeleton cases yet
    const rematchedAlert = this.rematchAlertForCases(updatedAlertBase, this.buildCaseLookup(cases), true);
    
    return rematchedAlert;
  }

  /**
   * Merge alerts from CSV content with deduplication.
   * 
   * This method provides sophisticated CSV import handling:
   * 1. Parses CSV content into alert objects
   * 2. Builds lookup indices for efficient matching
   * 3. Uses multi-strategy deduplication:
   *    - Strong match: reportId + name + mcNumber
   *    - Metadata match: name + DOB + MCN
   *    - Fallback match: name + MCN only
   * 4. Updates existing alerts with fresher data
   * 5. Adds new alerts that don't match existing
   * 6. Matches all alerts to cases
   * 7. Returns merged result with statistics
   * 
   * **Deduplication Logic:**
   * - Tries strong matches first (most specific)
   * - Falls back to broader matches if no strong match
   * - Marks matched alerts as "used" to prevent double-matching
   * - Preserves existing alerts not in CSV
   * 
   * **Pattern:** Async (loads CSV parser dynamically)
   * 
   * @param {string} csvContent - Raw CSV content to parse and merge
   * @param {AlertWithMatch[]} existingAlerts - Current alerts list
   * @param {CaseForAlertMatching[]} cases - Cases for alert matching (StoredCase or CaseDisplay)
   * @returns {Promise<MergeAlertsResult>} Merged alerts with added/updated statistics
   * 
   * @example
   * const result = await alertsService.mergeAlertsFromCsvContent(
   *   csvFileContent,
   *   currentAlerts,
   *   cases
   * );
   * console.log(`Added: ${result.added}, Updated: ${result.updated}`);
   * console.log(`Total alerts: ${result.total}`);
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

    if (incoming.length === 0 && existing.length === 0) {
      logger.info('No alerts to merge from CSV and no existing alerts');
      return { alerts: [], added: 0, updated: 0, total: 0 };
    }

    // Build lookup maps for efficient matching
    const { strongCandidates, fallbackCandidates } = this.buildCandidateMaps(existing);

    const usedIndices = new Set<number>();
    const merged: AlertWithMatch[] = [];
    let added = 0;
    let updated = 0;

    // Match incoming alerts against existing
    for (const incomingAlert of incoming) {
      const { matchedIndex, matchedExisting } = this.findBestMatch(
        incomingAlert, existing, strongCandidates, fallbackCandidates, usedIndices
      );

      if (matchedExisting) {
        usedIndices.add(matchedIndex);
        const { alert: mergedAlert, changed } = this.mergeAndTrackChange(matchedExisting, incomingAlert);
        if (changed) updated += 1;
        merged.push(mergedAlert);
      } else {
        merged.push(this.createNewAlertEntry(incomingAlert));
        added += 1;
      }
    }

    // Auto-resolve unmatched existing alerts
    const { alerts: unmatchedAlerts, updatedCount } = this.processUnmatchedExisting(existing, usedIndices);
    merged.push(...unmatchedAlerts);
    updated += updatedCount;

    const rematchedAlerts = this.rematchAlertsForCases(merged, cases);

    return {
      alerts: rematchedAlerts,
      added,
      updated,
      total: rematchedAlerts.length,
    };
  }

  /**
   * Build candidate lookup maps from existing alerts for efficient dedup matching.
   */
  private buildCandidateMaps(existing: AlertWithMatch[]): {
    strongCandidates: Map<string, number[]>;
    fallbackCandidates: Map<string, number[]>;
  } {
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

    return { strongCandidates, fallbackCandidates };
  }

  /**
   * Find the best existing match for an incoming alert using strong then fallback strategies.
   */
  private findBestMatch(
    incomingAlert: AlertWithMatch,
    existing: AlertWithMatch[],
    strongCandidates: Map<string, number[]>,
    fallbackCandidates: Map<string, number[]>,
    usedIndices: Set<number>
  ): { matchedIndex: number; matchedExisting: AlertWithMatch | null } {
    const candidates = this.buildAlertLookupCandidates(incomingAlert);
    const incomingStrongKeys = candidates.filter(c => !c.fallback).map(c => c.key);

    // Try strong key matching first
    const strongResult = this.findFirstUnusedMatch(
      candidates.filter(c => !c.fallback),
      strongCandidates,
      existing,
      usedIndices
    );
    if (strongResult.matchedExisting) return strongResult;

    // Fall back to broader matching with validation
    for (const { key: candidate } of candidates) {
      const indices = fallbackCandidates.get(candidate);
      if (!indices?.length) continue;

      for (const index of indices) {
        if (usedIndices.has(index)) continue;
        if (this.shouldMatchUsingFallback(incomingAlert, existing[index], incomingStrongKeys)) {
          return { matchedIndex: index, matchedExisting: existing[index] };
        }
      }
    }

    return { matchedIndex: -1, matchedExisting: null };
  }

  /**
   * Search candidate maps for the first unused match.
   */
  private findFirstUnusedMatch(
    candidates: AlertLookupCandidate[],
    candidateMap: Map<string, number[]>,
    existing: AlertWithMatch[],
    usedIndices: Set<number>
  ): { matchedIndex: number; matchedExisting: AlertWithMatch | null } {
    for (const { key: candidate } of candidates) {
      const indices = candidateMap.get(candidate);
      if (!indices?.length) continue;

      for (const index of indices) {
        if (!usedIndices.has(index)) {
          return { matchedIndex: index, matchedExisting: existing[index] };
        }
      }
    }
    return { matchedIndex: -1, matchedExisting: null };
  }

  /**
   * Merge an incoming alert into an existing one and track whether it changed.
   */
  private mergeAndTrackChange(
    matchedExisting: AlertWithMatch,
    incomingAlert: AlertWithMatch
  ): { alert: AlertWithMatch; changed: boolean } {
    const beforeMerge = JSON.stringify(matchedExisting);
    const mergedAlert = this.mergeAlertDetails(matchedExisting, incomingAlert);
    const changed = beforeMerge !== JSON.stringify(mergedAlert);
    return { alert: mergedAlert, changed };
  }

  /**
   * Create a new alert entry, auto-resolving if MCN is missing.
   */
  private createNewAlertEntry(alert: AlertWithMatch): AlertWithMatch {
    const normalized = normalizeMcn(alert.mcNumber ?? null);
    if (!normalized) {
      return {
        ...alert,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolutionNotes: 'Auto-resolved: Missing MCN',
      };
    }
    return alert;
  }

  /**
   * Process existing alerts that weren't matched to any incoming alert.
   */
  private processUnmatchedExisting(
    existing: AlertWithMatch[],
    usedIndices: Set<number>
  ): { alerts: AlertWithMatch[]; updatedCount: number } {
    const alerts: AlertWithMatch[] = [];
    let updatedCount = 0;

    existing.forEach((alert, index) => {
      if (usedIndices.has(index)) return;

      if (alert.status !== 'resolved') {
        const now = new Date().toISOString();
        alerts.push({
          ...alert,
          status: 'resolved',
          resolvedAt: alert.resolvedAt || now,
          updatedAt: now,
        });
        updatedCount += 1;
      } else {
        alerts.push(alert);
      }
    });

    return { alerts, updatedCount };
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
   * @param preserveExistingLink - If true, preserve existing caseId when no match found (for status updates)
   */
  private rematchAlertForCases(
    alert: AlertWithMatch, 
    lookup: Map<string, CaseForAlertMatching>,
    preserveExistingLink = false
  ): AlertWithMatch {
    if (!alert) {
      return alert;
    }

    const normalizedMcn = normalizeMcn(alert.mcNumber ?? null);
    const matchedCase = normalizedMcn ? lookup.get(normalizedMcn) : undefined;

    if (!matchedCase) {
      // If preserveExistingLink is true and alert already has a caseId, keep the existing link
      // This prevents race conditions where React state hasn't synced with file data yet
      if (preserveExistingLink && alert.caseId) {
        return alert;
      }

      const correctStatus: AlertMatchStatus = normalizedMcn ? 'unmatched' : 'missing-mcn';
      
      // Update if status or case references need clearing
      if (alert.matchStatus !== correctStatus || alert.matchedCaseId || alert.caseId) {
        return {
          ...alert,
          // Clear persistent FK when unmatched
          caseId: undefined,
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
      // Persist caseId for FK relationship (alerts are deleted with their case)
      caseId: matchedCase.id,
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
