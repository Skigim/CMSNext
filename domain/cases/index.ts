/**
 * @fileoverview Domain cases module - pure case-related functions.
 */

export {
  formatRetroMonths,
  calculateAge,
  formatVoterStatus,
  calculateAVSTrackingDates,
  extractKnownInstitutions,
  formatCaseDisplayName,
} from "./formatting";

export type { VoterFormStatus, AVSTrackingDates } from "./formatting";

export {
  formatCasePersonDisplayName,
  getCasePersonRoleLabel,
  getPrimaryCasePerson,
  getPrimaryCasePersonForDisplay,
  getPrimaryCasePersonRef,
  getPersonRelationships,
} from "./people";

export {
  type GenerateAvsNarrativeOptions,
  generateAvsNarrative,
} from "./avsNarrativeGenerator";

export {
  createCaseRecordData,
  createBlankHouseholdMemberData,
  createIntakeFormData,
  createPersonData,
  type CaseRecordDefaults,
  type PersonDefaults,
} from "./factories";

export {
  INTAKE_STEPS,
  isStepComplete,
  isStepReachable,
  firstIncompleteStep,
  type IntakeStep,
} from "./intake-steps";
