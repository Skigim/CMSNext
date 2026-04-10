export {
  APPLICATION_OWNED_CASE_RECORD_FIELDS,
  CASE_OWNED_AFTER_APPLICATION_MIGRATION_FIELDS,
  createCanonicalApplication,
  createMigratedApplication,
  createMigratedApplicationStatusHistory,
  deriveMigratedApplicationStatus,
  normalizeRetroRequestedAt,
  pickApplicationOwnedCaseRecordFields,
  type CreateCanonicalApplicationInput,
  type CreateMigratedApplicationInput,
} from "./migration";

export { selectOldestNonTerminalApplication } from "./selectors";