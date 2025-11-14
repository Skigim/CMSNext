import type { CaseDisplay, CaseStatus, AlertWorkflowStatus } from '../../types/case';
import type { AlertWithMatch, AlertsIndex, AlertsSummary } from '../alertsData';
import AutosaveFileService from '../AutosaveFileService';
import { createLogger } from '../logger';
import { reportFileStorageError, type FileStorageOperation } from '../fileStorageErrorReporter';
import { STORAGE_CONSTANTS } from '../constants/storage';
import { parseAlertsFromCsv } from '../alerts/alertsCsvParser';

const logger = createLogger('AlertsStorageService');

// ============================================================================
// Type Definitions
// ============================================================================

export interface StoredAlertWorkflowState {
  alertId: string;
  status?: AlertWorkflowStatus;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  updatedAt?: string | null;
  firstSeenAt?: string | null;
}

export type AlertsLoadErrorType =
  | 'INVALID_JSON'
  | 'MIGRATION_FAILED'
  | 'IO_ERROR'
  | 'PARSE_ERROR';

export interface AlertsLoadError {
  type: AlertsLoadErrorType;
  message: string;
  details?: unknown;
}

export interface AlertsStoragePayload {
  version: number;
  generatedAt: string;
  updatedAt: string;
  summary: AlertsSummary;
  alerts: AlertWithMatch[];
  uniqueAlerts: number;
  sourceFile?: string;
}

export interface LoadAlertsResult {
  alerts: AlertWithMatch[] | null;
  legacyWorkflows: StoredAlertWorkflowState[];
  needsMigration: boolean;
  sourceFile?: string;
  error?: AlertsLoadError;
}

export interface ImportAlertsResult {
  alerts: AlertWithMatch[];
  sourceFile?: string;
  error?: AlertsLoadError;
}

interface AlertsStorageServiceConfig {
  fileService: AutosaveFileService;
}

// ============================================================================
// AlertsStorageService
// ============================================================================

/**
 * AlertsStorageService
 * 
 * Foundation layer for alerts persistence.
 * Handles all file I/O operations for alert data.
 * 
 * Responsibilities:
 * - Read/write alerts.json with version handling
 * - Version migration (v1 legacy → v3 current format)
 * - Hydration: JSON → AlertWithMatch objects
 * - CSV import fallback when alerts.json doesn't exist
 * - Error handling and reporting
 * 
 * Storage format:
 * - V1: Legacy workflow states only
 * - V2: Alerts with workflows merged
 * - V3: Current format with enhanced metadata
 */
export class AlertsStorageService {
  private static readonly ALERTS_FILE_NAME = STORAGE_CONSTANTS.ALERTS.FILE_NAME;
  private static readonly ALERTS_CSV_NAME = STORAGE_CONSTANTS.ALERTS.CSV_NAME;
  private static readonly STORAGE_VERSION = STORAGE_CONSTANTS.ALERTS.STORAGE_VERSION;
  
  private static readonly ERROR_SOURCE = 'AlertsStorageService';
  
  private static readonly ALERT_MATCH_STATUS_SET = new Set<AlertWithMatch['matchStatus']>([
    'matched',
    'unmatched',
    'missing-mcn',
  ]);
  
  private static readonly ALERT_WORKFLOW_STATUSES: readonly AlertWorkflowStatus[] = [
    'new',
    'in-progress',
    'acknowledged',
    'snoozed',
    'resolved',
  ];
  
  private static readonly ALERT_WORKFLOW_STATUS_SET = new Set<AlertWorkflowStatus>(
    AlertsStorageService.ALERT_WORKFLOW_STATUSES,
  );

  private fileService: AutosaveFileService;

