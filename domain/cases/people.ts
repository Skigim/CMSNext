import { normalizePhoneNumber } from "@/domain/common";
import type { Person, Relationship, StoredCase } from "@/types/case";

type CasePeopleSource = Partial<Pick<StoredCase, "person" | "linkedPeople" | "caseRecord">>;

const CASE_PERSON_ROLE_LABELS = {
  applicant: "Applicant",
  household_member: "Household member",
  dependent: "Dependent",
  contact: "Contact",
} as const;

function getLinkedPeople(source?: CasePeopleSource): NonNullable<StoredCase["linkedPeople"]> {
  return source?.linkedPeople ?? [];
}

export function formatCasePersonDisplayName(person: Person | null | undefined): string {
  const explicitName = person?.name?.trim();
  if (explicitName) {
    return explicitName;
  }

  const firstName = person?.firstName?.trim() ?? "";
  const lastName = person?.lastName?.trim() ?? "";
  const composedName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName;
  return composedName || "Unnamed Person";
}

/**
 * Defaults to the applicant label for backward-compatible single-person cases
 * that do not have normalized role metadata available at render time.
 */
export function getCasePersonRoleLabel(
  role?: keyof typeof CASE_PERSON_ROLE_LABELS,
): string {
  return (role && CASE_PERSON_ROLE_LABELS[role]) ?? CASE_PERSON_ROLE_LABELS.applicant;
}

/**
 * Normalizes relationship display names for resilient case-insensitive matching.
 *
 * Trims surrounding whitespace, collapses repeated internal spacing, and
 * lowercases the result so legacy fallback comparisons stay stable.
 */
function normalizeRelationshipDisplayName(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Returns the normalized display name for a linked person using the shared
 * person formatting helper before applying relationship-name normalization.
 */
function getLinkedPersonDisplayName(person: Person): string {
  return normalizeRelationshipDisplayName(formatCasePersonDisplayName(person));
}

export function getPrimaryCasePersonRef(
  source: CasePeopleSource,
): NonNullable<StoredCase["linkedPeople"][number]["ref"]> | null {
  const linkedPeople = getLinkedPeople(source);
  const sourcePersonId = source.person?.id;

  return (
    linkedPeople.find(({ ref }) => ref.isPrimary)?.ref ??
    linkedPeople.find(({ ref }) => ref.personId === source.caseRecord?.personId)?.ref ??
    linkedPeople.find(({ ref }) => ref.personId === sourcePersonId)?.ref ??
    linkedPeople[0]?.ref ??
    null
  );
}

export function getPrimaryCasePersonForDisplay(source: CasePeopleSource): Person | null {
  const linkedPeople = getLinkedPeople(source);
  const primaryLinkedPerson =
    linkedPeople.find(({ ref }) => ref.isPrimary) ??
    linkedPeople.find(({ ref }) => ref.personId === source.caseRecord?.personId);
  const sourceLinkedPerson = source.person
    ? linkedPeople.find(({ person }) => person.id === source.person?.id)
    : undefined;

  return (
    primaryLinkedPerson?.person ??
    sourceLinkedPerson?.person ??
    linkedPeople[0]?.person ??
    source.person ??
    null
  );
}

export function getPrimaryCasePerson(source: CasePeopleSource): Person | null {
  const linkedPeople = getLinkedPeople(source);
  const primaryLinkedPerson =
    linkedPeople.find(({ ref }) => ref.isPrimary) ??
    linkedPeople.find(({ ref }) => ref.personId === source.caseRecord?.personId);

  return (
    source.person ??
    primaryLinkedPerson?.person ??
    linkedPeople[0]?.person ??
    null
  );
}

export function getPersonRelationships(
  person: Person | null | undefined,
  source?: CasePeopleSource,
): Relationship[] {
  if (!person) {
    return [];
  }

  if (Array.isArray(person.relationships) && person.relationships.length > 0) {
    return person.relationships.map((relationship) => ({ ...relationship }));
  }

  if (!Array.isArray(person.normalizedRelationships) || person.normalizedRelationships.length === 0) {
    return [];
  }

  const peopleById = new Map<string, Person>();
  peopleById.set(person.id, person);

  for (const linkedPerson of getLinkedPeople(source)) {
    peopleById.set(linkedPerson.person.id, linkedPerson.person);
  }

  return person.normalizedRelationships.map((relationship) => {
    const targetPerson = relationship.targetPersonId
      ? peopleById.get(relationship.targetPersonId)
      : undefined;

    return {
      id: relationship.id,
      type: relationship.type,
      name: relationship.displayNameFallback ?? formatCasePersonDisplayName(targetPerson) ?? "",
      phone: relationship.legacyPhone ?? targetPerson?.phone ?? "",
    };
  });
}

/**
 * Resolves the best display label for a linked case person role.
 *
 * Household members prefer hydrated relationship metadata from the primary
 * person using a stable fallback sequence: direct target-person match, unique
 * normalized phone match, unique normalized display-name match, and finally the
 * generic role label. Non-household roles always use the shared role label map.
 */
export function getLinkedCasePersonRoleLabel(
  source: CasePeopleSource,
  linkedPerson: Person,
  role?: keyof typeof CASE_PERSON_ROLE_LABELS,
): string {
  if (role !== "household_member") {
    return getCasePersonRoleLabel(role);
  }

  const primaryPerson = getPrimaryCasePersonForDisplay(source);
  const normalizedRelationships = primaryPerson?.normalizedRelationships ?? [];
  const directMatch = normalizedRelationships.find(
    (relationship) =>
      relationship.targetPersonId === linkedPerson.id
      && relationship.type.trim().length > 0,
  );
  if (directMatch) {
    return directMatch.type.trim();
  }

  const normalizedLinkedPhone = normalizePhoneNumber(linkedPerson.phone ?? "");
  const phoneMatches =
    normalizedLinkedPhone.length > 0
      ? normalizedRelationships.filter(
          (relationship) =>
            relationship.type.trim().length > 0
            && normalizePhoneNumber(relationship.legacyPhone ?? "") === normalizedLinkedPhone,
        )
      : [];
  if (phoneMatches.length === 1) {
    return phoneMatches[0].type.trim();
  }

  const normalizedDisplayName = getLinkedPersonDisplayName(linkedPerson);
  if (!normalizedDisplayName) {
    return getCasePersonRoleLabel(role);
  }

  const relationshipMatches = getPersonRelationships(primaryPerson, source).filter(
    (relationship) => {
      if (relationship.type.trim().length === 0) {
        return false;
      }

      const relationshipDisplayName = relationship.name;

      return (
        !!relationshipDisplayName
        && normalizeRelationshipDisplayName(relationshipDisplayName) === normalizedDisplayName
      );
    },
  );

  return relationshipMatches.length === 1
    ? relationshipMatches[0].type.trim()
    : getCasePersonRoleLabel(role);
}