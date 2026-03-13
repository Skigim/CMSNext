import { dateInputValueToISO, normalizePhoneNumber } from "@/domain/common";
import type { IntakeFormData } from "@/domain/validation/intake.schema";
import type { HouseholdMemberData } from "@/types/case";

export function isHouseholdMemberPopulated(member: HouseholdMemberData): boolean {
  return [
    member.relationshipType,
    member.firstName,
    member.lastName,
    member.phone,
    member.email,
    member.dateOfBirth,
    member.ssn,
    member.address.street,
    member.address.city,
    member.address.zip,
    member.mailingAddress.street,
    member.mailingAddress.city,
    member.mailingAddress.zip,
  ].some((value) => (value ?? "").trim().length > 0);
}

export function normalizeHouseholdMemberDraft(
  member: HouseholdMemberData,
): HouseholdMemberData {
  return {
    ...member,
    address: {
      ...member.address,
      apt: member.address.apt ?? "",
    },
    mailingAddress: {
      ...member.mailingAddress,
      apt: member.mailingAddress.apt ?? "",
    },
  };
}

export function normalizeHouseholdMemberForSave(
  member: HouseholdMemberData,
  defaults: HouseholdMemberData,
  formData: Pick<IntakeFormData, "organizationId" | "livingArrangement">,
): HouseholdMemberData {
  const normalizedMember = normalizeHouseholdMemberDraft(member);
  const normalizedAddress = {
    ...defaults.address,
    ...normalizedMember.address,
    apt: normalizedMember.address.apt ?? undefined,
  };
  const normalizedMailingAddress = normalizedMember.mailingAddress.sameAsPhysical
    ? {
        ...normalizedAddress,
        sameAsPhysical: true,
      }
    : {
        ...defaults.mailingAddress,
        ...normalizedMember.mailingAddress,
        apt: normalizedMember.mailingAddress.apt ?? undefined,
      };

  return {
    ...defaults,
    ...normalizedMember,
    firstName: normalizedMember.firstName.trim(),
    lastName: normalizedMember.lastName.trim(),
    phone: normalizePhoneNumber(normalizedMember.phone ?? ""),
    email: normalizedMember.email.trim(),
    dateOfBirth: dateInputValueToISO(normalizedMember.dateOfBirth) ?? "",
    ssn: normalizedMember.ssn.trim(),
    organizationId:
      normalizedMember.organizationId
      ?? (formData.organizationId && formData.organizationId.trim().length > 0
        ? formData.organizationId
        : null),
    livingArrangement:
      normalizedMember.livingArrangement
      || formData.livingArrangement
      || defaults.livingArrangement,
    address: normalizedAddress,
    mailingAddress: normalizedMailingAddress,
    status: normalizedMember.status || "Active",
  };
}

export function formatHouseholdMemberName(member: HouseholdMemberData): string {
  return `${member.firstName} ${member.lastName}`.trim();
}

export function formatHouseholdMemberAccordionSummary(
  member: HouseholdMemberData,
): string {
  return [
    member.relationshipType?.trim() ?? "",
    formatHouseholdMemberName(member),
    normalizePhoneNumber(member.phone ?? ""),
  ]
    .filter((value) => value.length > 0)
    .join(" · ");
}
