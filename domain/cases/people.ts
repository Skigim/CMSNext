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

export function getPrimaryCasePersonRef(
  source: CasePeopleSource,
): NonNullable<StoredCase["linkedPeople"]>[number]["ref"] | null {
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
      name: relationship.displayNameFallback ?? targetPerson?.name ?? "",
      phone: relationship.legacyPhone ?? targetPerson?.phone ?? "",
    };
  });
}
