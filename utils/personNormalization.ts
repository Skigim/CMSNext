const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function splitFamilyMembers(familyMembers: string[] | undefined): {
  normalizedFamilyMembers: string[];
  familyMemberIds: string[];
  legacyFamilyMemberNames: string[];
} {
  const normalizedFamilyMembers = Array.from(
    new Set(
      (familyMembers ?? [])
        .map((member) => member.trim())
        .filter((member) => member.length > 0),
    ),
  );

  return {
    normalizedFamilyMembers,
    familyMemberIds: normalizedFamilyMembers.filter((member) => isUuid(member)),
    legacyFamilyMemberNames: normalizedFamilyMembers.filter((member) => !isUuid(member)),
  };
}
