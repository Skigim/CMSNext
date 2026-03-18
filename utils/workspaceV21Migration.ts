import type { CaseArchiveData } from "@/types/archive";
import type { PersistedCase } from "@/types/case";
import { mergeCategoryConfig } from "@/types/categoryConfig";
import {
  dehydrateNormalizedData,
  hydrateNormalizedData,
  migrateV20ToV21,
  type NormalizedFileDataV20,
  type PersistedNormalizedFileDataV21,
} from "@/utils/storageV21Migration";
import { isCaseArchiveData, parseArchiveYear } from "@/types/archive";
import {
  isNormalizedFileData,
  type NormalizedFileData,
} from "@/utils/services/FileStorageService";

export const MAIN_WORKSPACE_FILE_NAME = "case-tracker-data.json";

export type WorkspaceMigrationDisposition =
  | "already-v2.1"
  | "migrated"
  | "failed"
  | "skipped";

export interface WorkspaceMigrationCounts {
  people: number;
  cases: number;
  financials: number;
  notes: number;
  alerts: number;
}

export interface WorkspaceMigrationFileReport {
  fileName: string;
  fileKind: "workspace" | "archive";
  disposition: WorkspaceMigrationDisposition;
  sourceVersion: string | null;
  counts: WorkspaceMigrationCounts;
  validationErrors: string[];
  message: string;
}

export interface WorkspaceMigrationReport {
  processedAt: string;
  files: WorkspaceMigrationFileReport[];
  summary: {
    migrated: number;
    alreadyV21: number;
    failed: number;
    skipped: number;
  };
}

export interface PersistedCaseArchiveDataV21 extends PersistedNormalizedFileDataV21 {
  archiveType: "cases";
  archiveYear: number;
  archivedAt: string;
}

function isMigratableV20Data(data: unknown): data is NormalizedFileDataV20 {
  return (
    data !== null &&
    typeof data === "object" &&
    (data as { version?: unknown }).version === "2.0" &&
    Array.isArray((data as { cases?: unknown }).cases) &&
    Array.isArray((data as { financials?: unknown }).financials) &&
    Array.isArray((data as { notes?: unknown }).notes) &&
    Array.isArray((data as { alerts?: unknown }).alerts)
  );
}

export function createEmptyMigrationCounts(): WorkspaceMigrationCounts {
  return {
    people: 0,
    cases: 0,
    financials: 0,
    notes: 0,
    alerts: 0,
  };
}

export function summarizePersistedCounts(
  data: Pick<
    PersistedNormalizedFileDataV21,
    "people" | "cases" | "financials" | "notes" | "alerts"
  >,
): WorkspaceMigrationCounts {
  return {
    people: data.people.length,
    cases: data.cases.length,
    financials: data.financials.length,
    notes: data.notes.length,
    alerts: data.alerts.length,
  };
}

export function summarizeUnknownCounts(data: unknown): WorkspaceMigrationCounts {
  if (!data || typeof data !== "object") {
    return createEmptyMigrationCounts();
  }

  const candidate = data as unknown as Record<string, unknown>;
  return {
    people: Array.isArray(candidate.people) ? candidate.people.length : 0,
    cases: Array.isArray(candidate.cases) ? candidate.cases.length : 0,
    financials: Array.isArray(candidate.financials) ? candidate.financials.length : 0,
    notes: Array.isArray(candidate.notes) ? candidate.notes.length : 0,
    alerts: Array.isArray(candidate.alerts) ? candidate.alerts.length : 0,
  };
}

export function isPersistedCaseArchiveDataV21(data: unknown): data is PersistedCaseArchiveDataV21 {
  if (!isNormalizedFileData(data)) {
    return false;
  }

  const candidate = data as unknown as Record<string, unknown>;
  return (
    candidate.archiveType === "cases" &&
    typeof candidate.archivedAt === "string" &&
    typeof candidate.archiveYear === "number"
  );
}

