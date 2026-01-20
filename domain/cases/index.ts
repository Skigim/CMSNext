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
  type GenerateAvsNarrativeOptions,
  generateAvsNarrative,
} from "./avsNarrativeGenerator";

export {
  createCaseRecordData,
  createPersonData,
  type CaseRecordDefaults,
  type PersonDefaults,
} from "./factories";
