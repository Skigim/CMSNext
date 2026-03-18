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
  isNormalizedFileDataV20,
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
    person: caseItem.person ? { ...caseItem.person } : caseItem.person,
    linkedPeople: caseItem.linkedPeople?.map((linked) => ({
      ref: { ...linked.ref },
      person: { ...linked.person },
    })),
    caseRecord: caseItem.caseRecord ? { ...caseItem.caseRecord } : caseItem.caseRecord,
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
  data: PersistedNormalizedFileDataV21,
): { counts: WorkspaceMigrationCounts; validationErrors: string[] } {
  const validationErrors: string[] = [];

  if (data.version !== "2.1") {
    validationErrors.push(`Expected version "2.1" but found "${String(data.version)}".`);
  }

  if (!Array.isArray(data.people)) {
    validationErrors.push("Root people[] registry is missing.");
  }

  const peopleById = new Set(
    data.people
      .filter((person) => typeof person?.id === "string" && person.id.length > 0)
      .map((person) => person.id),
  );

  data.cases.forEach((caseItem: PersistedCase, index) => {
    const caseLabel = caseItem.id || `case-index-${index}`;

    if (!Array.isArray(caseItem.people)) {
      validationErrors.push(`Case ${caseLabel} is missing people[].`);
      return;
    }

    if (caseItem.people.length === 0) {
      validationErrors.push(`Case ${caseLabel} has an empty people[] array.`);
    }

    caseItem.people.forEach((personRef, refIndex) => {
      if (!peopleById.has(personRef.personId)) {
        validationErrors.push(
          `Case ${caseLabel} people[${refIndex}] references missing personId "${personRef.personId}".`,
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

  try {
    hydrateNormalizedData(data);
  } catch (error) {
    validationErrors.push(
      `Canonical hydration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    counts: summarizePersistedCounts(data),
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
} {
  const archiveYear = parseArchiveYear(fileName);
  if (archiveYear === null) {
    return {
      data: null,
      sourceVersion: null,
      error: `Unsupported archive file name: ${fileName}`,
    };
  }

  if (isPersistedCaseArchiveDataV21(rawData)) {
    return {
      data: rawData,
      sourceVersion: rawData.version,
      error: null,
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
    };
  }

  if (isNormalizedFileDataV20(rawData)) {
    return {
      data: {
        ...migrateV20ToV21(rawData as NormalizedFileDataV20),
        archiveType: "cases",
        archiveYear,
        archivedAt: rawData.exported_at,
      },
      sourceVersion: rawData.version,
      error: null,
    };
  }

  if (isCaseArchiveData(rawData)) {
    return {
      data: buildPersistedArchiveDataV21(rawData),
      sourceVersion: rawData.version,
      error: null,
    };
  }

  return {
    data: null,
    sourceVersion: null,
    error: `Unsupported archive data format in ${fileName}.`,
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
