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
  getPrimaryCasePerson,
  getPersonRelationships,
} from "./people";

export {
  type GenerateAvsNarrativeOptions,
  generateAvsNarrative,
} from "./avsNarrativeGenerator";

export {
  createCaseRecordData,
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
