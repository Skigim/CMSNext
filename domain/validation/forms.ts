/**
 * Form Validation Schemas Module
 *
 * Zod schemas and validation functions for form data.
 * Pure functions with no I/O, no side effects.
 *
 * @module domain/validation/forms
 */

import { z } from "zod";

// ============================================================================
// Common Validation Patterns
// ============================================================================

const stringRequired = (field: string) =>
  z.string().min(1, `${field} is required`);
const stringOptional = z.string().optional();
const emailSchema = z.string().email("Invalid email address").or(z.literal(""));
const phoneSchema = z
  .string()
  .regex(
    /^\(\d{3}\) \d{3}-\d{4}$|^$/,
    "Phone must be in format (XXX) XXX-XXXX or empty"
  );
const ssnSchema = z
  .string()
  .regex(/^\d{3}-\d{2}-\d{4}$|^$/, "SSN must be in format XXX-XX-XXXX or empty");
const zipSchema = z
  .string()
  .regex(/^\d{5}(-\d{4})?$|^$/, "ZIP code must be in format XXXXX or XXXXX-XXXX");
const dateSchema = z.string().datetime().or(z.literal(""));
const nonNegativeNumber = z.number().min(0, "Amount must be non-negative");

// ============================================================================
// Address Schemas
// ============================================================================

/**
 * Physical address validation schema
 */
export const AddressSchema = z.object({
  street: stringRequired("Street address"),
  city: stringRequired("City"),
  state: z.string().length(2, "State must be 2 characters").toUpperCase(),
  zip: zipSchema,
});

/**
 * Mailing address validation schema
 */
export const MailingAddressSchema = z
  .object({
    street: z.string(),
    city: z.string(),
    state: z
      .string()
      .length(2, "State must be 2 characters")
      .toUpperCase()
      .or(z.literal("")),
    zip: zipSchema,
    sameAsPhysical: z.boolean(),
  })
  .refine(
    (data) => {
      // If not same as physical, all fields are required
      if (!data.sameAsPhysical) {
        return (
          data.street.length > 0 &&
          data.city.length > 0 &&
          data.state.length > 0
        );
      }
      return true;
    },
    {
      message:
        "Mailing address fields are required when different from physical address",
      path: ["street"],
    }
  );

// ============================================================================
// Entity Schemas
// ============================================================================

/**
 * Person validation schema
 */
export const PersonSchema = z.object({
  firstName: stringRequired("First name").max(
    100,
    "First name must be less than 100 characters"
  ),
  lastName: stringRequired("Last name").max(
    100,
    "Last name must be less than 100 characters"
  ),
  email: emailSchema,
  phone: phoneSchema,
  dateOfBirth: dateSchema,
  ssn: ssnSchema,
  organizationId: z.string().nullable().optional(),
  livingArrangement: stringRequired("Living arrangement"),
  address: AddressSchema,
  mailingAddress: MailingAddressSchema,
  authorizedRepIds: z.array(z.string()).optional().default([]),
  familyMembers: z.array(z.string()).optional().default([]),
  status: stringRequired("Status"),
});

/**
 * Financial item validation schema
 */
export const FinancialItemSchema = z.object({
  name: stringOptional,
  description: stringRequired("Description").max(
    500,
    "Description must be less than 500 characters"
  ),
  location: stringOptional,
  accountNumber: stringOptional,
  amount: nonNegativeNumber,
  frequency: stringOptional,
  owner: stringOptional,
  verificationStatus: z.enum(
    ["Needs VR", "VR Pending", "AVS Pending", "Verified"],
    {
      message: "Invalid verification status",
    }
  ),
  verificationSource: stringOptional,
  notes: z
    .string()
    .max(1000, "Notes must be less than 1000 characters")
    .optional(),
  status: z
    .enum([
      "VR Pending",
      "UI Pending",
      "Approved",
      "Denied",
      "In Progress",
      "Completed",
    ])
    .optional(),
});

/**
 * Note validation schema
 */
export const NoteSchema = z.object({
  category: stringRequired("Category"),
  content: stringRequired("Note content").max(
    2000,
    "Note content must be less than 2000 characters"
  ),
});

