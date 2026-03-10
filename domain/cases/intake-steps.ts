/**
 * Intake Step Definitions
 *
 * Defines the steps of the intake workflow and pure functions to determine
 * step completion.  No I/O, no React, no side effects.
 *
 * @module domain/cases/intake-steps
 */

import type { IntakeFormData } from "@/domain/validation/intake.schema";

// ============================================================================
// Step Configuration
// ============================================================================

/**
 * Metadata describing a single step in the intake workflow.
 */
export interface IntakeStep {
  /** Unique step identifier */
  id: string;
  /** Short display label (used in sidebar) */
  label: string;
  /** Longer description shown beneath the label */
  description: string;
  /** Top-level field names (on IntakeFormData) that belong to this step */
  fields: (keyof IntakeFormData)[];
}

/**
 * Ordered list of intake steps.
 * The review/submit step is index 4 and requires no additional fields.
 */
export const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "applicant",
    label: "Applicant",
    description: "Basic applicant information",
    fields: ["firstName", "lastName", "dateOfBirth", "ssn", "maritalStatus"],
  },
  {
    id: "contact",
    label: "Contact",
    description: "Phone, email and address",
    fields: ["phone", "email", "address", "mailingAddress"],
  },
  {
    id: "case-details",
    label: "Case Details",
    description: "MCN, dates and program info",
    fields: [
      "mcn",
      "applicationDate",
      "caseType",
      "applicationType",
      "livingArrangement",
      "withWaiver",
      "admissionDate",
      "organizationId",
      "retroRequested",
    ],
  },
  {
    id: "checklist",
    label: "Checklist",
    description: "Verifications and documents",
    fields: [
      "appValidated",
      "agedDisabledVerified",
      "citizenshipVerified",
      "residencyVerified",
      "contactMethods",
      "voterFormStatus",
      "pregnancy",
      "avsConsentDate",
    ],
  },
  {
    id: "review",
    label: "Review",
    description: "Review and submit",
    fields: [],
  },
];

// ============================================================================
// Step Completion Logic
// ============================================================================

/**
 * Determine whether a given step has been sufficiently filled in.
 *
 * Completion is based on the presence of the **required** fields for that step:
 * - Step 0 (Applicant): firstName + lastName
 * - Step 1 (Contact): no required fields – always considered "reachable"
 * - Step 2 (Case Details): mcn + applicationDate
 * - Step 3 (Checklist): no required fields – always considered "reachable"
 * - Step 4 (Review): requires steps 0 and 2 to be complete
 *
 * @param stepIndex - Zero-based index into INTAKE_STEPS
 * @param formData  - Current draft form data
 * @returns `true` when the step's required fields are populated
 */
export function isStepComplete(
  stepIndex: number,
  formData: Partial<IntakeFormData>,
): boolean {
  switch (stepIndex) {
    case 0:
      return (
        (formData.firstName?.trim().length ?? 0) > 0 &&
        (formData.lastName?.trim().length ?? 0) > 0
      );
    case 1:
      // Contact info is optional – step is always completable
      return true;
    case 2:
      return (
        (formData.mcn?.trim().length ?? 0) > 0 &&
        (formData.applicationDate?.trim().length ?? 0) > 0
      );
    case 3:
      // Checklist items are all optional – step is always completable
      return true;
    case 4:
      // Review step: all required prior steps must be complete
      return isStepComplete(0, formData) && isStepComplete(2, formData);
    default:
      return false;
  }
}

/**
 * Determine whether the user can navigate to a given step.
 *
 * A step is reachable when all preceding required-field steps are complete.
 * Visited-step tracking (which allows jumping back to any previously visited
 * step regardless of form state) is handled separately in the hook layer and
 * is not an input to this function.
 *
 * This pure function only checks the "required fields" gate:
 * the step is reachable if all steps before it are complete.
 *
 * @param stepIndex - Target step index
 * @param formData  - Current draft form data
 * @returns `true` when the step can be navigated to
 */
export function isStepReachable(
  stepIndex: number,
  formData: Partial<IntakeFormData>,
): boolean {
  if (stepIndex === 0) return true;
  // Every preceding required-field step must pass
  for (let i = 0; i < stepIndex; i++) {
    if (!isStepComplete(i, formData)) {
      // Steps 1 and 3 have no required fields, so they never block
      if (i !== 1 && i !== 3) return false;
    }
  }
  return true;
}

/**
 * Returns the index of the first incomplete required step,
 * or `INTAKE_STEPS.length` when all steps are complete.
 *
 * Useful for jumping the user to the next step that needs attention.
 */
export function firstIncompleteStep(formData: Partial<IntakeFormData>): number {
  for (let i = 0; i < INTAKE_STEPS.length; i++) {
    if (!isStepComplete(i, formData)) return i;
  }
  return INTAKE_STEPS.length;
}
