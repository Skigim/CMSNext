import type { CaseStatus, AlertWorkflowStatus } from '../../types/case';
import type { AlertWithMatch } from '../alertsData';
import { STORAGE_CONSTANTS } from '../constants/storage';

// ============================================================================
// Constants & Types
// ============================================================================

const ALERT_MATCH_STATUS_SET = new Set<AlertWithMatch['matchStatus']>([
  'matched',
  'unmatched',
  'missing-mcn',
]);

const ALERT_WORKFLOW_STATUSES: readonly AlertWorkflowStatus[] = [
  'new',
  'in-progress',
  'acknowledged',
  'snoozed',
  'resolved',
];

const ALERT_WORKFLOW_STATUS_SET = new Set<AlertWorkflowStatus>(
  ALERT_WORKFLOW_STATUSES,
);

export interface StoredAlertWorkflowState {
  alertId: string;
  status?: AlertWorkflowStatus;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  updatedAt?: string | null;
  firstSeenAt?: string | null;
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Hydrate a stored alert entry from JSON to AlertWithMatch object
 * Handles type coercion and validation
 */
export function hydrateStoredAlert(entry: unknown): AlertWithMatch | null {
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
    status: normalizeWorkflowStatus(raw.status),
    resolvedAt:
      raw.resolvedAt === null || typeof raw.resolvedAt === 'string'
        ? (raw.resolvedAt as string | null | undefined)
        : undefined,
    resolutionNotes: typeof raw.resolutionNotes === 'string' ? raw.resolutionNotes : undefined,
    metadata:
      typeof raw.metadata === 'object' && raw.metadata !== null
        ? (raw.metadata as Record<string, string | undefined>)
        : undefined,
    matchStatus: normalizeMatchStatus(raw.matchStatus),
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
export function parseStoredAlertsPayload(payload: unknown): {
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
  let needsMigration = version < STORAGE_CONSTANTS.ALERTS.STORAGE_VERSION;

  alertsInput.forEach(entry => {
    const { workflow, legacy } = normalizeStoredAlertEntry(entry);
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
function normalizeStoredAlertEntry(entry: unknown): {
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

  // Normalize legacy workflow status to ensure canonical values
  let status: AlertWorkflowStatus | undefined;
  if (typeof raw.status === 'string') {
    status = normalizeWorkflowStatus(raw.status);
  }

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
function normalizeMatchStatus(value: unknown): AlertWithMatch['matchStatus'] {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase() as AlertWithMatch['matchStatus'];
    if (ALERT_MATCH_STATUS_SET.has(normalized)) {
      return normalized;
    }
  }

  return 'unmatched';
}

/**
 * Normalize workflow status with fallback to 'new'
 */
function normalizeWorkflowStatus(value: unknown): AlertWorkflowStatus {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase() as AlertWorkflowStatus;
    if (ALERT_WORKFLOW_STATUS_SET.has(normalized)) {
      return normalized;
    }
  }

  return 'new';
}