/**
 * Case record validation schema
 */
export const CaseRecordSchema = z.object({
  mcn: stringRequired("MCN").max(50, "MCN must be less than 50 characters"),
  applicationDate: z.string().datetime("Invalid application date"),
  caseType: stringRequired("Case type"),
  personId: stringRequired("Person ID"),
  spouseId: stringOptional,
  status: stringRequired("Case status"),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional()
    .default(""),
  priority: z.boolean().optional().default(false),
  livingArrangement: stringRequired("Living arrangement"),
  withWaiver: z.boolean().optional().default(false),
  admissionDate: z.string().datetime("Invalid admission date"),
  organizationId: stringRequired("Organization ID"),
  authorizedReps: z.array(z.string()).optional().default([]),
  retroRequested: stringOptional,
});

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Standard validation result interface
 */
export interface ValidationResult<T> {
  isValid: boolean;
  data: T | null;
  errors: Record<string, string>;
  fieldErrors: Record<string, string[]>;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Helper to parse validation errors from Zod result
 */
function parseValidationErrors(
  error: z.ZodError
): Pick<ValidationResult<unknown>, "errors" | "fieldErrors"> {
  const errors: Record<string, string> = {};
  const fieldErrors: Record<string, string[]> = {};

  error.issues.forEach((issue) => {
    const path = issue.path.join(".");
    errors[path] = issue.message;

    const field = issue.path[0]?.toString() || "root";
    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }
    fieldErrors[field].push(issue.message);
  });

  return { errors, fieldErrors };
}

/**
 * Validates person data using the PersonSchema
 * @param data - The person data to validate
 * @returns ValidationResult with parsed data or errors
 */
export function validatePersonData(
  data: unknown
): ValidationResult<z.infer<typeof PersonSchema>> {
  const result = PersonSchema.safeParse(data);

  if (result.success) {
    return {
      isValid: true,
      data: result.data,
      errors: {},
      fieldErrors: {},
    };
  }

  return {
    isValid: false,
    data: null,
    ...parseValidationErrors(result.error),
  };
}

/**
 * Validates case record data using the CaseRecordSchema
 * @param data - The case record data to validate
 * @returns ValidationResult with parsed data or errors
 */
export function validateCaseRecordData(
  data: unknown
): ValidationResult<z.infer<typeof CaseRecordSchema>> {
  const result = CaseRecordSchema.safeParse(data);

  if (result.success) {
    return {
      isValid: true,
      data: result.data,
      errors: {},
      fieldErrors: {},
    };
  }

  return {
    isValid: false,
    data: null,
    ...parseValidationErrors(result.error),
  };
}

/**
 * Validates financial item data using the FinancialItemSchema
 * @param data - The financial item data to validate
 * @returns ValidationResult with parsed data or errors
 */
export function validateFinancialItemData(
  data: unknown
): ValidationResult<z.infer<typeof FinancialItemSchema>> {
  const result = FinancialItemSchema.safeParse(data);

  if (result.success) {
    return {
      isValid: true,
      data: result.data,
      errors: {},
      fieldErrors: {},
    };
  }

  return {
    isValid: false,
    data: null,
    ...parseValidationErrors(result.error),
  };
}

/**
 * Validates note data using the NoteSchema
 * @param data - The note data to validate
 * @returns ValidationResult with parsed data or errors
 */
export function validateNoteData(
  data: unknown
): ValidationResult<z.infer<typeof NoteSchema>> {
  const result = NoteSchema.safeParse(data);

  if (result.success) {
    return {
      isValid: true,
      data: result.data,
      errors: {},
      fieldErrors: {},
    };
  }

  return {
    isValid: false,
    data: null,
    ...parseValidationErrors(result.error),
  };
}

/**
 * Type-safe form validation helper
 * Creates a validation function for any given schema
 */
export function createValidator<T extends z.ZodSchema>(schema: T) {
  return (data: unknown): ValidationResult<z.infer<T>> => {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        isValid: true,
        data: result.data,
        errors: {},
        fieldErrors: {},
      };
    }

    return {
      isValid: false,
      data: null,
      ...parseValidationErrors(result.error),
    };
  };
}
