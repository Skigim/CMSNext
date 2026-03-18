import { v4 as uuidv4 } from "uuid";

import type {
  AlertRecord,
  CasePersonRef,
  PersistedCase,
  Person,
  PersonRelationship,
  Relationship,
  StoredCase,
  StoredFinancialItem,
  StoredNote,
  StoredPerson,
} from "@/types/case";
import type { CaseActivityEntry } from "@/types/activityLog";
import type { CategoryConfig } from "@/types/categoryConfig";
import type { Template } from "@/types/template";
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
  financials: StoredFinancialItem[];
  notes: StoredNote[];
  alerts: AlertRecord[];
  exported_at: string;
  total_cases: number;
  categoryConfig: CategoryConfig;
  activityLog: CaseActivityEntry[];
  templates?: Template[];
}

type NormalizedDataShapeCandidate = {
  version?: unknown;
  people?: unknown;
  cases?: unknown;
  financials?: unknown;
  notes?: unknown;
  alerts?: unknown;
  exported_at?: unknown;
  total_cases?: unknown;
  categoryConfig?: unknown;
  activityLog?: unknown;
  templates?: unknown;
};

function asNormalizedDataShapeCandidate(data: unknown): NormalizedDataShapeCandidate | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as NormalizedDataShapeCandidate;
}

function hasOptionalTemplatesArray(candidate: NormalizedDataShapeCandidate): boolean {
  return candidate.templates === undefined || Array.isArray(candidate.templates);
}

function hasNormalizedCollectionsAndMetadata(candidate: NormalizedDataShapeCandidate): boolean {
  return (
    Array.isArray(candidate.cases) &&
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
 * @param {unknown} data - Raw persisted data to inspect
 * @returns {boolean} True when the payload has the required persisted v2.0 shape
 */
export function isPersistedNormalizedFileDataV20(data: unknown): data is NormalizedFileDataV20 {
  const candidate = asNormalizedDataShapeCandidate(data);

  return candidate?.version === "2.0" && hasNormalizedCollectionsAndMetadata(candidate);
}

/**
 * Type guard for canonical persisted normalized v2.1 workspace/archive payloads.
 *
 * This is shared by runtime readers and migration tooling so that the persisted
 * v2.1 envelope is validated consistently in one place.
 *
 * @param {unknown} data - Raw persisted data to inspect
 * @returns {boolean} True when the payload has the required persisted v2.1 shape
 */
export function isPersistedNormalizedFileDataV21(data: unknown): data is PersistedNormalizedFileDataV21 {
  const candidate = asNormalizedDataShapeCandidate(data);

  return (
    candidate?.version === "2.1" &&
    Array.isArray(candidate.people) &&
    hasNormalizedCollectionsAndMetadata(candidate)
  );
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildCasePeopleRefs(
  caseItem: Pick<StoredCase, "people" | "linkedPeople" | "person" | "caseRecord">,
): CasePersonRef[] {
  const existingPeople = caseItem.people?.filter((ref) => Boolean(ref.personId)) ?? [];
  if (existingPeople.length > 0) {
    const hasPrimary = existingPeople.some((ref) => ref.isPrimary);
    return existingPeople.map((ref, index) => ({
      ...ref,
      role: ref.role ?? "applicant",
      isPrimary: hasPrimary ? ref.isPrimary : index === 0,
    }));
  }

  const linkedPeopleRefs = caseItem.linkedPeople?.map(({ ref }) => ref) ?? [];
  if (linkedPeopleRefs.length > 0) {
    const hasPrimary = linkedPeopleRefs.some((ref) => ref.isPrimary);
    return linkedPeopleRefs.map((ref, index) => ({
      ...ref,
      role: ref.role ?? "applicant",
      isPrimary: hasPrimary ? ref.isPrimary : index === 0,
    }));
  }

  return [
    {
      personId: caseItem.person.id,
      role: "applicant",
      isPrimary: true,
    },
  ];
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
  peopleById: Map<string, Person>,
): CasePersonRef {
  if (caseItem.people.length === 0) {
    throw new Error(`Case ${caseItem.id} has no linked people`);
  }

  return (
    caseItem.people.find((ref) => ref.isPrimary) ??
    caseItem.people.find((ref) => ref.personId === caseItem.caseRecord.personId && peopleById.has(ref.personId)) ??
    caseItem.people[0]
  );
}

export function hydrateStoredCase(caseItem: PersistedCase, people: Person[]): StoredCase {
  const peopleById = new Map(people.map((person) => [person.id, person] as const));
  const primaryRef = resolvePrimaryPersonRef(caseItem, peopleById);

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

  return {
    ...caseItem,
    people: caseItem.people.map((ref) => ({ ...ref })),
    person: primaryPerson,
    linkedPeople,
  };
}

export function dehydrateStoredCase(caseItem: StoredCase): PersistedCase {
  const { person: _person, linkedPeople: _linkedPeople, ...rest } = caseItem;

  return {
    ...rest,
    people: buildCasePeopleRefs(caseItem),
  };
}

export function hydrateNormalizedData(
  data: PersistedNormalizedFileDataV21,
): RuntimeNormalizedFileDataV21 {
  const people = data.people.map((person) => toRuntimePerson(person, data.people));

  return {
    version: "2.1",
    people,
    cases: data.cases.map((caseItem) => hydrateStoredCase(caseItem, people)),
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
        pendingArchival: caseItem.pendingArchival,
      };
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
