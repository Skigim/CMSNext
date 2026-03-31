/**
 * Intake Form Validation Schemas
 *
 * Zod schemas for the step-based Medicaid intake workflow.
 * Pure functions with no I/O, no side effects.
 *
 * @module domain/validation/intake.schema
 */

import { isValidUSPhoneNumber } from "@/domain/common/phone";
import { emailSchema, ssnSchema, stringRequired, zipSchema } from "@/domain/validation/forms";
import type { ValidationResult } from "@/domain/validation/forms";
import { z } from "zod";

// ============================================================================
// Intake-specific helpers
// ============================================================================

// phoneSchema here accepts any valid US number (less strict than the forms.ts
// variant) because the intake form formats the value as the user types and the
// normalizePhoneNumber call on submit converts to the canonical format.
const phoneSchema = z
  .string()
  .refine(
    (value) => value === "" || isValidUSPhoneNumber(value),
    "Phone must be a complete US phone number or empty",
  );

// ============================================================================
// Step 1 – Applicant Information
// ============================================================================

/**
 * Schema for the Applicant Information step.
 */
export const IntakeApplicantSchema = z.object({
  applicantPersonId: z.string().optional().default(""),
  firstName: stringRequired("First name").max(100),
  lastName: stringRequired("Last name").max(100),
  dateOfBirth: z.string().optional().default(""),
  ssn: ssnSchema.optional().default(""),
  maritalStatus: z.string().optional().default(""),
});

export type IntakeApplicantData = z.infer<typeof IntakeApplicantSchema>;

// ============================================================================
// Step 2 – Contact & Address
// ============================================================================

const AddressStepSchema = z.object({
  street: z.string().optional().default(""),
  apt: z.string().max(20).optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default("NE"),
  zip: zipSchema.optional().default(""),
});

const MailingAddressStepSchema = z.object({
  sameAsPhysical: z.boolean().default(true),
  street: z.string().optional().default(""),
  apt: z.string().max(20).optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default("NE"),
  zip: zipSchema.optional().default(""),
});

/**
 * Schema for the Contact & Address step.
 */
export const IntakeContactSchema = z.object({
  phone: phoneSchema.optional().default(""),
  email: emailSchema.optional().default(""),
  address: AddressStepSchema,
  mailingAddress: MailingAddressStepSchema,
});

export type IntakeContactData = z.infer<typeof IntakeContactSchema>;

// ============================================================================
// Step 3 – Case Details
// ============================================================================

/**
 * Schema for the Case Details step.
 */
export const IntakeCaseDetailsSchema = z.object({
  mcn: stringRequired("MCN").max(50),
  applicationDate: stringRequired("Application date"),
  caseType: z.string().optional().default(""),
  applicationType: z.string().optional().default(""),
  livingArrangement: z.string().optional().default(""),
  withWaiver: z.boolean().optional().default(false),
  admissionDate: z.string().optional().default(""),
  organizationId: z.string().optional().default(""),
  retroRequested: z.string().optional().default(""),
});

export type IntakeCaseDetailsData = z.infer<typeof IntakeCaseDetailsSchema>;

// ============================================================================
// Step 4 – Checklist / Documents
// ============================================================================


const contactMethodSchema = z.enum(["mail", "text", "email"]);
const voterFormStatusSchema = z.enum(["requested", "declined", "not_answered", ""]);

/**
 * Schema for the Checklist & Documents step.
 */
export const IntakeChecklistSchema = z.object({
  appValidated: z.boolean().optional().default(false),
  agedDisabledVerified: z.boolean().optional().default(false),
  citizenshipVerified: z.boolean().optional().default(false),
  residencyVerified: z.boolean().optional().default(false),
  contactMethods: z.array(contactMethodSchema).optional().default([]),
  voterFormStatus: voterFormStatusSchema.optional().default(""),
  pregnancy: z.boolean().optional().default(false),
  avsConsentDate: z.string().optional().default(""),
});