  constructor(config: AlertsStorageServiceConfig) {
    this.fileService = config.fileService;
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  /**
   * Load alerts from persistent storage (alerts.json)
   * 
   * Returns:
   * - alerts: Hydrated AlertWithMatch objects (v2+) or null (v1 or missing)
   * - legacyWorkflows: Legacy workflow states from v1 format
   * - needsMigration: true if v1 or corrupted data requires migration
   * - sourceFile: The file name where data was loaded from
   * - error: Structured error details if load failed
   */
  async loadAlertsFromStore(): Promise<LoadAlertsResult> {
    try {
      const payload = await this.fileService.readNamedFile(AlertsStorageService.ALERTS_FILE_NAME);
      
      if (!payload) {
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: false,
        };
      }

      if (typeof payload !== 'object' || payload === null) {
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: true,
          error: {
            type: 'INVALID_JSON',
            message: 'Payload is not a valid JSON object',
            details: { payloadType: typeof payload },
          },
        };
      }

      const root = payload as Record<string, unknown>;
      const version = typeof root.version === 'number' ? root.version : 1;
      const sourceFile = typeof root.sourceFile === 'string' ? root.sourceFile : undefined;

      // V2+ format: alerts with merged workflows (accept v2 and above)
      if (version >= 2) {
        if (!Array.isArray(root.alerts)) {
          return {
            alerts: null,
            legacyWorkflows: [],
            needsMigration: true,
            sourceFile,
            error: {
              type: 'MIGRATION_FAILED',
              message: 'V2+ format but alerts is not an array',
              details: { version, alertsType: typeof root.alerts },
            },
          };
        }

        const hydratedAlerts = (root.alerts as unknown[])
          .map(entry => this.hydrateStoredAlert(entry))
          .filter((alert): alert is AlertWithMatch => alert !== null);

        return {
          alerts: hydratedAlerts,
          legacyWorkflows: [],
          needsMigration: false, // V2+ format is current, no migration needed
          sourceFile,
        };
      }

      // V1 format: legacy workflows only
      const { workflows, needsMigration } = this.parseStoredAlertsPayload(root);
      return {
        alerts: null,
        legacyWorkflows: workflows,
        needsMigration: needsMigration || version < AlertsStorageService.STORAGE_VERSION,
        sourceFile,
      };
    } catch (error) {
      if (error instanceof SyntaxError || (error as Error)?.name === 'SyntaxError') {
        logger.warn('alerts.json contained invalid JSON and will be rebuilt', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: true,
          error: {
            type: 'INVALID_JSON',
            message: error instanceof Error ? error.message : 'Invalid JSON syntax',
            details: error,
          },
        };
      }

      this.reportStorageError('readData', error, {
        fileName: AlertsStorageService.ALERTS_FILE_NAME,
      }, 'We couldn\'t load saved alerts. Reconnect and try again.');

      return {
        alerts: null,
        legacyWorkflows: [],
        needsMigration: false,
        error: {
          type: 'IO_ERROR',
          message: error instanceof Error ? error.message : 'Unknown I/O error',
          details: error,
        },
      };
    }
  }

  /**
   * Save alerts to persistent storage (alerts.json)
   * 
   * @param payload - Complete payload with version, summary, and alerts
   * @returns true if save succeeded, false otherwise
   */
  async saveAlerts(payload: AlertsStoragePayload): Promise<boolean> {
    try {
      const success = await this.fileService.writeNamedFile(
        AlertsStorageService.ALERTS_FILE_NAME,
        payload
      );

      if (!success) {
        logger.warn('Failed to save alerts to storage');
      }

      return success;
    } catch (error) {
      this.reportStorageError('writeData', error, {
        fileName: AlertsStorageService.ALERTS_FILE_NAME,
      }, 'We couldn\'t save alerts. Reconnect and try again.');

      return false;
    }
  }

  /**
   * Import alerts from CSV file (fallback when alerts.json doesn't exist)
   * 
   * @param cases - Cases for alert matching
   * @returns ImportAlertsResult with parsed alerts or error
   */
  async importAlertsFromCsv(cases: CaseDisplay[]): Promise<ImportAlertsResult> {
    try {
      const csvContent = await this.fileService.readTextFile(AlertsStorageService.ALERTS_CSV_NAME);
      
      if (!csvContent) {
        return {
          alerts: [],
          sourceFile: AlertsStorageService.ALERTS_CSV_NAME,
        };
      }

      const parsed: AlertsIndex = parseAlertsFromCsv(csvContent, cases);
      
      return {
        alerts: parsed.alerts,
        sourceFile: AlertsStorageService.ALERTS_CSV_NAME,
      };
    } catch (error) {
      this.reportStorageError('readData', error, {
        fileName: AlertsStorageService.ALERTS_CSV_NAME,
      }, 'We couldn\'t read the alerts file. Reconnect and try again.');

      return {
        alerts: [],
        sourceFile: AlertsStorageService.ALERTS_CSV_NAME,
        error: {
          type: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to parse CSV',
          details: error,
        },
      };
    }
  }

  // =============================================================================
  // PRIVATE UTILITIES
  // =============================================================================

  /**
   * Hydrate a stored alert entry from JSON to AlertWithMatch object
   * Handles type coercion and validation
   */
  private hydrateStoredAlert(entry: unknown): AlertWithMatch | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const raw = entry as Record<string, unknown>;
    const idCandidate = typeof raw.id === 'string' ? raw.id.trim() : '';
    const reportIdCandidate = typeof raw.reportId === 'string' ? raw.reportId.trim() : '';
    const alertId = idCandidate || reportIdCandidate;
    
    if (!alertId) {
      return null;
    }

    const alert: AlertWithMatch = {
      id: alertId,
      reportId: reportIdCandidate || undefined,
      alertCode: typeof raw.alertCode === 'string' ? raw.alertCode : '',
      alertType: typeof raw.alertType === 'string' ? raw.alertType : '',
      alertDate: typeof raw.alertDate === 'string' ? raw.alertDate : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
      mcNumber:
        raw.mcNumber === null || typeof raw.mcNumber === 'string'
          ? (raw.mcNumber as string | null | undefined)
          : undefined,
      personName: typeof raw.personName === 'string' ? raw.personName : undefined,
      program: typeof raw.program === 'string' ? raw.program : undefined,
      region: typeof raw.region === 'string' ? raw.region : undefined,
      state: typeof raw.state === 'string' ? raw.state : undefined,
      source: typeof raw.source === 'string' ? raw.source : undefined,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      status: this.normalizeWorkflowStatus(raw.status),
      resolvedAt:
        raw.resolvedAt === null || typeof raw.resolvedAt === 'string'
          ? (raw.resolvedAt as string | null | undefined)
          : undefined,
      resolutionNotes: typeof raw.resolutionNotes === 'string' ? raw.resolutionNotes : undefined,
      metadata:
        typeof raw.metadata === 'object' && raw.metadata !== null
          ? (raw.metadata as Record<string, string | undefined>)
          : undefined,
      matchStatus: this.normalizeMatchStatus(raw.matchStatus),
      matchedCaseId: typeof raw.matchedCaseId === 'string' ? raw.matchedCaseId : undefined,
      matchedCaseName: typeof raw.matchedCaseName === 'string' ? raw.matchedCaseName : undefined,
      matchedCaseStatus: (typeof raw.matchedCaseStatus === 'string' ? raw.matchedCaseStatus as CaseStatus : undefined),
    };

    return alert;
  }

  /**
   * Parse legacy v1 payload to extract workflow states
   * Used for migration from v1 to v2+ format
   */
  private parseStoredAlertsPayload(payload: unknown): {
    workflows: StoredAlertWorkflowState[];
    needsMigration: boolean;
  } {
    if (!payload || typeof payload !== 'object') {
      return { workflows: [], needsMigration: false };
    }

    const root = payload as Record<string, unknown>;
    const version = typeof root.version === 'number' ? root.version : 1;
    const alertsInput = Array.isArray(root.alerts) ? root.alerts : [];

    const workflows: StoredAlertWorkflowState[] = [];
    let needsMigration = version < AlertsStorageService.STORAGE_VERSION;

    alertsInput.forEach(entry => {
      const { workflow, legacy } = this.normalizeStoredAlertEntry(entry);
      if (workflow) {
        workflows.push(workflow);
      }
      if (legacy) {
        needsMigration = true;
      }
    });

    return { workflows, needsMigration };
  }

  /**
   * Normalize a stored alert entry to workflow state
   * Detects legacy format and extracts workflow information
   */
  private normalizeStoredAlertEntry(entry: unknown): {
    workflow: StoredAlertWorkflowState | null;
    legacy: boolean;
  } {
    if (!entry || typeof entry !== 'object') {
      return { workflow: null, legacy: true };
    }

    const raw = entry as Record<string, unknown>;
    const candidateIds: Array<string | undefined> = [
      typeof raw.alertId === 'string' ? raw.alertId.trim() : undefined,
      typeof raw.id === 'string' ? raw.id.trim() : undefined,
      typeof raw.reportId === 'string' ? raw.reportId.trim() : undefined,
      typeof raw.alertCode === 'string' ? raw.alertCode.trim() : undefined,
    ];

    const alertId = candidateIds.find(id => id && id.length > 0) ?? null;
    if (!alertId) {
      return { workflow: null, legacy: true };
    }

    const status = typeof raw.status === 'string' ? (raw.status as AlertWorkflowStatus) : undefined;
    const resolvedAtValue = raw.resolvedAt;
    const resolvedAt =
      resolvedAtValue === null
        ? null
        : typeof resolvedAtValue === 'string'
          ? resolvedAtValue
          : undefined;
    const resolutionNotes =
      typeof raw.resolutionNotes === 'string' && raw.resolutionNotes.trim().length > 0
        ? raw.resolutionNotes
        : undefined;
    const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined;
    const firstSeenAtValue = raw.firstSeenAt;
    const firstSeenAt =
      firstSeenAtValue === null
        ? null
        : typeof firstSeenAtValue === 'string'
          ? firstSeenAtValue
          : undefined;

    // Detect legacy format (v1) - has full alert fields instead of just workflow state
    const legacy =
      typeof raw.alertId !== 'string' ||
      'alertType' in raw ||
      'program' in raw ||
      'region' in raw ||
      'state' in raw ||
      'source' in raw ||
      'description' in raw;

    return {
      workflow: {
        alertId,
        status,
        resolvedAt,
        resolutionNotes,
        updatedAt,
        firstSeenAt,
      },
      legacy,
    };
  }

  /**
   * Normalize match status with fallback to 'unmatched'
   */
  private normalizeMatchStatus(value: unknown): AlertWithMatch['matchStatus'] {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase() as AlertWithMatch['matchStatus'];
      if (AlertsStorageService.ALERT_MATCH_STATUS_SET.has(normalized)) {
        return normalized;
      }
    }

    return 'unmatched';
  }

  /**
   * Normalize workflow status with fallback to 'new'
   */
  private normalizeWorkflowStatus(value: unknown): AlertWorkflowStatus {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase() as AlertWorkflowStatus;
      if (AlertsStorageService.ALERT_WORKFLOW_STATUS_SET.has(normalized)) {
        return normalized;
      }
    }

    return 'new';
  }

  /**
   * Report storage errors with context
   */
  private reportStorageError(
    operation: FileStorageOperation,
    error: unknown,
    context?: Record<string, unknown>,
    fallbackMessage?: string,
  ): void {
    reportFileStorageError({
      operation,
      error,
      source: AlertsStorageService.ERROR_SOURCE,
      context,
      fallbackMessage,
    });
  }
}
