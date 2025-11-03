import {
  CaseDisplay,
  CaseCategory,
  FinancialItem,
  NewPersonData,
  NewCaseRecordData,
  CaseStatus,
  NewNoteData,
  AlertWorkflowStatus,
} from "../types/case";
import type { CaseActivityEntry } from "../types/activityLog";
import { v4 as uuidv4 } from 'uuid';
import AutosaveFileService from './AutosaveFileService';
import { transformImportedData } from './dataTransform';
import { createLogger } from './logger';
import {
  reportFileStorageError,
  type FileStorageOperation,
} from "./fileStorageErrorReporter";
import {
  CategoryConfig,
  CategoryKey,
  mergeCategoryConfig,
  sanitizeCategoryValues,
} from "../types/categoryConfig";
import {
  AlertsIndex,
  AlertsSummary,
  AlertWithMatch,
  createAlertsIndexFromAlerts,
  createEmptyAlertsIndex,
  buildAlertStorageKey,
  normalizeMcn,
  parseStackedAlerts,
} from "./alertsData";
import { toActivityDateKey } from "./activityReport";

interface DataManagerConfig {
  fileService: AutosaveFileService;
  persistNormalizationFixes?: boolean;
}

const logger = createLogger('DataManager');

function formatCaseDisplayName(caseData: CaseDisplay): string {
  const trimmedName = (caseData.name ?? "").trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  const firstName = caseData.person?.firstName?.trim() ?? "";
  const lastName = caseData.person?.lastName?.trim() ?? "";
  const composed = `${firstName} ${lastName}`.trim();

  if (composed.length > 0) {
    return composed;
  }

  return "Unknown Case";
}