export type IntakeChecklistData = z.infer<typeof IntakeChecklistSchema>;

// ============================================================================
// Step 5 – Household / Relationships
// ============================================================================

const intakeRelationshipSchema = z.object({
  id: z.string().optional(),
  type: z.string().default(""),
  name: z.string().default(""),
  phone: z.string().default(""),
});

const householdMemberRoleSchema = z.enum([
  "household_member",
  "dependent",
  "contact",
]);

const intakeHouseholdMemberSchema = z.object({
  personId: z.string().optional(),
  relationshipId: z.string().optional(),
  relationshipType: z.string().default(""),
  role: householdMemberRoleSchema.default("household_member"),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: emailSchema.optional().default(""),
  phone: phoneSchema.optional().default(""),
  dateOfBirth: z.string().optional().default(""),
  ssn: ssnSchema.optional().default(""),
  organizationId: z.string().nullable().optional().default(null),
  livingArrangement: z.string().default(""),
  address: AddressStepSchema,
  mailingAddress: MailingAddressStepSchema,
  authorizedRepIds: z.array(z.string()).optional().default([]),
  familyMembers: z.array(z.string()).optional().default([]),
  relationships: z.array(intakeRelationshipSchema).optional().default([]),
});

/**
 * Schema for the Household & Relationships step.
 */
export const IntakeHouseholdSchema = z.object({
  relationships: z.array(intakeRelationshipSchema).optional().default([]),
  householdMembers: z.array(intakeHouseholdMemberSchema).optional().default([]),
});

export type IntakeHouseholdData = z.infer<typeof IntakeHouseholdSchema>;

// ============================================================================
// Full Intake Form Data (union of all steps)
// ============================================================================

/**
 * Combined schema for the entire intake form.
 * Merges all five step schemas into a single flat object.
 */
export const IntakeFormSchema = z.object({
  ...IntakeApplicantSchema.shape,
  ...IntakeContactSchema.shape,
  ...IntakeCaseDetailsSchema.shape,
  ...IntakeChecklistSchema.shape,
  ...IntakeHouseholdSchema.shape,
});

export type IntakeFormData = z.infer<typeof IntakeFormSchema>;

/**
 * Validates an intake form using the full schema.
 */
export function validateIntakeForm(
  data: Partial<IntakeFormData>,
): ValidationResult<IntakeFormData> {
  const result = IntakeFormSchema.safeParse(data);

  if (result.success) {
    return {
      isValid: true,
      data: result.data,
      errors: {},
      fieldErrors: {},
    };
  }

  const errors: Record<string, string> = {};
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0]?.toString() ?? "form";
    fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];

    if (!(field in errors)) {
      errors[field] = issue.message;
    }
  }

  return {
    isValid: false,
    data: null,
    errors,
    fieldErrors,
  };
}

/**
 * Returns a blank intake form with all fields at their defaults.
 * Returns the blank object directly without schema validation,
 * since required fields are intentionally empty at the start of intake.
 */
export function createBlankIntakeForm(): IntakeFormData {
  return {
    // Applicant
    applicantPersonId: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    ssn: "",
    maritalStatus: "",
    // Contact
    phone: "",
    email: "",
    address: { street: "", apt: "", city: "", state: "NE", zip: "" },
    mailingAddress: {
      sameAsPhysical: true,
      street: "",
      apt: "",
      city: "",
      state: "NE",
      zip: "",
    },
    // Case details
    mcn: "",
    applicationDate: "",
    caseType: "",
    applicationType: "",
    livingArrangement: "",
    withWaiver: false,
    admissionDate: "",
    organizationId: "",
    retroRequested: "",
    // Checklist
    appValidated: false,
    agedDisabledVerified: false,
    citizenshipVerified: false,
    residencyVerified: false,
    contactMethods: [],
    voterFormStatus: "",
    pregnancy: false,
    avsConsentDate: "",
    // Household
    relationships: [],
    householdMembers: [],
  };
}
