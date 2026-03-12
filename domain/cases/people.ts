import type { Person, Relationship, StoredCase } from "@/types/case";

type CasePeopleSource = Partial<Pick<StoredCase, "person" | "linkedPeople" | "caseRecord">>;

function getLinkedPeople(source?: CasePeopleSource): NonNullable<StoredCase["linkedPeople"]> {
  return source?.linkedPeople ?? [];
}

export function getPrimaryCasePerson(source: CasePeopleSource): Person | null {
  if (source.person) {
    return source.person;
  }

  const linkedPeople = getLinkedPeople(source);

  return (
    linkedPeople.find(({ ref }) => ref.isPrimary)?.person ??
    linkedPeople.find(({ ref }) => ref.personId === source.caseRecord?.personId)?.person ??
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
