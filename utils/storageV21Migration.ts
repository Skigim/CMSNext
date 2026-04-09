import { v4 as uuidv4 } from "uuid";

import type {
  AlertRecord,
  CaseRecord,
  CasePersonRef,
  PersistedCase,
  PersistedCaseRecord,
  Person,
  PersonRelationship,
  Relationship,
  StoredCase,
  StoredFinancialItem,
  StoredNote,
  StoredPerson,
} from "@/types/case";
import type { Application } from "@/types/application";
import {
  createMigratedApplication,
  normalizeRetroRequestedAt,
  pickApplicationOwnedCaseRecordFields,
  selectOldestNonTerminalApplication,
} from "@/domain/applications";
import type { CaseActivityEntry } from "@/types/activityLog";
import {
  getCompletionStatusNames,
  type CategoryConfig,
} from "@/types/categoryConfig";
import type { Template } from "@/types/template";
import { resolveCaseRecordIntakeCompleted } from "@/domain/cases";
import { splitFamilyMembers } from "@/utils/personNormalization";

export interface NormalizedFileDataV20 {
  version: "2.0";
  cases: StoredCase[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}

export interface PersistedNormalizedFileDataV21 {
  version: "2.1";
  people: StoredPerson[];
  cases: PersistedCase[];
  applications?: Application[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}

export interface RuntimeNormalizedFileDataV21 {
  version: "2.1";
  people: Person[];
  cases: StoredCase[];
  applications?: Application[];
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}

function cloneApplicationStatusHistory(
  statusHistory: Application["statusHistory"],
): Application["statusHistory"] {
  return statusHistory.map((entry) => ({ ...entry }));
}

export function normalizePersistedApplication(application: Application): Application {
  return {
    ...application,
    statusHistory: cloneApplicationStatusHistory(application.statusHistory),
    retroMonths: [...application.retroMonths],
    verification: {
      isAppValidated: application.verification.isAppValidated,
      isAgedDisabledVerified: application.verification.isAgedDisabledVerified,
      isCitizenshipVerified: application.verification.isCitizenshipVerified,
      isResidencyVerified: application.verification.isResidencyVerified,
      avsConsentDate: application.verification.avsConsentDate,
      voterFormStatus: application.verification.voterFormStatus,
      isIntakeCompleted: application.verification.isIntakeCompleted,
    },
  };
}

type NormalizedDataShapeCandidate = {
  version?: unknown;
  people?: unknown;
  cases?: unknown;
  applications?: unknown;
  financials?: unknown;
  notes?: unknown;
  alerts?: unknown;
  exported_at?: unknown;
  total_cases?: unknown;
  categoryConfig?: unknown;
  activityLog?: unknown;
  templates?: unknown;
};

function toNormalizedDataShapeCandidate(data: unknown): NormalizedDataShapeCandidate | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as NormalizedDataShapeCandidate;
}

function hasOptionalTemplatesArray(candidate: NormalizedDataShapeCandidate): boolean {
  return candidate.templates === undefined || Array.isArray(candidate.templates);
}

function hasOptionalApplicationsArray(candidate: NormalizedDataShapeCandidate): boolean {
  return candidate.applications === undefined || Array.isArray(candidate.applications);
}

function hasNormalizedCollectionsAndMetadata(candidate: NormalizedDataShapeCandidate): boolean {
  return (
    Array.isArray(candidate.cases) &&
    hasOptionalApplicationsArray(candidate) &&
    Array.isArray(candidate.financials) &&
    Array.isArray(candidate.notes) &&
    Array.isArray(candidate.alerts) &&
    typeof candidate.exported_at === "string" &&
    typeof candidate.total_cases === "number" &&
    candidate.categoryConfig !== null &&
    typeof candidate.categoryConfig === "object" &&
    Array.isArray(candidate.activityLog) &&
    hasOptionalTemplatesArray(candidate)
  );
}

/**
 * Type guard for persisted normalized v2.0 workspace/archive payloads.
 *
 * This is used only by explicit migration codepaths that still need to
 * recognize legacy-but-migratable persisted files after the normal runtime
 * read path became strict v2.1-only.
 *
 * @param data - Raw persisted data to inspect
 */
export function isPersistedNormalizedFileDataV20(data: unknown): data is NormalizedFileDataV20 {
  const candidate = toNormalizedDataShapeCandidate(data);

  return candidate?.version === "2.0" && hasNormalizedCollectionsAndMetadata(candidate);
}

/**
 * Type guard for canonical persisted normalized v2.1 workspace/archive payloads.
 *
 * This is shared by runtime readers and migration tooling so that the persisted
 * v2.1 envelope is validated consistently in one place.
 *
 * @param data - Raw persisted data to inspect
 */
export function isPersistedNormalizedFileDataV21(data: unknown): data is PersistedNormalizedFileDataV21 {
  const candidate = toNormalizedDataShapeCandidate(data);

  return (
    candidate?.version === "2.1" &&
    Array.isArray(candidate.people) &&
    hasNormalizedCollectionsAndMetadata(candidate)
  );
}

function normalizeName(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

function buildCasePeopleRefs(
  caseItem: Pick<StoredCase, "id" | "people">,
): CasePersonRef[] {
  // Canonical persisted v2.1 data must already carry explicit people[] refs on
  // every runtime case. This helper now enforces that invariant instead of
  // reconstructing refs from other hydrated fields.
  const existingPeople = caseItem.people?.filter((ref) => Boolean(ref.personId)) ?? [];
  if (existingPeople.length === 0) {
    throw new Error(`Case ${caseItem.id} cannot be dehydrated without canonical people[] refs`);
  }

  const primaryPeople = existingPeople.filter((ref) => ref.isPrimary);
  if (primaryPeople.length !== 1) {
    throw new Error(`Case ${caseItem.id} must have exactly one primary person ref`);
  }

  return existingPeople.map((ref) => ({
    ...ref,
    role: ref.role ?? "applicant",
    isPrimary: ref.isPrimary,
  }));
}

function resolvePersonTimestamps(person: Pick<Person, "createdAt" | "updatedAt" | "dateAdded">): {
  createdAt: string;
  updatedAt: string;
} {
  const createdAt = person.createdAt || person.updatedAt || person.dateAdded || new Date().toISOString();
  return {
    createdAt,
    updatedAt: person.updatedAt || createdAt,
  };
}

function projectNormalizedRelationshipToLegacy(
  relationship: PersonRelationship,
  peopleById: Map<string, Person>,
): Relationship {
  const targetPerson =
    relationship.targetPersonId ? peopleById.get(relationship.targetPersonId) : undefined;

  return {
    id: relationship.id,
    type: relationship.type,
    name: relationship.displayNameFallback ?? targetPerson?.name ?? "",
    phone: relationship.legacyPhone ?? targetPerson?.phone ?? "",
  };
}

function relationshipListMatches(
  legacyRelationships: Relationship[],
  normalizedRelationships: PersonRelationship[],
  peopleById: Map<string, Person>,
): boolean {
  if (legacyRelationships.length !== normalizedRelationships.length) {
    return false;
  }

  return normalizedRelationships.every((relationship, index) => {
    const projected = projectNormalizedRelationshipToLegacy(relationship, peopleById);
    const candidate = legacyRelationships[index];

    return (
      candidate?.id === projected.id &&
      candidate?.type === projected.type &&
      candidate?.name === projected.name &&
      candidate?.phone === projected.phone
    );
  });
}

function buildStoredRelationships(
  person: Person,
  peopleById: Map<string, Person>,
): PersonRelationship[] {
  const legacyRelationships = Array.isArray(person.relationships) ? person.relationships : [];
  const normalizedRelationships = Array.isArray(person.normalizedRelationships)
    ? person.normalizedRelationships
    : [];

  if (
    normalizedRelationships.length > 0 &&
    relationshipListMatches(legacyRelationships, normalizedRelationships, peopleById)
  ) {
    return normalizedRelationships.map((relationship) => ({ ...relationship }));
  }

  const peopleByName = new Map<string, Person[]>();
  for (const candidate of peopleById.values()) {
    const normalized = normalizeName(candidate.name);
    if (!normalized) {
      continue;
    }

    const existing = peopleByName.get(normalized) ?? [];
    existing.push(candidate);
    peopleByName.set(normalized, existing);
  }

  return legacyRelationships.map((relationship) => {
    const matches = peopleByName.get(normalizeName(relationship.name)) ?? [];
    const targetPersonId = matches.length === 1 ? matches[0].id : null;

    return {
      id: relationship.id ?? uuidv4(),
      type: relationship.type,
      targetPersonId,
      displayNameFallback: targetPersonId ? undefined : relationship.name || undefined,
      legacyPhone: relationship.phone || undefined,
    };
  });
}

export function toStoredPerson(person: Person, allPeople: Person[]): StoredPerson {
  const peopleById = new Map(allPeople.map((candidate) => [candidate.id, candidate] as const));
  const splitMembers = splitFamilyMembers(person.familyMembers);
  const familyMemberIds = Array.from(
    new Set([...(person.familyMemberIds ?? []), ...splitMembers.familyMemberIds]),
  );
  const legacyFamilyMemberNames = Array.from(
    new Set([...(person.legacyFamilyMemberNames ?? []), ...splitMembers.legacyFamilyMemberNames]),
  );
  const { createdAt, updatedAt } = resolvePersonTimestamps(person);

  return {
    id: person.id || uuidv4(),
    firstName: person.firstName,
    lastName: person.lastName,
    name: person.name || `${person.firstName} ${person.lastName}`.trim(),
    email: person.email,
    phone: person.phone,
    dateOfBirth: person.dateOfBirth,
    ssn: person.ssn,
    organizationId: person.organizationId,
    livingArrangement: person.livingArrangement,
    address: {
      street: person.address?.street ?? "",
      apt: person.address?.apt,
      city: person.address?.city ?? "",
      state: person.address?.state ?? "",
      zip: person.address?.zip ?? "",
    },
    mailingAddress: {
      street: person.mailingAddress?.street ?? "",
      apt: person.mailingAddress?.apt,
      city: person.mailingAddress?.city ?? "",
      state: person.mailingAddress?.state ?? "",
      zip: person.mailingAddress?.zip ?? "",
      sameAsPhysical: person.mailingAddress?.sameAsPhysical ?? true,
    },
    authorizedRepIds: person.authorizedRepIds ?? [],
    familyMemberIds,
    legacyFamilyMemberNames: legacyFamilyMemberNames.length > 0 ? legacyFamilyMemberNames : undefined,
    relationships: buildStoredRelationships(person, peopleById),
    createdAt,
    updatedAt,
    dateAdded: person.dateAdded || createdAt,
  };
}

export function toRuntimePerson(person: StoredPerson, allPeople: StoredPerson[]): Person {
  const peopleById = new Map(allPeople.map((candidate) => [candidate.id, candidate] as const));
  const relationships = person.relationships.map((relationship) => {
    const targetPerson =
      relationship.targetPersonId ? peopleById.get(relationship.targetPersonId) : undefined;

    return {
      id: relationship.id,
      type: relationship.type,
      name: relationship.displayNameFallback ?? targetPerson?.name ?? "",
      phone: relationship.legacyPhone ?? targetPerson?.phone ?? "",
    };
  });

  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    name: person.name,
    email: person.email,
    phone: person.phone,
    dateOfBirth: person.dateOfBirth,
    ssn: person.ssn,
    organizationId: person.organizationId,
    livingArrangement: person.livingArrangement,
    address: { ...person.address },
    mailingAddress: { ...person.mailingAddress },
    authorizedRepIds: [...(person.authorizedRepIds ?? [])],
    familyMembers: [...(person.familyMemberIds ?? []), ...(person.legacyFamilyMemberNames ?? [])],
    familyMemberIds: [...(person.familyMemberIds ?? [])],
    legacyFamilyMemberNames: person.legacyFamilyMemberNames
      ? [...person.legacyFamilyMemberNames]
      : undefined,
    relationships,
    normalizedRelationships: person.relationships.map((relationship) => ({ ...relationship })),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    dateAdded: person.dateAdded,
  };
}

function resolvePrimaryPersonRef(
  caseItem: PersistedCase,
): CasePersonRef {
  if (caseItem.people.length === 0) {
    throw new Error(`Case ${caseItem.id} has no linked people`);
  }

  const primaryPeople = caseItem.people.filter((ref) => ref.isPrimary);
  if (primaryPeople.length !== 1) {
    throw new Error(`Case ${caseItem.id} must have exactly one primary person ref`);
  }

  return primaryPeople[0];
}

/**
 * Returns a deep clone of an application record to ensure runtime mutations
 * do not bleed back into the storage layer or other shared references.
 */
function cloneApplication(application: Application): Application {
  return globalThis.structuredClone(application);
}

function getPrimaryApplicationForCase(
  applications: Application[] | undefined,
  caseId: string,
  completionStatuses: Set<string>,
  fallbackToDeterministicCanonical = false,
): Application | null {
  const caseApplications =
    applications?.filter((application) => application.caseId === caseId) ?? [];

  const primaryApplication = selectOldestNonTerminalApplication(
    caseApplications,
    completionStatuses,
  );

  if (primaryApplication) {
    return primaryApplication;
  }

  return fallbackToDeterministicCanonical
    ? selectDeterministicCanonicalApplication(caseApplications)
    : null;
}

function toComparableTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareApplicationCanonicalOrder(left: Application, right: Application): number {
  const leftApplicationDate = toComparableTimestamp(left.applicationDate);
  const rightApplicationDate = toComparableTimestamp(right.applicationDate);

  if (leftApplicationDate !== null && rightApplicationDate !== null && leftApplicationDate !== rightApplicationDate) {
    return leftApplicationDate - rightApplicationDate;
  }

  if (leftApplicationDate !== null && rightApplicationDate === null) {
    return -1;
  }

  if (leftApplicationDate === null && rightApplicationDate !== null) {
    return 1;
  }

  const leftCreatedAt = toComparableTimestamp(left.createdAt);
  const rightCreatedAt = toComparableTimestamp(right.createdAt);

  if (leftCreatedAt !== null && rightCreatedAt !== null && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  if (leftCreatedAt !== null && rightCreatedAt === null) {
    return -1;
  }

  if (leftCreatedAt === null && rightCreatedAt !== null) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

export function selectDeterministicCanonicalApplication(
  applications: Application[],
): Application | null {
  if (applications.length === 0) {
    return null;
  }

  return [...applications].sort(compareApplicationCanonicalOrder)[0];
}

function buildRuntimeApplicationCaseFields(
  caseItem: PersistedCase,
  application: Application | null,
): Pick<StoredCase["caseRecord"],
  | "applicationDate"
  | "applicationType"
  | "withWaiver"
  | "retroRequested"
  | "appValidated"
  | "retroMonths"
  | "agedDisabledVerified"
  | "citizenshipVerified"
  | "residencyVerified"
  | "avsConsentDate"
  | "voterFormStatus"
  | "intakeCompleted"
  | "status"
> {
  const legacyCaseRecord = caseItem.caseRecord as Partial<StoredCase["caseRecord"]>;

  if (!application) {
    return {
      applicationDate: legacyCaseRecord.applicationDate ?? "",
      applicationType: legacyCaseRecord.applicationType ?? "",
      withWaiver: legacyCaseRecord.withWaiver ?? false,
      retroRequested: legacyCaseRecord.retroRequested ?? "",
      appValidated: legacyCaseRecord.appValidated ?? false,
      retroMonths: [...(legacyCaseRecord.retroMonths ?? [])],
      agedDisabledVerified: legacyCaseRecord.agedDisabledVerified ?? false,
      citizenshipVerified: legacyCaseRecord.citizenshipVerified ?? false,
      residencyVerified: legacyCaseRecord.residencyVerified ?? false,
      avsConsentDate: legacyCaseRecord.avsConsentDate ?? "",
      voterFormStatus: legacyCaseRecord.voterFormStatus ?? "",
      intakeCompleted: resolveCaseRecordIntakeCompleted(legacyCaseRecord.intakeCompleted),
      status: legacyCaseRecord.status ?? caseItem.status,
    };
  }

  return {
    applicationDate: application.applicationDate,
    applicationType: application.applicationType,
    withWaiver: application.hasWaiver,
    retroRequested: application.retroRequestedAt ?? "",
    appValidated: application.verification.isAppValidated,
    retroMonths: [...application.retroMonths],
    agedDisabledVerified: application.verification.isAgedDisabledVerified,
    citizenshipVerified: application.verification.isCitizenshipVerified,
    residencyVerified: application.verification.isResidencyVerified,
    avsConsentDate: application.verification.avsConsentDate,
    voterFormStatus: application.verification.voterFormStatus,
    intakeCompleted: resolveCaseRecordIntakeCompleted(
      application.verification.isIntakeCompleted,
    ),
    status: application.status as StoredCase["caseRecord"]["status"],
  };
}

function buildPersistedCaseRecord(
  caseRecord: StoredCase["caseRecord"],
): PersistedCaseRecord {
  return {
    id: caseRecord.id,
    mcn: caseRecord.mcn,
    caseType: caseRecord.caseType,
    personId: caseRecord.personId,
    spouseId: caseRecord.spouseId,
    status: caseRecord.status,
    description: caseRecord.description,
    priority: caseRecord.priority,
    livingArrangement: caseRecord.livingArrangement,
    admissionDate: caseRecord.admissionDate,
    organizationId: caseRecord.organizationId,
    authorizedReps: [...caseRecord.authorizedReps],
    createdDate: caseRecord.createdDate,
    updatedDate: caseRecord.updatedDate,
    contactMethods: caseRecord.contactMethods ? [...caseRecord.contactMethods] : undefined,
    avsSubmitted: caseRecord.avsSubmitted,
    avsSubmitDate: caseRecord.avsSubmitDate,
    interfacesReviewed: caseRecord.interfacesReviewed,
    reviewVRs: caseRecord.reviewVRs,
    reviewPriorBudgets: caseRecord.reviewPriorBudgets,
    reviewPriorNarr: caseRecord.reviewPriorNarr,
    pregnancy: caseRecord.pregnancy,
    maritalStatus: caseRecord.maritalStatus,
  };
}

function resolveApplicationApplicantPersonId(caseItem: StoredCase): string {
  const primaryRef = caseItem.people?.find((ref) => ref.isPrimary);
  return primaryRef?.personId ?? caseItem.caseRecord.personId;
}

function createApplicationSourceCase(caseItem: StoredCase): CaseRecord {
  const normalizedCaseRecord: CaseRecord = {
    ...caseItem.caseRecord,
    financials: {
      resources: [],
      income: [],
      expenses: [],
    },
    notes: [],
    intakeCompleted: resolveCaseRecordIntakeCompleted(caseItem.caseRecord.intakeCompleted),
  };

  if (normalizedCaseRecord.id === caseItem.id) {
    return normalizedCaseRecord;
  }

  return {
    ...normalizedCaseRecord,
    id: caseItem.id,
  };
}

type RuntimeApplicationSyncMode = "full" | "status-only";

interface SyncRuntimeApplicationsOptions {
  preferRuntimeCaseFields?: boolean;
  syncMode?: RuntimeApplicationSyncMode;
  transactionTimestamp?: string;
}

function resolveSyncRuntimeApplicationsOptions(
  optionsOrPreferRuntimeCaseFields: boolean | SyncRuntimeApplicationsOptions | undefined,
): {
  preferRuntimeCaseFields: boolean;
  syncMode: RuntimeApplicationSyncMode;
  transactionTimestamp: string;
} {
  if (typeof optionsOrPreferRuntimeCaseFields === "boolean") {
    return {
      preferRuntimeCaseFields: optionsOrPreferRuntimeCaseFields,
      syncMode: "full",
      transactionTimestamp: new Date().toISOString(),
    };
  }

  return {
    preferRuntimeCaseFields: optionsOrPreferRuntimeCaseFields?.preferRuntimeCaseFields ?? false,
    syncMode: optionsOrPreferRuntimeCaseFields?.syncMode ?? "full",
    transactionTimestamp:
      optionsOrPreferRuntimeCaseFields?.transactionTimestamp ?? new Date().toISOString(),
  };
}

function buildUpdatedStatusHistory(
  application: Application,
  nextStatus: Application["status"],
  timestamp: string,
): Application["statusHistory"] {
  if (application.status === nextStatus) {
    return cloneApplicationStatusHistory(application.statusHistory);
  }

  return [
    ...cloneApplicationStatusHistory(application.statusHistory),
    {
      id: uuidv4(),
      status: nextStatus,
      effectiveDate: timestamp.slice(0, 10),
      changedAt: timestamp,
      source: "user",
    },
  ];
}

function syncApplicationWithCase(
  caseItem: StoredCase,
  existingApplication: Application | null,
  timestamp: string,
  syncMode: RuntimeApplicationSyncMode = "full",
): { application: Application; hasChanged: boolean } {
  const sourceCaseRecord = createApplicationSourceCase(caseItem);
  const nextStatus = sourceCaseRecord.status as Application["status"];

  if (!existingApplication) {
    return {
      application: createMigratedApplication({
        applicationId: uuidv4(),
        initialHistoryId: uuidv4(),
        caseId: caseItem.id,
        applicantPersonId: resolveApplicationApplicantPersonId(caseItem),
        migratedAt: timestamp,
        caseRecord: sourceCaseRecord,
      }),
      hasChanged: true,
    };
  }

  const statusHistory = buildUpdatedStatusHistory(
    existingApplication,
    nextStatus,
    timestamp,
  );

  if (syncMode === "status-only") {
    const hasChanged =
      nextStatus !== existingApplication.status ||
      globalThis.JSON.stringify(statusHistory) !==
        globalThis.JSON.stringify(existingApplication.statusHistory);

    return {
      application: hasChanged
        ? {
            ...existingApplication,
            status: nextStatus,
            statusHistory,
            updatedAt: timestamp,
          }
        : cloneApplication(existingApplication),
      hasChanged,
    };
  }

  const migratedFields = pickApplicationOwnedCaseRecordFields(sourceCaseRecord);
  const candidate: Application = {
    ...existingApplication,
    applicantPersonId: existingApplication.applicantPersonId,
    applicationDate: migratedFields.applicationDate,
    applicationType: migratedFields.applicationType,
    status: nextStatus,
    statusHistory,
    hasWaiver: migratedFields.hasWaiver,
    retroRequestedAt: normalizeRetroRequestedAt(migratedFields.retroRequested),
    retroMonths: [...migratedFields.retroMonths],
    verification: {
      isAppValidated: migratedFields.appValidated,
      isAgedDisabledVerified: migratedFields.agedDisabledVerified,
      isCitizenshipVerified: migratedFields.citizenshipVerified,
      isResidencyVerified: migratedFields.residencyVerified,
      avsConsentDate: migratedFields.avsConsentDate,
      voterFormStatus: migratedFields.voterFormStatus,
      isIntakeCompleted: migratedFields.intakeCompleted,
    },
  };

  const hasChanged =
    candidate.applicationDate !== existingApplication.applicationDate ||
    candidate.applicationType !== existingApplication.applicationType ||
    candidate.status !== existingApplication.status ||
    candidate.hasWaiver !== existingApplication.hasWaiver ||
    candidate.retroRequestedAt !== existingApplication.retroRequestedAt ||
    globalThis.JSON.stringify(candidate.retroMonths) !==
      globalThis.JSON.stringify(existingApplication.retroMonths) ||
    globalThis.JSON.stringify(candidate.statusHistory) !==
      globalThis.JSON.stringify(existingApplication.statusHistory) ||
    globalThis.JSON.stringify(candidate.verification) !==
      globalThis.JSON.stringify(existingApplication.verification);

  return {
    application: hasChanged
      ? {
          ...candidate,
          updatedAt: timestamp,
        }
      : cloneApplication(existingApplication),
    hasChanged,
  };
}

function selectTargetApplicationForSync(
  existingForCase: Application[],
  caseId: string,
  completionStatuses: Set<string>,
  preferRuntimeCaseFields: boolean,
): Application | null {
  const primaryApplication = getPrimaryApplicationForCase(
    existingForCase,
    caseId,
    completionStatuses,
  );

  return (
    primaryApplication ??
    (preferRuntimeCaseFields
      ? selectDeterministicCanonicalApplication(existingForCase)
      : null)
  );
}

function shouldSkipApplicationSync(
  existingForCase: Application[],
  targetApplication: Application | null,
  preferRuntimeCaseFields: boolean,
): boolean {
  if (existingForCase.length > 0 && targetApplication === null) {
    return true;
  }

  return Boolean(targetApplication && !preferRuntimeCaseFields);
}

export function syncRuntimeApplications(
  data: RuntimeNormalizedFileDataV21,
  optionsOrPreferRuntimeCaseFields: boolean | SyncRuntimeApplicationsOptions = false,
): { applications: Application[]; hasChanged: boolean } {
  const {
    preferRuntimeCaseFields,
    syncMode,
    transactionTimestamp,
  } = resolveSyncRuntimeApplicationsOptions(optionsOrPreferRuntimeCaseFields);
  const existingApplications = data.applications?.map(normalizePersistedApplication) ?? [];
  const completionStatuses = getCompletionStatusNames(data.categoryConfig);
  const applicationsByCaseId = new Map<string, Application[]>();

  for (const application of existingApplications) {
    const caseApplications = applicationsByCaseId.get(application.caseId) ?? [];
    caseApplications.push(application);
    applicationsByCaseId.set(application.caseId, caseApplications);
  }

  const timestamp = transactionTimestamp;
  let hasChanged = false;
  const syncedApplications = [...existingApplications];

  for (const caseItem of data.cases) {
    const existingForCase = applicationsByCaseId.get(caseItem.id) ?? [];
    const targetApplication = selectTargetApplicationForSync(
      existingForCase,
      caseItem.id,
      completionStatuses,
      preferRuntimeCaseFields,
    );

    if (shouldSkipApplicationSync(existingForCase, targetApplication, preferRuntimeCaseFields)) {
      continue;
    }

    const { application, hasChanged: applicationChanged } = syncApplicationWithCase(
      caseItem,
      targetApplication,
      timestamp,
      syncMode,
    );

    if (!targetApplication) {
      syncedApplications.push(application);
      applicationsByCaseId.set(caseItem.id, [...existingForCase, application]);
      hasChanged = true;
      continue;
    }

    if (!applicationChanged) {
      continue;
    }

    const index = syncedApplications.findIndex(
      (candidate) => candidate.id === targetApplication.id,
    );
    if (index !== -1) {
      syncedApplications[index] = application;
      hasChanged = true;
    }
  }

  return {
    applications: syncedApplications,
    hasChanged,
  };
}

export function persistedCasesContainLegacyApplicationFields(
  cases: PersistedCase[],
): boolean {
  return cases.some((caseItem) => {
    const legacyCaseRecord = caseItem.caseRecord as Record<string, unknown>;
    return (
      "applicationDate" in legacyCaseRecord ||
      "applicationType" in legacyCaseRecord ||
      "withWaiver" in legacyCaseRecord ||
      "retroRequested" in legacyCaseRecord ||
      "intakeCompleted" in legacyCaseRecord
    );
  });
}

export function hydrateStoredCase(
  caseItem: PersistedCase,
  people: Person[],
  application: Application | null = null,
): StoredCase {
  const peopleById = new Map(people.map((person) => [person.id, person] as const));
  const primaryRef = resolvePrimaryPersonRef(caseItem);

  const linkedPeople = caseItem.people.map((ref) => {
    const person = peopleById.get(ref.personId);
    if (!person) {
      throw new Error(`Person ${ref.personId} not found for case ${caseItem.id}`);
    }

    return { ref, person };
  });

  const primaryPerson = peopleById.get(primaryRef.personId);
  if (!primaryPerson) {
    throw new Error(`Primary person ${primaryRef.personId} not found for case ${caseItem.id}`);
  }

  const runtimeApplicationFields = buildRuntimeApplicationCaseFields(caseItem, application);

  return {
    ...caseItem,
    status: runtimeApplicationFields.status,
    caseRecord: {
      ...caseItem.caseRecord,
      ...runtimeApplicationFields,
      avsSubmitted:
        (caseItem.caseRecord as Partial<StoredCase["caseRecord"]>).avsSubmitted ?? false,
      avsSubmitDate:
        (caseItem.caseRecord as Partial<StoredCase["caseRecord"]>).avsSubmitDate ?? "",
      interfacesReviewed:
        (caseItem.caseRecord as Partial<StoredCase["caseRecord"]>).interfacesReviewed ?? false,
      reviewVRs:
        (caseItem.caseRecord as Partial<StoredCase["caseRecord"]>).reviewVRs ?? false,
      reviewPriorBudgets:
        (caseItem.caseRecord as Partial<StoredCase["caseRecord"]>).reviewPriorBudgets ?? false,
      reviewPriorNarr:
        (caseItem.caseRecord as Partial<StoredCase["caseRecord"]>).reviewPriorNarr ?? false,
    },
    people: caseItem.people.map((ref) => ({ ...ref })),
    person: primaryPerson,
    linkedPeople,
  };
}

export function dehydrateStoredCase(caseItem: StoredCase): PersistedCase {
  const { person: _person, linkedPeople: _linkedPeople, ...rest } = caseItem;

  return {
    ...rest,
    caseRecord: buildPersistedCaseRecord(rest.caseRecord),
    people: buildCasePeopleRefs(caseItem),
  };
}

export function hydrateNormalizedData(
  data: PersistedNormalizedFileDataV21,
): RuntimeNormalizedFileDataV21 {
  const people = data.people.map((person) => toRuntimePerson(person, data.people));
  const applications = data.applications?.map(normalizePersistedApplication) ?? [];
  const completionStatuses = getCompletionStatusNames(data.categoryConfig);

  return {
    version: "2.1",
    people,
    cases: data.cases.map((caseItem) =>
      hydrateStoredCase(
        caseItem,
        people,
        getPrimaryApplicationForCase(
          applications,
          caseItem.id,
          completionStatuses,
          true,
        ),
      ),
    ),
    applications,
    financials: data.financials.map((financial) => ({ ...financial })),
    notes: data.notes.map((note) => ({ ...note })),
    alerts: data.alerts.map((alert) => ({ ...alert })),
    exported_at: data.exported_at,
    total_cases: data.total_cases,
    categoryConfig: data.categoryConfig,
    activityLog: data.activityLog.map((entry) => ({ ...entry })),
    templates: data.templates ? [...data.templates] : undefined,
  };
}

export function dehydrateNormalizedData(
  data: RuntimeNormalizedFileDataV21,
): PersistedNormalizedFileDataV21 {
  const peopleRegistry = new Map<string, Person>();

  for (const person of data.people) {
    peopleRegistry.set(person.id, person);
  }

  for (const caseItem of data.cases) {
    peopleRegistry.set(caseItem.person.id, caseItem.person);
    for (const linked of caseItem.linkedPeople ?? []) {
      peopleRegistry.set(linked.person.id, linked.person);
    }
  }

  const people = Array.from(peopleRegistry.values());
  const persistedPeople = people.map((person) => toStoredPerson(person, people));

  return {
    version: "2.1",
    people: persistedPeople,
    cases: data.cases.map((caseItem) => dehydrateStoredCase(caseItem)),
    applications: (data.applications ?? []).map(normalizePersistedApplication),
    financials: data.financials.map((financial) => ({ ...financial })),
    notes: data.notes.map((note) => ({ ...note })),
    alerts: data.alerts.map((alert) => ({ ...alert })),
    exported_at: data.exported_at,
    total_cases: data.total_cases,
    categoryConfig: data.categoryConfig,
    activityLog: data.activityLog.map((entry) => ({ ...entry })),
    templates: data.templates ? [...data.templates] : undefined,
  };
}

function migrateRelationship(
  relationship: Relationship | undefined,
): PersonRelationship | null {
  if (!relationship) {
    return null;
  }

  return {
    id: relationship.id ?? uuidv4(),
    type: relationship.type,
    targetPersonId: null,
    displayNameFallback: relationship.name || undefined,
    legacyPhone: relationship.phone || undefined,
  };
}

export function migrateV20ToV21(data: NormalizedFileDataV20): PersistedNormalizedFileDataV21 {
  const peopleById = new Map<string, StoredPerson>();
  const casePersonIds = new Map<string, string>();

  for (const caseItem of data.cases) {
    const sourcePerson = caseItem.person;
    const personId = sourcePerson.id?.trim() ? sourcePerson.id : uuidv4();
    casePersonIds.set(caseItem.id, personId);

    if (peopleById.has(personId)) {
      continue;
    }

    const { familyMemberIds, legacyFamilyMemberNames } = splitFamilyMembers(sourcePerson.familyMembers);
    const fallbackCreatedAt = sourcePerson.createdAt || caseItem.createdAt;
    const { createdAt, updatedAt } = resolvePersonTimestamps({
      createdAt: fallbackCreatedAt,
      updatedAt: sourcePerson.updatedAt,
      dateAdded: sourcePerson.dateAdded || fallbackCreatedAt,
    });

    peopleById.set(personId, {
      id: personId,
      firstName: sourcePerson.firstName,
      lastName: sourcePerson.lastName,
      name: sourcePerson.name || `${sourcePerson.firstName} ${sourcePerson.lastName}`.trim(),
      email: sourcePerson.email,
      phone: sourcePerson.phone,
      dateOfBirth: sourcePerson.dateOfBirth,
      ssn: sourcePerson.ssn,
      organizationId: sourcePerson.organizationId,
      livingArrangement: sourcePerson.livingArrangement,
      address: {
        street: sourcePerson.address?.street ?? "",
        apt: sourcePerson.address?.apt,
        city: sourcePerson.address?.city ?? "",
        state: sourcePerson.address?.state ?? "",
        zip: sourcePerson.address?.zip ?? "",
      },
      mailingAddress: {
        street: sourcePerson.mailingAddress?.street ?? "",
        apt: sourcePerson.mailingAddress?.apt,
        city: sourcePerson.mailingAddress?.city ?? "",
        state: sourcePerson.mailingAddress?.state ?? "",
        zip: sourcePerson.mailingAddress?.zip ?? "",
        sameAsPhysical: sourcePerson.mailingAddress?.sameAsPhysical ?? true,
      },
      authorizedRepIds: [...(sourcePerson.authorizedRepIds ?? [])],
      familyMemberIds,
      legacyFamilyMemberNames: legacyFamilyMemberNames.length > 0 ? legacyFamilyMemberNames : undefined,
      relationships: (sourcePerson.relationships ?? [])
        .map((relationship) => migrateRelationship(relationship))
        .filter((relationship): relationship is PersonRelationship => relationship !== null),
      createdAt,
      updatedAt,
      dateAdded: sourcePerson.dateAdded || createdAt,
    });
  }

  const allPeople = Array.from(peopleById.values());
  const peopleByName = new Map<string, StoredPerson[]>();
  for (const person of allPeople) {
    const normalized = normalizeName(person.name);
    if (!normalized) {
      continue;
    }

    const existing = peopleByName.get(normalized) ?? [];
    existing.push(person);
    peopleByName.set(normalized, existing);
  }

  const resolvedPeople = allPeople.map((person) => ({
    ...person,
    relationships: person.relationships.map((relationship) => {
      const fallbackName = relationship.displayNameFallback ?? "";
      const matches = peopleByName.get(normalizeName(fallbackName)) ?? [];
      const targetPersonId = matches.length === 1 ? matches[0].id : null;

      return {
        ...relationship,
        targetPersonId,
        displayNameFallback: targetPersonId ? undefined : relationship.displayNameFallback,
      };
    }),
  }));

  return {
    version: "2.1",
    people: resolvedPeople,
    cases: data.cases.map((caseItem) => {
      const migratedPersonId = casePersonIds.get(caseItem.id);
      if (!migratedPersonId) {
        throw new Error(`Missing migrated person ID for case ${caseItem.id}`);
      }

      return {
        id: caseItem.id,
        name: caseItem.name,
        mcn: caseItem.mcn,
        status: caseItem.status,
        priority: caseItem.priority,
        createdAt: caseItem.createdAt,
        updatedAt: caseItem.updatedAt,
        people: [
          {
            personId: migratedPersonId,
            role: "applicant",
            isPrimary: true,
          },
        ],
        caseRecord: {
          ...caseItem.caseRecord,
          personId: migratedPersonId,
        },
        isPendingArchival: caseItem.isPendingArchival,
      };
    }),
    applications: data.cases.map((caseItem) => {
      const migratedPersonId = casePersonIds.get(caseItem.id);
      if (!migratedPersonId) {
        throw new Error(`Missing migrated person ID for case ${caseItem.id}`);
      }

      return createMigratedApplication({
        applicationId: uuidv4(),
        initialHistoryId: uuidv4(),
        caseId: caseItem.id,
        applicantPersonId: migratedPersonId,
        migratedAt: caseItem.updatedAt || caseItem.createdAt || data.exported_at,
        caseRecord: {
          ...caseItem.caseRecord,
          id: caseItem.id,
          personId: migratedPersonId,
          financials: {
            resources: [],
            income: [],
            expenses: [],
          },
          notes: [],
        },
      });
    }),
    financials: data.financials.map((financial) => ({ ...financial })),
    notes: data.notes.map((note) => ({ ...note })),
    alerts: data.alerts.map((alert) => ({ ...alert })),
    exported_at: data.exported_at,
    total_cases: data.cases.length,
    categoryConfig: data.categoryConfig,
    activityLog: data.activityLog.map((entry) => ({ ...entry })),
    templates: data.templates ? [...data.templates] : undefined,
  };
}