function cloneArchiveCases(cases: CaseArchiveData["cases"]): CaseArchiveData["cases"] {
  return cases.map((caseItem) => ({
    ...caseItem,
    people: caseItem.people?.map((ref) => ({ ...ref })),
    person: { ...caseItem.person },
    linkedPeople: caseItem.linkedPeople?.map((linked) => ({
      ref: { ...linked.ref },
      person: { ...linked.person },
    })),
    caseRecord: { ...caseItem.caseRecord },
  }));
}

export function buildPersistedArchiveDataV21(archiveData: CaseArchiveData): PersistedCaseArchiveDataV21 {
  const runtimeNormalizedData: NormalizedFileData = {
    version: "2.1",
    people: [],
    cases: cloneArchiveCases(archiveData.cases),
    financials: archiveData.financials.map((financial) => ({ ...financial })),
    notes: archiveData.notes.map((note) => ({ ...note })),
    alerts: [],
    exported_at: archiveData.archivedAt,
    total_cases: archiveData.cases.length,
    categoryConfig: mergeCategoryConfig(),
    activityLog: [],
  };

  const persistedData = dehydrateNormalizedData(runtimeNormalizedData);

  return {
    ...persistedData,
    archiveType: "cases",
    archiveYear: archiveData.archiveYear,
    archivedAt: archiveData.archivedAt,
  };
}

export function hydratePersistedArchiveDataV21(data: PersistedCaseArchiveDataV21): CaseArchiveData {
  const hydratedData = hydrateNormalizedData(data);

  return {
    version: "1.0",
    archiveType: "cases",
    archivedAt: data.archivedAt,
    archiveYear: data.archiveYear,
    cases: hydratedData.cases,
    financials: hydratedData.financials,
    notes: hydratedData.notes,
  };
}