function normalizeActivityLog(rawActivityLog: unknown): CaseActivityEntry[] {
  if (!Array.isArray(rawActivityLog)) {
    return [];
  }

  const normalized: CaseActivityEntry[] = [];

  for (const candidate of rawActivityLog) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const base = candidate as Partial<CaseActivityEntry> & { payload?: unknown };
    if (
      typeof base.id !== "string" ||
      typeof base.timestamp !== "string" ||
      typeof base.caseId !== "string" ||
      typeof base.caseName !== "string" ||
      typeof base.type !== "string"
    ) {
      continue;
    }

    const parsedTimestamp = new Date(base.timestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
      continue;
    }
    const normalizedTimestamp = parsedTimestamp.toISOString();

    if (base.type === "status-change") {
      const payload = base.payload as CaseActivityEntry["payload"] | undefined;
      if (!payload || typeof payload !== "object") {
        continue;
      }

      const fromStatus = (payload as any).fromStatus;
      const toStatus = (payload as any).toStatus;

      if (typeof toStatus !== "string") {
        continue;
      }

      normalized.push({
        id: base.id,
        timestamp: normalizedTimestamp,
        caseId: base.caseId,
        caseName: base.caseName,
        caseMcn: base.caseMcn ?? null,
        type: "status-change",
        payload: {
          fromStatus: typeof fromStatus === "string" || fromStatus === null ? fromStatus ?? null : undefined,
          toStatus,
        },
      });
      continue;
    }

    if (base.type === "note-added") {
      const payload = base.payload as CaseActivityEntry["payload"] | undefined;
      if (!payload || typeof payload !== "object") {
        continue;
      }

      const noteId = (payload as any).noteId;
      const category = (payload as any).category;
      const preview = (payload as any).preview;
      const content = (payload as any).content;

      if (typeof noteId !== "string" || typeof category !== "string" || typeof preview !== "string") {
        continue;
      }

      const sanitizedContent =
        typeof content === "string" && content.length > 0 ? sanitizeNoteContent(content) : undefined;

      normalized.push({
        id: base.id,
        timestamp: normalizedTimestamp,
        caseId: base.caseId,
        caseName: base.caseName,
        caseMcn: base.caseMcn ?? null,
        type: "note-added",
        payload: {
          noteId,
          category,
          preview,
          ...(sanitizedContent ? { content: sanitizedContent } : {}),
        },
      });
    }
  }

  return normalized.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function mergeActivityEntries(
  current: CaseActivityEntry[] | undefined,
  additions: CaseActivityEntry[],
): CaseActivityEntry[] {
  const combined = [...(current ?? []), ...additions];
  return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const LONG_NUMBER_PATTERN = /\b\d{10,}\b/g;
const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;

function sanitizeNoteContent(content: string): string {
  return content
    .replace(EMAIL_PATTERN, "***@***")
    .replace(SSN_PATTERN, "***-**-****")
    .replace(LONG_NUMBER_PATTERN, "***")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNotePreview(content: string): string {
  const sanitized = sanitizeNoteContent(content);

  if (sanitized.length === 0) {
    return "";
  }

  if (sanitized.length <= 160) {
    return sanitized;
  }
  return `${sanitized.slice(0, 157)}…`;
}

interface FileData {
  cases: CaseDisplay[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
}

interface StoredAlertWorkflowState {
  alertId: string;
  status?: AlertWorkflowStatus;
  resolvedAt?: string | null;
  resolutionNotes?: string;
  updatedAt?: string | null;
  firstSeenAt?: string | null;
}

interface AlertLookupCandidate {
  key: string;
  fallback: boolean;
}

interface LoadAlertsResult {
  alerts: AlertWithMatch[] | null;
  legacyWorkflows: StoredAlertWorkflowState[];
  needsMigration: boolean;
  invalidJson: boolean;
  sourceFile?: string;
}

interface MergeAlertsResult {
  added: number;
  updated: number;
  total: number;
}

/**
 * Normalizes note metadata for a collection of cases while gracefully pruning invalid entries.
 *
 * Ensures each note has an identifier, category, content, and timestamps. Notes that are not
 * objects are discarded instead of being converted into placeholder items to avoid confusing
 * empty entries in the UI.
 *
 * @param cases - The case collection to normalize.
 * @returns A tuple containing the normalized cases array and whether any changes were applied.
 */
function normalizeCaseNotes(cases: CaseDisplay[]): { cases: CaseDisplay[]; changed: boolean } {
  let changed = false;

  const normalizedCases = cases.map(caseItem => {
    const notes = caseItem.caseRecord?.notes;
    if (!Array.isArray(notes) || notes.length === 0) {
      return caseItem;
    }

    let notesChanged = false;
    const filteredNotes = notes.filter(note => {
      const isValid = !!note && typeof note === "object";
      if (!isValid) {
        notesChanged = true;
        changed = true;
      }
      return isValid;
    });

    if (filteredNotes.length === 0) {
      return {
        ...caseItem,
        caseRecord: {
          ...caseItem.caseRecord,
          notes: [],
        },
      };
    }

    const normalizedNotes = filteredNotes.map(note => {
      let noteChanged = false;

      const hasValidId = typeof note.id === "string" && note.id.trim().length > 0;
      const normalizedId = hasValidId ? note.id : uuidv4();
      if (!hasValidId) {
        noteChanged = true;
      }

      const normalizedCategory = note.category || "General";
      const normalizedContent = typeof note.content === "string" ? note.content : "";
      const normalizedCreatedAt = note.createdAt || note.updatedAt || new Date().toISOString();
      const normalizedUpdatedAt = note.updatedAt || normalizedCreatedAt;

      if (
        noteChanged ||
        normalizedCategory !== note.category ||
        normalizedContent !== note.content ||
        normalizedCreatedAt !== note.createdAt ||
        normalizedUpdatedAt !== note.updatedAt
      ) {
        noteChanged = true;
      }

      if (!noteChanged) {
        return note;
      }

      notesChanged = true;
      changed = true;
      return {
        ...note,
        id: normalizedId,
        category: normalizedCategory,
        content: normalizedContent,
        createdAt: normalizedCreatedAt,
        updatedAt: normalizedUpdatedAt,
      };
    });

    if (!notesChanged) {
      return caseItem;
    }

    return {
      ...caseItem,
      caseRecord: {
        ...caseItem.caseRecord,
        notes: normalizedNotes,
      },
    };
  });

  return { cases: normalizedCases, changed };
}

/**
 * Stateless Data Manager
 * 
 * Core Principles:
 * - NO data storage/caching anywhere
 * - File system is the single source of truth
 * - All operations: read file → modify → write file
 * - Always returns fresh data from file system
 */
export class DataManager {
  private fileService: AutosaveFileService;
  private persistNormalizationFixes: boolean;
  private static readonly ERROR_SOURCE = "DataManager";
  private static readonly ALERTS_FILE_NAME = "alerts.csv";
  private static readonly ALERTS_JSON_NAME = "alerts.json";
  private static readonly ALERTS_STORAGE_VERSION = 3;
  private static readonly ALERT_MATCH_STATUS_SET = new Set<AlertWithMatch["matchStatus"]>([
    "matched",
    "unmatched",
    "missing-mcn",
  ]);
  private static readonly ALERT_WORKFLOW_STATUSES: readonly AlertWorkflowStatus[] = [
    "new",
    "in-progress",
    "acknowledged",
    "snoozed",
    "resolved",
  ];
  private static readonly ALERT_WORKFLOW_STATUS_SET = new Set<AlertWorkflowStatus>(
    DataManager.ALERT_WORKFLOW_STATUSES,
  );
  private static readonly ALERT_WORKFLOW_PRIORITY: readonly AlertWorkflowStatus[] =
    DataManager.ALERT_WORKFLOW_STATUSES;

  constructor(config: DataManagerConfig) {
    this.fileService = config.fileService;
    this.persistNormalizationFixes = config.persistNormalizationFixes ?? true;
  }

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

  private rematchAlertForCases(alert: AlertWithMatch, lookup: Map<string, CaseDisplay>): AlertWithMatch {
    if (!alert) {
      return alert;
    }

  const normalizedMcn = normalizeMcn(alert.mcNumber ?? null);
    const matchedCase = normalizedMcn ? lookup.get(normalizedMcn) : undefined;

    if (!matchedCase) {
      if (alert.matchStatus === "matched" || alert.matchedCaseId) {
        return {
          ...alert,
          matchStatus: normalizedMcn ? "unmatched" : "missing-mcn",
          matchedCaseId: undefined,
          matchedCaseName: undefined,
          matchedCaseStatus: undefined,
        };
      }
      return alert;
    }

    return {
      ...alert,
      matchStatus: "matched",
      matchedCaseId: matchedCase.id,
      matchedCaseName: matchedCase.name,
      matchedCaseStatus: matchedCase.status,
    };
  }

  private rematchAlertsForCases(alerts: AlertWithMatch[], cases: CaseDisplay[]): AlertWithMatch[] {
    if (!alerts || alerts.length === 0) {
      return alerts ?? [];
    }

    const lookup = this.buildCaseLookup(cases);
    return alerts.map(alert => this.rematchAlertForCases(alert, lookup));
  }

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

  private alertKey(alert: AlertWithMatch): string {
    if (!alert) {
      return "";
    }

    const storageKey = buildAlertStorageKey(alert);
    if (storageKey && storageKey.trim().length > 0) {
      return storageKey;
    }

    return alert.reportId ?? alert.id ?? "";
  }

  private alertLegacyKey(alert: AlertWithMatch): string | null {
    if (!alert) {
      return null;
    }

    const baseId = alert.reportId?.trim() || alert.id?.trim();
    if (!baseId) {
      return null;
    }

    const dateSource = alert.alertDate || alert.updatedAt || alert.createdAt || "";
    if (!dateSource) {
      return baseId;
    }

    const parsed = new Date(dateSource);
    const normalizedDate = Number.isNaN(parsed.getTime())
      ? dateSource
      : parsed.toISOString().slice(0, 10);

    return `${baseId}|${normalizedDate}`;
  }

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

    if (alert.metadata && typeof alert.metadata === "object") {
      const metadataStrongKeys = ["uniqueId", "unique_id", "storageKey", "storage_key"];
      metadataStrongKeys.forEach(key => {
        const metaValue = alert.metadata?.[key];
        if (typeof metaValue === "string") {
          addCandidate(metaValue);
        }
      });

      const metadataFallbackKeys = [
        "alertId",
        "reportId",
        "id",
        "report_id",
        "alert_id",
        "alert_number",
        "alertNumber",
        "alertCode",
        "alert_code",
      ];
      metadataFallbackKeys.forEach(key => {
        const metaValue = alert.metadata?.[key];
        if (typeof metaValue === "string") {
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

    const normalizeDate = (value: string | null | undefined): string | null => {
      if (!value) {
        return null;
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }

      return value.slice(0, 10);
    };

    const incomingDate = normalizeDate(incoming.alertDate || incoming.updatedAt || incoming.createdAt);
    const existingDate = normalizeDate(existing.alertDate || existing.updatedAt || existing.createdAt);
    const datesMatch = incomingDate !== null && existingDate !== null && incomingDate === existingDate;

    const mcnMatches = incomingMcn !== null && existingMcn !== null && incomingMcn === existingMcn;

    if (datesMatch || mcnMatches) {
      return true;
    }

    return false;
  }

  private mergeAlertDetails(
    existing: AlertWithMatch,
    incoming: AlertWithMatch,
  ): { alert: AlertWithMatch; changed: boolean } {
    const mergedMetadata = {
      ...(existing.metadata ?? {}),
      ...(incoming.metadata ?? {}),
    };

    const metadataValue = Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined;

    const preferredStatus = this.selectPreferredWorkflowStatus(existing.status, incoming.status);
    const existingResolvedAt = existing.resolvedAt ?? null;
    const incomingResolvedAt = incoming.resolvedAt ?? null;

    const resolvedAtForStatus = preferredStatus === "resolved"
      ? existingResolvedAt ?? incomingResolvedAt ?? null
      : null;

    const resolutionNotesForStatus =
      preferredStatus === existing.status && existing.resolutionNotes !== undefined
        ? existing.resolutionNotes
        : preferredStatus === incoming.status && incoming.resolutionNotes !== undefined
          ? incoming.resolutionNotes
          : existing.resolutionNotes ?? incoming.resolutionNotes;

    const merged: AlertWithMatch = {
      ...incoming,
      metadata: metadataValue,
      status: preferredStatus,
      resolvedAt: resolvedAtForStatus,
      resolutionNotes: resolutionNotesForStatus,
    };

    if (!merged.mcNumber && existing.mcNumber) {
      merged.mcNumber = existing.mcNumber;
    }

    if (!merged.matchedCaseId && existing.matchedCaseId) {
      merged.matchedCaseId = existing.matchedCaseId;
    }

    if (!merged.matchedCaseName && existing.matchedCaseName) {
      merged.matchedCaseName = existing.matchedCaseName;
    }

    if (!merged.matchedCaseStatus && existing.matchedCaseStatus) {
      merged.matchedCaseStatus = existing.matchedCaseStatus;
    }

    const existingUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).getTime() : Number.NaN;
    const incomingUpdatedAt = merged.updatedAt ? new Date(merged.updatedAt).getTime() : Number.NaN;

    if (!Number.isNaN(existingUpdatedAt) && Number.isNaN(incomingUpdatedAt)) {
      merged.updatedAt = existing.updatedAt;
    } else if (!Number.isNaN(existingUpdatedAt) && !Number.isNaN(incomingUpdatedAt)) {
      if (existingUpdatedAt > incomingUpdatedAt) {
        merged.updatedAt = existing.updatedAt;
      }
    }

    const existingMetadataString = JSON.stringify(existing.metadata ?? {});
    const mergedMetadataString = JSON.stringify(metadataValue ?? {});
    const metadataChanged = existingMetadataString !== mergedMetadataString;

    const fieldsToCompare: Array<keyof AlertWithMatch> = [
      "alertCode",
      "alertType",
      "alertDate",
      "createdAt",
      "updatedAt",
      "mcNumber",
      "personName",
      "program",
      "region",
      "state",
      "source",
      "description",
      "status",
      "resolvedAt",
      "resolutionNotes",
      "matchStatus",
      "matchedCaseId",
      "matchedCaseName",
      "matchedCaseStatus",
    ];

    const detailsChanged =
      metadataChanged ||
      fieldsToCompare.some(field => {
        const existingValue = existing[field];
        const mergedValue = merged[field];

        if (existingValue === mergedValue) {
          return false;
        }

        if ((existingValue === null || existingValue === undefined) && (mergedValue === null || mergedValue === undefined)) {
          return false;
        }

        if (existingValue instanceof Date || mergedValue instanceof Date) {
          return existingValue?.valueOf() !== mergedValue?.valueOf();
        }

        return existingValue !== mergedValue;
      });

    return { alert: merged, changed: detailsChanged };
  }

  private isDebugEnvironment(): boolean {
    try {
      if (typeof import.meta !== "undefined" && (import.meta as any).env) {
        const env = (import.meta as any).env;
        if (typeof env.MODE === "string") {
          return env.MODE !== "production";
        }
        if (typeof env.DEV === "boolean") {
          return env.DEV;
        }
      }
    } catch (error) {
      // Ignore import.meta access issues in non-module contexts
    }

    if (typeof process !== "undefined" && process.env?.NODE_ENV) {
      return process.env.NODE_ENV !== "production";
    }

    return false;
  }

  private debugLogAlertsSample(source: string, alerts: AlertWithMatch[] | undefined): void {
    if (!alerts || alerts.length === 0 || !this.isDebugEnvironment()) {
      return;
    }

    const preview = alerts.slice(0, Math.min(alerts.length, 3)).map(alert => ({
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
      source,
      preview,
    });
  }

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

  private normalizeWorkflowStatus(value: unknown): AlertWorkflowStatus {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase() as AlertWorkflowStatus;
      if (DataManager.ALERT_WORKFLOW_STATUS_SET.has(normalized)) {
        return normalized;
      }
    }

    return "new";
  }

  private selectPreferredWorkflowStatus(
    existingStatus: AlertWorkflowStatus | null | undefined,
    incomingStatus: AlertWorkflowStatus | null | undefined,
  ): AlertWorkflowStatus {
    const normalizedExisting = this.normalizeWorkflowStatus(existingStatus);
    const normalizedIncoming = this.normalizeWorkflowStatus(incomingStatus);

    if (normalizedExisting === normalizedIncoming) {
      return normalizedExisting;
    }

    const existingPriority = DataManager.ALERT_WORKFLOW_PRIORITY.indexOf(normalizedExisting);
    const incomingPriority = DataManager.ALERT_WORKFLOW_PRIORITY.indexOf(normalizedIncoming);

    return incomingPriority > existingPriority ? normalizedIncoming : normalizedExisting;
  }

  private normalizeMatchStatus(value: unknown): AlertWithMatch["matchStatus"] {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase() as AlertWithMatch["matchStatus"];
      if (DataManager.ALERT_MATCH_STATUS_SET.has(normalized)) {
        return normalized;
      }
    }

    return "unmatched";
  }

  private hydrateStoredAlert(entry: unknown): AlertWithMatch | null {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const raw = entry as Record<string, unknown>;
    const idCandidate = typeof raw.id === "string" ? raw.id.trim() : "";
    const reportIdCandidate = typeof raw.reportId === "string" ? raw.reportId.trim() : "";
    const alertId = idCandidate || reportIdCandidate;
    if (!alertId) {
      return null;
    }

    const alert: AlertWithMatch = {
      id: alertId,
      reportId: reportIdCandidate || undefined,
      alertCode: typeof raw.alertCode === "string" ? raw.alertCode : "",
      alertType: typeof raw.alertType === "string" ? raw.alertType : "",
      alertDate: typeof raw.alertDate === "string" ? raw.alertDate : "",
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
      mcNumber:
        raw.mcNumber === null || typeof raw.mcNumber === "string"
          ? (raw.mcNumber as string | null | undefined)
          : undefined,
      personName: typeof raw.personName === "string" ? raw.personName : undefined,
      program: typeof raw.program === "string" ? raw.program : undefined,
      region: typeof raw.region === "string" ? raw.region : undefined,
      state: typeof raw.state === "string" ? raw.state : undefined,
      source: typeof raw.source === "string" ? raw.source : undefined,
      description: typeof raw.description === "string" ? raw.description : undefined,
      status: this.normalizeWorkflowStatus(raw.status),
      resolvedAt:
        raw.resolvedAt === null || typeof raw.resolvedAt === "string"
          ? (raw.resolvedAt as string | null | undefined)
          : undefined,
      resolutionNotes: typeof raw.resolutionNotes === "string" ? raw.resolutionNotes : undefined,
      metadata:
        typeof raw.metadata === "object" && raw.metadata !== null
          ? (raw.metadata as Record<string, string | undefined>)
          : undefined,
      matchStatus: this.normalizeMatchStatus(raw.matchStatus),
      matchedCaseId: typeof raw.matchedCaseId === "string" ? raw.matchedCaseId : undefined,
      matchedCaseName: typeof raw.matchedCaseName === "string" ? raw.matchedCaseName : undefined,
      matchedCaseStatus: (typeof raw.matchedCaseStatus === "string" ? raw.matchedCaseStatus as CaseStatus : undefined),
    };

    return alert;
  }

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

  private async loadAlertsFromStore(): Promise<LoadAlertsResult> {
    try {
      const payload = await this.fileService.readNamedFile(DataManager.ALERTS_JSON_NAME);
      if (!payload) {
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: false,
          invalidJson: false,
        };
      }

      if (typeof payload !== "object" || payload === null) {
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: true,
          invalidJson: false,
        };
      }

      const root = payload as Record<string, unknown>;
      const version = typeof root.version === "number" ? root.version : 1;
      const sourceFile = typeof root.sourceFile === "string" ? root.sourceFile : undefined;

      if (version >= DataManager.ALERTS_STORAGE_VERSION) {
        if (!Array.isArray(root.alerts)) {
          return {
            alerts: null,
            legacyWorkflows: [],
            needsMigration: true,
            invalidJson: false,
            sourceFile,
          };
        }

        const hydratedAlerts = (root.alerts as unknown[])
          .map(entry => this.hydrateStoredAlert(entry))
          .filter((alert): alert is AlertWithMatch => alert !== null);

        return {
          alerts: hydratedAlerts,
          legacyWorkflows: [],
          needsMigration: false,
          invalidJson: false,
          sourceFile,
        };
      }

      const { workflows, needsMigration } = this.parseStoredAlertsPayload(root);
      return {
        alerts: null,
        legacyWorkflows: workflows,
        needsMigration: needsMigration || version < DataManager.ALERTS_STORAGE_VERSION,
        invalidJson: false,
        sourceFile,
      };
    } catch (error) {
      if (error instanceof SyntaxError || (error as Error)?.name === "SyntaxError") {
        logger.warn('alerts.json contained invalid JSON and will be rebuilt', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
          alerts: null,
          legacyWorkflows: [],
          needsMigration: true,
          invalidJson: true,
        };
      }

      this.reportStorageError("readData", error, {
        fileName: DataManager.ALERTS_JSON_NAME,
      }, "We couldn’t load saved alerts. Reconnect and try again.");

      return {
        alerts: null,
        legacyWorkflows: [],
        needsMigration: false,
        invalidJson: false,
      };
    }
  }

  private async importAlertsFromCsv(cases: CaseDisplay[]): Promise<{ alerts: AlertWithMatch[]; sourceFile?: string }> {
    try {
      const csvContent = await this.fileService.readTextFile(DataManager.ALERTS_FILE_NAME);
      if (!csvContent) {
        return { alerts: [], sourceFile: DataManager.ALERTS_FILE_NAME };
      }

      const parsed = this.parseAlertsWithFallback(csvContent, cases);
      return { alerts: parsed.alerts, sourceFile: DataManager.ALERTS_FILE_NAME };
    } catch (error) {
      this.reportStorageError("readData", error, {
        fileName: DataManager.ALERTS_FILE_NAME,
      }, "We couldn’t read the alerts file. Reconnect and try again.");
      return { alerts: [], sourceFile: DataManager.ALERTS_FILE_NAME };
    }
  }

  private normalizeStoredAlertEntry(entry: unknown): {
    workflow: StoredAlertWorkflowState | null;
    legacy: boolean;
  } {
    if (!entry || typeof entry !== "object") {
      return { workflow: null, legacy: true };
    }

    const raw = entry as Record<string, unknown>;
    const candidateIds: Array<string | undefined> = [
      typeof raw.alertId === "string" ? raw.alertId.trim() : undefined,
      typeof raw.id === "string" ? raw.id.trim() : undefined,
      typeof raw.reportId === "string" ? raw.reportId.trim() : undefined,
      typeof raw.alertCode === "string" ? raw.alertCode.trim() : undefined,
    ];

    const alertId = candidateIds.find(id => id && id.length > 0) ?? null;
    if (!alertId) {
      return { workflow: null, legacy: true };
    }

    const status = typeof raw.status === "string" ? (raw.status as AlertWorkflowStatus) : undefined;
    const resolvedAtValue = raw.resolvedAt;
    const resolvedAt =
      resolvedAtValue === null
        ? null
        : typeof resolvedAtValue === "string"
          ? resolvedAtValue
          : undefined;
    const resolutionNotes =
      typeof raw.resolutionNotes === "string" && raw.resolutionNotes.trim().length > 0
        ? raw.resolutionNotes
        : undefined;
    const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : undefined;
    const firstSeenAtValue = raw.firstSeenAt;
    const firstSeenAt =
      firstSeenAtValue === null
        ? null
        : typeof firstSeenAtValue === "string"
          ? firstSeenAtValue
          : undefined;

    const legacy =
  typeof raw.alertId !== "string" ||
  "alertType" in raw ||
      "program" in raw ||
      "region" in raw ||
      "state" in raw ||
      "source" in raw ||
      "metadata" in raw;

    const workflow: StoredAlertWorkflowState = {
      alertId,
      ...(status ? { status } : {}),
      ...(resolvedAt !== undefined ? { resolvedAt } : {}),
      ...(resolutionNotes ? { resolutionNotes } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(firstSeenAt !== undefined ? { firstSeenAt } : {}),
    };

    return { workflow, legacy };
  }

  private parseStoredAlertsPayload(payload: unknown): {
    workflows: StoredAlertWorkflowState[];
    needsMigration: boolean;
  } {
    if (!payload || typeof payload !== "object") {
      return { workflows: [], needsMigration: false };
    }

    const root = payload as Record<string, unknown>;
    const version = typeof root.version === "number" ? root.version : 1;
    const alertsInput = Array.isArray(root.alerts) ? root.alerts : [];

    const workflows: StoredAlertWorkflowState[] = [];
    let needsMigration = version < DataManager.ALERTS_STORAGE_VERSION;

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
        status: workflow.status ?? alert.status ?? "new",
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

  private parseAlertsWithFallback(csvContent: string, cases: CaseDisplay[]): AlertsIndex {
    const stacked = parseStackedAlerts(csvContent, cases);
    const stackedUnique = this.countUniqueAlertKeys(stacked.alerts);

    if (this.isDebugEnvironment()) {
      const metrics = {
        stacked: {
          total: stacked.alerts.length,
          unique: stackedUnique,
          uniqueRatio:
            stacked.alerts.length > 0 && Number.isFinite(stackedUnique / stacked.alerts.length)
              ? Number((stackedUnique / stacked.alerts.length).toFixed(4))
              : 0,
        },
      };
  logger.debug('Alert parser metrics', { metrics });
    }

    this.debugLogAlertsSample(
      stacked.alerts.length > 0 ? "csv-stacked" : "csv-empty",
      stacked.alerts,
    );

    return stacked;
  }

  private reportStorageError(
    operation: FileStorageOperation,
    error: unknown,
    context?: Record<string, unknown>,
    fallbackMessage?: string,
  ) {
    reportFileStorageError({
      operation,
      error,
      source: DataManager.ERROR_SOURCE,
      context,
      fallbackMessage,
    });
  }

  /**
   * Migrate Phase 3 format (domain entities with metadata) to legacy CaseDisplay format
   * Extracts metadata.legacyCase.caseDisplay if present
   */
  private migratePhase3Format(cases: any[]): { migratedCases: CaseDisplay[]; wasMigrated: boolean } {
    const migratedCases: CaseDisplay[] = [];
    let migrationCount = 0;

    for (const caseData of cases) {
      // Check if this is Phase 3 format (has metadata.legacyCase.caseDisplay)
      if (caseData?.metadata?.legacyCase?.caseDisplay) {
        // Extract the legacy CaseDisplay from metadata
        const legacyCase = caseData.metadata.legacyCase.caseDisplay as CaseDisplay;
        migratedCases.push(legacyCase);
        migrationCount++;
      } else {
        // Already in legacy format or malformed - keep as-is
        migratedCases.push(caseData as CaseDisplay);
      }
    }

    if (migrationCount > 0) {
      logger.info('Phase 3 format detected, migrated to legacy format', {
        totalCases: cases.length,
        migratedCount: migrationCount,
      });
    }

    return {
      migratedCases,
      wasMigrated: migrationCount > 0,
    };
  }

  // =============================================================================
  // CORE FILE OPERATIONS (Private)
  // =============================================================================

  /**
   * Read current data from file system
   * Returns null if no file exists or error occurs
   */
  private async readFileData(): Promise<FileData | null> {
    try {
      const rawData = await this.fileService.readFile();
      
      if (!rawData) {
        // No file exists yet - return empty structure
        return {
          cases: [],
          exported_at: new Date().toISOString(),
          total_cases: 0,
          categoryConfig: mergeCategoryConfig(),
          activityLog: [],
        };
      }

      // Handle different data formats
      let cases: CaseDisplay[] = [];
      let needsPersistence = false;
      
      if (rawData.cases && Array.isArray(rawData.cases)) {
        // Check if this is Phase 3 format and migrate if needed
        const { migratedCases, wasMigrated } = this.migratePhase3Format(rawData.cases);
        cases = migratedCases;
        needsPersistence = wasMigrated;
      } else if (rawData.people && rawData.caseRecords) {
        // Raw format - transform using the data transformer
        logger.info('Transforming raw data format to cases');
        cases = transformImportedData(rawData);
      } else {
        // Try to transform whatever format this is
        cases = transformImportedData(rawData);
      }

      const categoryConfig = mergeCategoryConfig(rawData.categoryConfig);
      const activityLog = normalizeActivityLog((rawData as { activityLog?: unknown })?.activityLog);

      const { cases: normalizedCases, changed } = normalizeCaseNotes(cases);

      let finalCases = normalizedCases;
      let finalExportedAt = rawData.exported_at || rawData.exportedAt || new Date().toISOString();

      // Persist if migration occurred or notes were normalized
      if ((changed || needsPersistence) && this.persistNormalizationFixes) {
        if (needsPersistence) {
          logger.info('Persisting migrated Phase 3 data');
        }
        const persistedData = await this.writeFileData({
          cases: normalizedCases,
          exported_at: finalExportedAt,
          total_cases: normalizedCases.length,
          categoryConfig,
          activityLog,
        });

        finalCases = persistedData.cases;
        finalExportedAt = persistedData.exported_at;
      } else if (changed || needsPersistence) {
        logger.warn('Data normalization or migration needed but persistence disabled');
      }

      return {
        cases: finalCases,
        exported_at: finalExportedAt,
        total_cases: finalCases.length,
        categoryConfig,
        activityLog,
      };
    } catch (error) {
      logger.error('Failed to read file data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.reportStorageError("readData", error, { method: "readFileData" });
      throw new Error(`Failed to read case data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write data to file system with retry logic
   * Throws error if write fails after retries
   */
  private async writeFileData(data: FileData): Promise<FileData> {
    try {
      // Ensure data integrity before writing
      const validatedData: FileData = {
        ...data,
        exported_at: new Date().toISOString(),
        total_cases: data.cases.length,
        categoryConfig: mergeCategoryConfig(data.categoryConfig),
        cases: data.cases.map(caseItem => ({ ...caseItem })),
        activityLog: [...(data.activityLog ?? [])]
          .map((entry): CaseActivityEntry =>
            entry.type === "status-change"
              ? {
                  ...entry,
                  payload: { ...entry.payload },
                }
              : {
                  ...entry,
                  payload: { ...entry.payload },
                },
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      };

      const success = await this.fileService.writeFile(validatedData);
      
      if (!success) {
        throw new Error('File write operation failed');
      }

      return validatedData;
    } catch (error) {
      logger.error('Failed to write file data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Provide specific error messaging based on error type
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.message.includes('state cached in an interface object') || 
            error.message.includes('state had changed')) {
          errorMessage = 'File was modified by another process. Please try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check file permissions.';
        } else {
          errorMessage = error.message;
        }
      }

      this.reportStorageError("writeData", error, {
        method: "writeFileData",
        errorMessage,
      });

      throw new Error(`Failed to save case data: ${errorMessage}`);
    }
  }

  private touchCaseTimestamps(
    cases: CaseDisplay[],
    touchedCaseIds?: Iterable<string>,
  ): CaseDisplay[] {
    if (!touchedCaseIds) {
      return cases;
    }

    const ids = touchedCaseIds instanceof Set ? touchedCaseIds : new Set(touchedCaseIds);
    if (ids.size === 0) {
      return cases;
    }

    const timestamp = new Date().toISOString();

    return cases.map(caseItem => (
      ids.has(caseItem.id)
        ? { ...caseItem, updatedAt: timestamp }
        : caseItem
    ));
  }

  // =============================================================================
  // PUBLIC API - READ OPERATIONS
  // =============================================================================

  /**
   * Get all cases (always reads fresh from file)
   */
  async getAllCases(): Promise<CaseDisplay[]> {
    const data = await this.readFileData();
    return data ? data.cases : [];
  }

  async getActivityLog(): Promise<CaseActivityEntry[]> {
    const data = await this.readFileData();
    return data?.activityLog ?? [];
  }

  async clearActivityLogForDate(targetDate: string | Date): Promise<number> {
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const { activityLog } = currentData;
    if (!activityLog || activityLog.length === 0) {
      return 0;
    }

    const dateKey = toActivityDateKey(targetDate);

    const filtered = activityLog.filter(entry => {
      try {
        return toActivityDateKey(entry.timestamp) !== dateKey;
      } catch (error) {
        logger.warn('Skipping activity entry with invalid timestamp during clear operation', {
          entryId: entry.id,
          timestamp: entry.timestamp,
          error: error instanceof Error ? error.message : error,
        });
        return true;
      }
    });

    const removedCount = activityLog.length - filtered.length;
    if (removedCount === 0) {
      return 0;
    }

    const updatedData: FileData = {
      ...currentData,
      activityLog: filtered,
    };

    await this.writeFileData(updatedData);

    logger.info('Cleared activity log entries for date', {
      dateKey,
      removedCount,
    });

    return removedCount;
  }

  /**
   * Get a specific case by ID (always reads fresh from file)
   */
  async getCaseById(caseId: string): Promise<CaseDisplay | null> {
    const data = await this.readFileData();
    if (!data) return null;
    
    const caseItem = data.cases.find(c => c.id === caseId);
    return caseItem || null;
  }

  /**
   * Get cases count (always reads fresh from file)
   */
  async getCasesCount(): Promise<number> {
    const data = await this.readFileData();
    return data ? data.cases.length : 0;
  }

  async getAlertsIndex(options: { cases?: CaseDisplay[] } = {}): Promise<AlertsIndex> {
    const cases = options.cases ?? (await this.getAllCases());

    const loadResult = await this.loadAlertsFromStore();
    let alerts = loadResult.alerts ?? [];
    let shouldPersist = loadResult.needsMigration || loadResult.invalidJson;
    let sourceFile = loadResult.sourceFile;

    if (alerts.length === 0) {
      const imported = await this.importAlertsFromCsv(cases);
      alerts = imported.alerts;
      sourceFile = imported.sourceFile ?? sourceFile;

      if (alerts.length === 0) {
        if (shouldPersist) {
          const emptyIndex = createAlertsIndexFromAlerts([]);
          void this.saveAlerts(emptyIndex.alerts, emptyIndex.summary, { sourceFile });
        }
        return createEmptyAlertsIndex();
      }

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
    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    this.debugLogAlertsSample("alerts-active", index.alerts);

    if (!shouldPersist && this.haveAlertsChanged(originalAlerts, rematchedAlerts)) {
      shouldPersist = true;
    }

    if (shouldPersist) {
      logger.info('Persisting alerts to store', {
        alertCount: index.alerts.length,
        sourceFile,
      });
      void this.saveAlerts(index.alerts, index.summary, { sourceFile });
    }

    return index;
  }

  async updateAlertStatus(
    alertId: string,
    updates: {
      status?: AlertWorkflowStatus;
      resolvedAt?: string | null;
      resolutionNotes?: string;
    },
    options: { cases?: CaseDisplay[] } = {},
  ): Promise<AlertWithMatch | null> {
    const cases = options.cases ?? (await this.getAllCases());

    const loadResult = await this.loadAlertsFromStore();
    let alerts = loadResult.alerts ?? [];
    let sourceFile = loadResult.sourceFile;

    if (alerts.length === 0) {
      const imported = await this.importAlertsFromCsv(cases);
      alerts = imported.alerts;
      sourceFile = imported.sourceFile ?? sourceFile;

      if (alerts.length === 0) {
        logger.warn('No alerts available to update status', { alertId });
        return null;
      }

      if (loadResult.legacyWorkflows.length > 0) {
        const applied = this.applyStoredAlertWorkflows(alerts, loadResult.legacyWorkflows);
        alerts = applied.alerts;
      }
    }

    const normalizedAlertId = typeof alertId === "string" ? alertId.trim() : "";
    if (normalizedAlertId.length === 0) {
      logger.warn('Invalid alert identifier for status update', { alertId });
      return null;
    }

    let targetIndex = alerts.findIndex(alert => alert.id === normalizedAlertId);

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
    const nextStatus: AlertWorkflowStatus = updates.status ?? targetAlert.status ?? "new";
    let nextResolvedAt: string | null =
      updates.resolvedAt !== undefined ? updates.resolvedAt : targetAlert.resolvedAt ?? null;

    if (nextStatus === "resolved" && !nextResolvedAt) {
      nextResolvedAt = new Date().toISOString();
    }

    if (nextStatus !== "resolved") {
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

    const rematchedAlerts = this.rematchAlertsForCases(alerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    await this.saveAlerts(index.alerts, index.summary, { sourceFile });

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

  async saveAlerts(
    alerts: AlertWithMatch[],
    summary?: AlertsSummary,
    options: { sourceFile?: string } = {},
  ): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const index = summary
        ? { alerts, summary }
        : createAlertsIndexFromAlerts(alerts);

      const normalizedAlerts = index.alerts;
      const payload: Record<string, unknown> = {
        version: DataManager.ALERTS_STORAGE_VERSION,
        generatedAt: now,
        updatedAt: now,
        summary: index.summary,
        alerts: normalizedAlerts,
        uniqueAlerts: this.countUniqueAlertKeys(normalizedAlerts),
      };

      if (options.sourceFile) {
        payload.sourceFile = options.sourceFile;
      }

      logger.info('Saving alerts to alerts.json', {
        alertCount: normalizedAlerts.length,
        sourceFile: options.sourceFile,
      });

      const success = await this.fileService.writeNamedFile(DataManager.ALERTS_JSON_NAME, payload);
      if (!success) {
        throw new Error("Alerts write operation failed");
      }

      try {
        if (typeof this.fileService.notifyDataChange === "function") {
          this.fileService.notifyDataChange();
        }
      } catch (notifyError) {
        logger.warn('Failed to notify file storage change after saving alerts', {
          error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
        });
      }

      return true;
    } catch (error) {
      this.reportStorageError("writeData", error, {
        fileName: DataManager.ALERTS_JSON_NAME,
      }, "We couldn’t save the alerts file. Try again after reconnecting.");
      return false;
    }
  }

  async mergeAlertsFromCsvContent(
    csvContent: string,
    options: { cases?: CaseDisplay[]; sourceFileName?: string } = {},
  ): Promise<MergeAlertsResult> {
    const cases = options.cases ?? (await this.getAllCases());

    const loadResult = await this.loadAlertsFromStore();
    const storedAlerts = loadResult.alerts ?? [];
    let shouldPersist = loadResult.needsMigration || loadResult.invalidJson;
    let sourceFileName = loadResult.sourceFile ?? DataManager.ALERTS_FILE_NAME;

    const requestedSourceFile = options.sourceFileName?.trim();
    if (requestedSourceFile && requestedSourceFile !== sourceFileName) {
      sourceFileName = requestedSourceFile;
      shouldPersist = true;
    } else if (requestedSourceFile) {
      sourceFileName = requestedSourceFile;
    }

    let workingAlerts = storedAlerts.length > 0
      ? this.rematchAlertsForCases(storedAlerts, cases)
      : [];
    const existingAlertCount = workingAlerts.length;
    const matchedExistingIndices = new Set<number>();

    const incomingIndex =
      csvContent && csvContent.trim().length > 0
        ? this.parseAlertsWithFallback(csvContent, cases)
        : createEmptyAlertsIndex();
    const incomingAlerts = incomingIndex.alerts;

    const existingMap = new Map<string, Set<number>>();
    const registerCandidateKey = (key: string, index: number) => {
      if (!key) {
        return;
      }

      if (!existingMap.has(key)) {
        existingMap.set(key, new Set());
      }

      existingMap.get(key)!.add(index);
    };

    const registerAlertCandidates = (alert: AlertWithMatch, index: number) => {
      this.buildAlertLookupCandidates(alert).forEach(candidate => {
        registerCandidateKey(candidate.key, index);
      });
    };

    workingAlerts.forEach((alert, index) => {
      registerAlertCandidates(alert, index);
    });

    const fallbackLockedIndices = new Set<number>();

    let added = 0;
    let updated = 0;

    incomingAlerts.forEach(incoming => {
      const candidates = this.buildAlertLookupCandidates(incoming);
      if (candidates.length === 0) {
        return;
      }

      const incomingStrongKeys = candidates.filter(candidate => !candidate.fallback).map(candidate => candidate.key);

      let matchedIndex: number | undefined;
      let matchedUsingFallback = false;

      for (const candidate of candidates) {
        const mappedSet = existingMap.get(candidate.key);
        if (!mappedSet || mappedSet.size === 0) {
          continue;
        }

        for (const index of mappedSet) {
          if (candidate.fallback && fallbackLockedIndices.has(index)) {
            continue;
          }

          const existingAlert = workingAlerts[index];
          if (!existingAlert) {
            continue;
          }

          if (candidate.fallback) {
            if (!this.shouldMatchUsingFallback(incoming, existingAlert, incomingStrongKeys)) {
              continue;
            }
            matchedIndex = index;
            matchedUsingFallback = true;
            break;
          }

          matchedIndex = index;
          matchedUsingFallback = false;
          break;
        }

        if (matchedIndex !== undefined) {
          break;
        }
      }

      if (matchedIndex === undefined) {
        const newIndex = workingAlerts.push(incoming) - 1;
        registerAlertCandidates(incoming, newIndex);
        added += 1;
        shouldPersist = true;
        return;
      }

      if (matchedIndex < existingAlertCount) {
        matchedExistingIndices.add(matchedIndex);
      }

      if (matchedUsingFallback) {
        fallbackLockedIndices.add(matchedIndex);
      }

      const existingAlert = workingAlerts[matchedIndex];
      const { alert: mergedAlert, changed } = this.mergeAlertDetails(existingAlert, incoming);
      const resultingAlert = changed ? mergedAlert : existingAlert;

      if (changed) {
        workingAlerts[matchedIndex] = mergedAlert;
        updated += 1;
        shouldPersist = true;
      }

      registerAlertCandidates(resultingAlert, matchedIndex);
    });

    if (loadResult.legacyWorkflows.length > 0 && workingAlerts.length > 0) {
      const applied = this.applyStoredAlertWorkflows(workingAlerts, loadResult.legacyWorkflows);
      workingAlerts = applied.alerts;
      if (applied.changed || applied.unmatchedIds.length > 0) {
        shouldPersist = true;
      }
    }

    if (existingAlertCount > 0) {
      const resolutionTimestamp = new Date().toISOString();

      for (let index = 0; index < existingAlertCount; index += 1) {
        if (matchedExistingIndices.has(index)) {
          continue;
        }

        const alert = workingAlerts[index];
        if (!alert) {
          continue;
        }

        const alreadyResolved = (alert.status ?? "new").toLowerCase() === "resolved";
        const hasResolution = alreadyResolved && alert.resolvedAt && String(alert.resolvedAt).trim().length > 0;

        if (alreadyResolved && hasResolution) {
          continue;
        }

        const resolvedAt = hasResolution ? alert.resolvedAt : resolutionTimestamp;
        const nextAlert: AlertWithMatch = {
          ...alert,
          status: "resolved",
          resolvedAt: resolvedAt ?? resolutionTimestamp,
          updatedAt: resolutionTimestamp,
        };

        if (!this.alertsAreEqual(alert, nextAlert) || alert.updatedAt !== nextAlert.updatedAt) {
          workingAlerts[index] = nextAlert;
          updated += 1;
          shouldPersist = true;
        }
      }
    }

    const rematchedAlerts = this.rematchAlertsForCases(workingAlerts, cases);
    const index = createAlertsIndexFromAlerts(rematchedAlerts);

    shouldPersist = shouldPersist || added > 0 || updated > 0;

    if (shouldPersist) {
      await this.saveAlerts(index.alerts, index.summary, { sourceFile: sourceFileName });
    }

    this.debugLogAlertsSample("alerts-merge", index.alerts);

    return {
      added,
      updated,
      total: index.alerts.length,
    };
  }

  // =============================================================================
  // PUBLIC API - CATEGORY CONFIGURATION
  // =============================================================================

  async getCategoryConfig(): Promise<CategoryConfig> {
    const data = await this.readFileData();
    return data ? mergeCategoryConfig(data.categoryConfig) : mergeCategoryConfig();
  }

  async updateCategoryConfig(categoryConfig: CategoryConfig): Promise<CategoryConfig> {
    const sanitized = mergeCategoryConfig(categoryConfig);
    const currentData = await this.readFileData();

    const baseData: FileData = currentData ?? {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig: mergeCategoryConfig(),
      activityLog: [],
    };

    const updatedData: FileData = {
      ...baseData,
      categoryConfig: sanitized,
    };

    await this.writeFileData(updatedData);
    return sanitized;
  }

  async updateCategoryValues(key: CategoryKey, values: string[]): Promise<CategoryConfig> {
    const sanitizedValues = sanitizeCategoryValues(values);
    if (sanitizedValues.length === 0) {
      throw new Error('At least one option is required');
    }

    const currentConfig = await this.getCategoryConfig();
    const nextConfig: CategoryConfig = {
      ...currentConfig,
      [key]: sanitizedValues,
    };

    return this.updateCategoryConfig(nextConfig);
  }

  async resetCategoryConfig(): Promise<CategoryConfig> {
    const defaults = mergeCategoryConfig();
    await this.updateCategoryConfig(defaults);
    return defaults;
  }

  // =============================================================================
  // PUBLIC API - WRITE OPERATIONS
  // =============================================================================

  /**
   * Create a new complete case
   * Pattern: read → modify → write
   */
  async createCompleteCase(caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Create new case
    const newCase: CaseDisplay = {
      id: uuidv4(),
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      mcn: caseData.caseRecord.mcn,
      status: caseData.caseRecord.status,
      priority: Boolean(caseData.caseRecord.priority),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      person: {
        id: uuidv4(),
        firstName: caseData.person.firstName,
        lastName: caseData.person.lastName,
        name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
        dateOfBirth: caseData.person.dateOfBirth || '',
        ssn: caseData.person.ssn || '',
        phone: caseData.person.phone || '',
        email: caseData.person.email || '',
        organizationId: caseData.person.organizationId || null,
        livingArrangement: caseData.person.livingArrangement || '',
        address: caseData.person.address || {
          street: '',
          city: '',
          state: '',
          zip: ''
        },
        mailingAddress: caseData.person.mailingAddress || {
          street: '',
          city: '',
          state: '',
          zip: '',
          sameAsPhysical: true
        },
        authorizedRepIds: caseData.person.authorizedRepIds || [],
        familyMembers: caseData.person.familyMembers || [],
        status: caseData.person.status || 'Active',
        dateAdded: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      caseRecord: {
        id: uuidv4(),
        personId: '', // Will be set below
        mcn: caseData.caseRecord.mcn,
        applicationDate: caseData.caseRecord.applicationDate || new Date().toISOString(),
        caseType: caseData.caseRecord.caseType || 'General',
        spouseId: caseData.caseRecord.spouseId || '',
        status: caseData.caseRecord.status,
        description: caseData.caseRecord.description || '',
        priority: Boolean(caseData.caseRecord.priority),
        livingArrangement: caseData.caseRecord.livingArrangement || '',
        withWaiver: Boolean(caseData.caseRecord.withWaiver),
        admissionDate: caseData.caseRecord.admissionDate || new Date().toISOString(),
        organizationId: caseData.caseRecord.organizationId || '',
        authorizedReps: caseData.caseRecord.authorizedReps || [],
        retroRequested: caseData.caseRecord.retroRequested || '',
        financials: {
          resources: [],
          income: [],
          expenses: []
        },
        notes: [],
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      }
    };

    // Set the person ID reference
    newCase.caseRecord.personId = newCase.person.id;

    // Modify data
    const casesWithNewCase = [...currentData.cases, newCase];
    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithNewCase, [newCase.id]);

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps.find(c => c.id === newCase.id) ?? newCase;
  }

  /**
   * Update an existing complete case
   * Pattern: read → modify → write
   */
  async updateCompleteCase(caseId: string, caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const existingCase = currentData.cases[caseIndex];

    // Update person data
    const updatedPerson = {
      ...existingCase.person,
      firstName: caseData.person.firstName,
      lastName: caseData.person.lastName,
      name: `${caseData.person.firstName} ${caseData.person.lastName}`.trim(),
      dateOfBirth: caseData.person.dateOfBirth || '',
      ssn: caseData.person.ssn || '',
      phone: caseData.person.phone || '',
      email: caseData.person.email || '',
      organizationId: caseData.person.organizationId || null,
      livingArrangement: caseData.person.livingArrangement || '',
      address: caseData.person.address || existingCase.person.address,
      mailingAddress: caseData.person.mailingAddress || existingCase.person.mailingAddress,
      authorizedRepIds: caseData.person.authorizedRepIds || [],
      familyMembers: caseData.person.familyMembers || [],
      status: caseData.person.status || 'Active'
    };

    // Update case record data
    const updatedCaseRecord = {
      ...existingCase.caseRecord,
      mcn: caseData.caseRecord.mcn,
      applicationDate: caseData.caseRecord.applicationDate || existingCase.caseRecord.applicationDate,
      caseType: caseData.caseRecord.caseType || existingCase.caseRecord.caseType,
      spouseId: caseData.caseRecord.spouseId || '',
      status: caseData.caseRecord.status,
      description: caseData.caseRecord.description || '',
      priority: Boolean(caseData.caseRecord.priority),
      livingArrangement: caseData.caseRecord.livingArrangement || '',
      withWaiver: Boolean(caseData.caseRecord.withWaiver),
      admissionDate: caseData.caseRecord.admissionDate || existingCase.caseRecord.admissionDate,
      organizationId: caseData.caseRecord.organizationId || '',
      authorizedReps: caseData.caseRecord.authorizedReps || [],
      retroRequested: caseData.caseRecord.retroRequested || '',
      // Preserve existing financials and notes
      financials: existingCase.caseRecord.financials,
      notes: existingCase.caseRecord.notes,
      updatedDate: new Date().toISOString()
    };

    const caseWithChanges: CaseDisplay = {
      ...existingCase,
      name: updatedPerson.name,
      mcn: updatedCaseRecord.mcn,
      status: updatedCaseRecord.status,
      priority: updatedCaseRecord.priority,
      person: updatedPerson,
      caseRecord: updatedCaseRecord,
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithChanges : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Modify data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  async updateCaseStatus(caseId: string, status: CaseDisplay["status"]): Promise<CaseDisplay> {
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error("Case not found");
    }

    const targetCase = currentData.cases[caseIndex];

    const currentStatus = targetCase.caseRecord?.status ?? targetCase.status;
    if (currentStatus === status) {
      return targetCase;
    }

    const caseWithUpdatedStatus: CaseDisplay = {
      ...targetCase,
      status,
      caseRecord: {
        ...targetCase.caseRecord,
        status,
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedStatus : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "status-change",
      payload: {
        fromStatus: targetCase.caseRecord?.status ?? targetCase.status,
        toStatus: status,
      },
    };

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete a case
   * Pattern: read → modify → write
   */
  async deleteCase(caseId: string): Promise<void> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Check if case exists
    const caseExists = currentData.cases.some(c => c.id === caseId);
    if (!caseExists) {
      throw new Error('Case not found');
    }

    // Modify data (remove case)
    const updatedData: FileData = {
      ...currentData,
      cases: currentData.cases.filter(c => c.id !== caseId)
    };

    // Write back to file
    await this.writeFileData(updatedData);
  }

  // =============================================================================
  // FINANCIAL ITEM OPERATIONS
  // =============================================================================

  /**
   * Add financial item to a case
   * Pattern: read → modify → write
   */
  async addItem(caseId: string, category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Create new item
    const newItem: FinancialItem = {
      ...itemData,
      id: uuidv4(),
      dateAdded: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithNewItem: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: [...targetCase.caseRecord.financials[category], newItem],
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNewItem : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update financial item in a case
   * Pattern: read → modify → write
   */
  async updateItem(
    caseId: string,
    category: CaseCategory,
    itemId: string,
    updatedItem: Partial<FinancialItem>,
  ) {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Find item to update
    const itemIndex = targetCase.caseRecord.financials[category].findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const existingItem = targetCase.caseRecord.financials[category][itemIndex];

    // Update item
    const updatedItemData: FinancialItem = {
      ...existingItem,
      ...updatedItem,
      id: itemId, // Preserve ID
      createdAt: existingItem.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithUpdatedItem: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].map((item, index) =>
            index === itemIndex ? updatedItemData : item,
          ),
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedItem : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete financial item from a case
   * Pattern: read → modify → write
   */
  async deleteItem(caseId: string, category: CaseCategory, itemId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Check if item exists
    const itemExists = targetCase.caseRecord.financials[category].some(item => item.id === itemId);
    if (!itemExists) {
      throw new Error('Item not found');
    }

    // Modify case data
    const caseWithItemRemoved: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        financials: {
          ...targetCase.caseRecord.financials,
          [category]: targetCase.caseRecord.financials[category].filter(item => item.id !== itemId),
        },
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithItemRemoved : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  // =============================================================================
  // NOTE OPERATIONS
  // =============================================================================

  /**
   * Add note to a case
   * Pattern: read → modify → write
   */
  async addNote(caseId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Create new note
    const timestamp = new Date().toISOString();
    const newNote = {
      id: uuidv4(),
      category: noteData.category || 'General',
      content: noteData.content,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // Modify case data
    const caseWithNewNote: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: [...(targetCase.caseRecord.notes || []), newNote],
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNewNote : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const sanitizedContent = sanitizeNoteContent(noteData.content ?? "");

    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp,
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "note-added",
      payload: {
        noteId: newNote.id,
        category: newNote.category,
        preview: buildNotePreview(noteData.content ?? ""),
        content: sanitizedContent,
      },
    };

    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
      activityLog: mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Update note in a case
   * Pattern: read → modify → write
   */
  async updateNote(caseId: string, noteId: string, noteData: NewNoteData): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Find note to update
    const noteIndex = (targetCase.caseRecord.notes || []).findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    const existingNote = targetCase.caseRecord.notes![noteIndex];

    // Update note
    const updatedNote = {
      ...existingNote,
      category: noteData.category || existingNote.category,
      content: noteData.content,
      updatedAt: new Date().toISOString()
    };

    // Modify case data
    const caseWithUpdatedNote: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).map((note, index) =>
          index === noteIndex ? updatedNote : note,
        ),
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithUpdatedNote : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  /**
   * Delete note from a case
   * Pattern: read → modify → write
   */
  async deleteNote(caseId: string, noteId: string): Promise<CaseDisplay> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Find case to update
    const caseIndex = currentData.cases.findIndex(c => c.id === caseId);
    if (caseIndex === -1) {
      throw new Error('Case not found');
    }

    const targetCase = currentData.cases[caseIndex];

    // Check if note exists
    const noteExists = (targetCase.caseRecord.notes || []).some(note => note.id === noteId);
    if (!noteExists) {
      throw new Error('Note not found');
    }

    // Modify case data
    const caseWithNoteRemoved: CaseDisplay = {
      ...targetCase,
      caseRecord: {
        ...targetCase.caseRecord,
        notes: (targetCase.caseRecord.notes || []).filter(note => note.id !== noteId),
        updatedDate: new Date().toISOString(),
      },
    };

    const casesWithChanges = currentData.cases.map((c, index) =>
      index === caseIndex ? caseWithNoteRemoved : c,
    );

    const casesWithTouchedTimestamps = this.touchCaseTimestamps(casesWithChanges, [caseId]);

    // Update data
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);

    return casesWithTouchedTimestamps[caseIndex];
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Import multiple cases at once
   * Pattern: read → modify → write (single operation)
   */
  async importCases(cases: CaseDisplay[]): Promise<void> {
    // Read current data
    const currentData = await this.readFileData();
    if (!currentData) {
      throw new Error('Failed to read current data');
    }

    // Validate and ensure unique IDs
    const casesToImport = cases.map(caseItem => ({
      ...caseItem,
      id: caseItem.id || uuidv4(),
      caseRecord: {
        ...caseItem.caseRecord,
        updatedDate: new Date().toISOString(),
      },
    }));

    const touchedCaseIds = casesToImport.map(caseItem => caseItem.id);

    const combinedCases = [...currentData.cases, ...casesToImport];
    const casesWithTouchedTimestamps = this.touchCaseTimestamps(combinedCases, touchedCaseIds);

    // Modify data (append new cases)
    const updatedData: FileData = {
      ...currentData,
      cases: casesWithTouchedTimestamps,
    };

    // Write back to file
    await this.writeFileData(updatedData);
  }

  /**
   * Clear all data
   * Pattern: write empty structure
   */
  async clearAllData(): Promise<void> {
    let categoryConfig = mergeCategoryConfig();
    try {
      const currentData = await this.readFileData();
      if (currentData) {
        categoryConfig = mergeCategoryConfig(currentData.categoryConfig);
      }
    } catch (error) {
      logger.warn('Failed to read existing data before clearing; falling back to default category config', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const emptyData: FileData = {
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig,
      activityLog: [],
    };

    await this.writeFileData(emptyData);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if file service is available and connected
   */
  isConnected(): boolean {
    return this.fileService.getStatus().permissionStatus === 'granted';
  }

  /**
   * Get file service status
   */
  getStatus() {
    return this.fileService.getStatus();
  }
}

export default DataManager;