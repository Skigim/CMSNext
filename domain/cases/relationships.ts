import type { Relationship } from "@/types/case";

export function isRelationshipPopulated(relationship: Relationship): boolean {
  return [relationship.type, relationship.name, relationship.phone].some(
    (value) => (value ?? "").trim().length > 0,
  );
}