export function validatePersistedV21Data(
  data: unknown,
): { counts: WorkspaceMigrationCounts; validationErrors: string[] } {
  const validationErrors: string[] = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return {
      counts: createEmptyMigrationCounts(),
      validationErrors: ['Expected a persisted v2.1 object but found a non-object value.'],
    };
  }

  const counts = summarizeUnknownCounts(data);
  const candidate = data as Record<string, unknown>;

  if (candidate.version !== "2.1") {
    validationErrors.push(`Expected version "2.1" but found "${String(candidate.version)}".`);
  }

  if (!Array.isArray(candidate.people)) {
    validationErrors.push("Root people[] registry is missing.");
  }

  if (!Array.isArray(candidate.cases)) {
    validationErrors.push("Root cases[] collection is missing.");
  }

  if (!Array.isArray(candidate.financials)) {
    validationErrors.push("Root financials[] collection is missing.");
  }

  if (!Array.isArray(candidate.notes)) {
    validationErrors.push("Root notes[] collection is missing.");
  }

  if (!Array.isArray(candidate.alerts)) {
    validationErrors.push("Root alerts[] collection is missing.");
  }

  if (typeof candidate.exported_at !== "string") {
    validationErrors.push("Root exported_at timestamp is missing.");
  }

  if (typeof candidate.total_cases !== "number") {
    validationErrors.push("Root total_cases count is missing.");
  }

  if (!candidate.categoryConfig || typeof candidate.categoryConfig !== "object") {
    validationErrors.push("Root categoryConfig object is missing.");
  }

  if (!Array.isArray(candidate.activityLog)) {
    validationErrors.push("Root activityLog[] collection is missing.");
  }

  const people = Array.isArray(candidate.people) ? candidate.people : [];
  const cases = Array.isArray(candidate.cases) ? candidate.cases : [];

  const peopleById = new Set<string>();
  people.forEach((person, index) => {
    if (!person || typeof person !== "object") {
      validationErrors.push(`people[${index}] is not a valid person object.`);
      return;
    }

    const personId = (person as { id?: unknown }).id;
    if (typeof personId !== "string" || personId.length === 0) {
      validationErrors.push(`people[${index}] is missing id.`);
      return;
    }

    peopleById.add(personId);
  });

  cases.forEach((caseValue, index) => {
    if (!caseValue || typeof caseValue !== "object") {
      validationErrors.push(`cases[${index}] is not a valid case object.`);
      return;
    }

    const caseItem = caseValue as PersistedCase;
    const caseLabel = caseItem.id || `case-index-${index}`;

    if (!Array.isArray(caseItem.people)) {
      validationErrors.push(`Case ${caseLabel} is missing people[].`);
      return;
    }

    if (caseItem.people.length === 0) {
      validationErrors.push(`Case ${caseLabel} has an empty people[] array.`);
    }

    caseItem.people.forEach((personRef, refIndex) => {
      if (
        !personRef ||
        typeof personRef !== "object" ||
        typeof (personRef as { personId?: unknown }).personId !== "string" ||
        ((personRef as { personId: string }).personId as string).length === 0
      ) {
        validationErrors.push(
          `Case ${caseLabel} people[${refIndex}] is not a valid person reference (missing or invalid personId).`,
        );
        return;
      }

      const personId = (personRef as { personId: string }).personId;
      if (!peopleById.has(personId)) {
        validationErrors.push(
          `Case ${caseLabel} people[${refIndex}] references missing personId "${personId}".`,
        );
      }
    });

    const caseRecordPersonId = caseItem.caseRecord?.personId;
    if (typeof caseRecordPersonId !== "string" || caseRecordPersonId.length === 0) {
      validationErrors.push(`Case ${caseLabel} is missing caseRecord.personId.`);
    } else if (!peopleById.has(caseRecordPersonId)) {
      validationErrors.push(
        `Case ${caseLabel} caseRecord.personId "${caseRecordPersonId}" does not resolve to a person record.`,
      );
    }
  });

  if (validationErrors.length === 0) {
    try {
      // At this point the required root collections/metadata exist and every
      // case/person link has passed explicit integrity checks, so hydration is
      // safe to use as the final canonical validation step.
      hydrateNormalizedData(data as PersistedNormalizedFileDataV21);
    } catch (error) {
      validationErrors.push(
        `Canonical hydration failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    counts,
    validationErrors,
  };
}

export function migrateArchiveDataToPersistedV21(
  rawData: unknown,
  fileName: string,
): {
  data: PersistedCaseArchiveDataV21 | null;
  sourceVersion: string | null;
  error: string | null;
  needsWrite: boolean;
} {
  const archiveYear = parseArchiveYear(fileName);
  if (archiveYear === null) {
    return {
      data: null,
      sourceVersion: null,
      error: `Unsupported archive file name: ${fileName}`,
      needsWrite: false,
    };
  }

  if (isPersistedCaseArchiveDataV21(rawData)) {
    return {
      data: rawData,
      sourceVersion: rawData.version,
      error: null,
      needsWrite: false,
    };
  }

  if (isNormalizedFileData(rawData)) {
    return {
      data: {
        ...rawData,
        archiveType: "cases",
        archiveYear,
        archivedAt: rawData.exported_at,
      },
      sourceVersion: rawData.version,
      error: null,
      needsWrite: true,
    };
  }

  if (isMigratableV20Data(rawData)) {
    return {
      data: {
        ...migrateV20ToV21(rawData),
        archiveType: "cases",
        archiveYear,
        archivedAt: rawData.exported_at,
      },
      sourceVersion: rawData.version,
      error: null,
      needsWrite: true,
    };
  }

  if (isCaseArchiveData(rawData)) {
    return {
      data: buildPersistedArchiveDataV21(rawData),
      sourceVersion: rawData.version,
      error: null,
      needsWrite: true,
    };
  }

  return {
    data: null,
    sourceVersion: null,
    error: `Unsupported archive data format in ${fileName}.`,
    needsWrite: false,
  };
}

export function buildWorkspaceMigrationReport(
  files: WorkspaceMigrationFileReport[],
): WorkspaceMigrationReport {
  return {
    processedAt: new Date().toISOString(),
    files,
    summary: {
      migrated: files.filter((file) => file.disposition === "migrated").length,
      alreadyV21: files.filter((file) => file.disposition === "already-v2.1").length,
      failed: files.filter((file) => file.disposition === "failed").length,
      skipped: files.filter((file) => file.disposition === "skipped").length,
    },
  };
}
