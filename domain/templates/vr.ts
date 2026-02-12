/**
 * Template VR Rendering Module
 *
 * Pure functions for building template contexts and rendering VR templates.
 * Substitutes placeholders with actual data from financial items and case records.
 *
 * @module domain/templates/vr
 */

import type { FinancialItem, StoredCase, Person } from "@/types/case";
import type {
  Template,
  TemplateRenderContext,
  RenderedTemplate,
  TemplatePlaceholderField,
} from "@/types/template";
import { TEMPLATE_PLACEHOLDER_FIELDS } from "@/types/template";
import { parseLocalDate, formatDateForDisplay } from "@/domain/common";
import { formatPhoneNumber } from "@/domain/common";

// ============================================================================
// Date Formatting Helpers
// ============================================================================

/**
 * Format a Date object as MM/DD/YYYY for template output.
 * Uses the centralized domain formatter.
 */
function formatDateFromObject(date: Date): string {
  // Convert Date to ISO string and use centralized formatter
  const result = formatDateForDisplay(date.toISOString());
  return result === "None" ? "" : result;
}

/**
 * Format a date string for display in templates using centralized formatter.
 * Returns empty string (not "None") for missing/invalid dates in template context.
 */
function formatDate(dateString?: string): string {
  if (!dateString) return "";
  const result = formatDateForDisplay(dateString);
  return result === "None" ? "" : result;
}

/**
 * Format currency for display in VR templates.
 */
function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Apply a day offset to a date and format for display.
 * If baseDate is a string, parse it first. If empty/invalid, returns empty string.
 * @param baseDate - The base date (string or Date)
 * @param daysOffset - Number of days to add (can be negative)
 */
function applyDateOffset(
  baseDate: string | Date | undefined,
  daysOffset: number
): string {
  if (!baseDate) return "";

  let date: Date | null;

  if (typeof baseDate === "string") {
    // Handle "now" or empty as current date
    if (baseDate === "" || baseDate === "now") {
      date = new Date();
    } else {
      date = parseLocalDate(baseDate);
    }
  } else {
    date = new Date(baseDate);
  }

  if (!date || isNaN(date.getTime())) return "";

  const adjusted = new Date(date);
  adjusted.setDate(adjusted.getDate() + daysOffset);
  return formatDateFromObject(adjusted);
}

/**
 * Get today's date formatted for display (MM/DD/YYYY).
 */
function getCurrentDateFormatted(): string {
  return formatDateFromObject(new Date());
}

// ============================================================================
// Person/Address Formatting
// ============================================================================

/**
 * Format an address object as a single string.
 */
function formatAddress(person?: Person): string {
  if (!person?.address) return "";
  const { street, city, state, zip } = person.address;
  const parts = [street, city, state, zip].filter(Boolean);
  return parts.join(", ");
}

// ============================================================================
// Financial Item Helpers
// ============================================================================

/**
 * Get the most recent amount history entry.
 */
function getLatestHistoryEntry(item: FinancialItem) {
  if (!item.amountHistory?.length) return null;
  return [...item.amountHistory].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )[0];
}

// ============================================================================
// Context Builders
// ============================================================================

/**
 * Build a render context with only case-level data (no financial item data).
 * Used for rendering templates when no items are selected.
 */
export function buildCaseLevelContext(
  storedCase: StoredCase
): TemplateRenderContext {
  const { caseRecord, person } = storedCase;

  return {
    // Financial item fields (empty for case-level only)
    description: "",
    accountNumber: "",
    amount: 0,
    location: "",
    owner: "",
    frequency: "",
    verificationStatus: "",
    verificationSource: "",
    dateAdded: "",
    itemNotes: "",
    itemType: "",

    // Amount history fields (empty for case-level only)
    lastUpdated: "",
    lastVerified: "",
    historyVerificationSource: "",

    // Case fields
    caseName: person ? `${person.firstName} ${person.lastName}`.trim() : "",
    caseNumber: caseRecord?.mcn || "",
    caseType: caseRecord?.caseType || "",
    applicationDate: caseRecord?.applicationDate || "",
    caseStatus: caseRecord?.status || "",

    // Person fields
    clientFirstName: person?.firstName || "",
    clientLastName: person?.lastName || "",
    clientPhone: person?.phone ? formatPhoneNumber(person.phone) : "",
    clientEmail: person?.email || "",
    clientSSN: person?.ssn || "",
    clientDOB: person?.dateOfBirth || "",
    clientAddress: formatAddress(person),

    // System
    currentDate: getCurrentDateFormatted(),
  };
}

/**
 * Build the render context from a financial item and case data.
 */
export function buildRenderContext(
  item: FinancialItem,
  itemType: "resources" | "income" | "expenses",
  storedCase: StoredCase
): TemplateRenderContext {
  const { caseRecord, person } = storedCase;
  const latestHistory = getLatestHistoryEntry(item);

  // Get the date to use for "last updated" - prefer history entry date
  const lastUpdatedDate = latestHistory?.startDate || item.dateAdded;

  // Get verification date from history if available
  const lastVerifiedDate = latestHistory?.verificationSource
    ? latestHistory.startDate
    : undefined;

  return {
    // Financial item fields
    description: item.description || "",
    accountNumber: item.accountNumber || "",
    amount: item.amount,
    location: item.location || "",
    owner: item.owner || "",
    frequency: item.frequency || "",
    verificationStatus: item.verificationStatus || "",
    verificationSource: item.verificationSource || "",
    dateAdded: item.dateAdded || "",
    itemNotes: item.notes || "",
    itemType: itemType.charAt(0).toUpperCase() + itemType.slice(1, -1), // "resources" -> "Resource"

    // Amount history fields
    lastUpdated: lastUpdatedDate || "",
    lastVerified: lastVerifiedDate || "",
    historyVerificationSource: latestHistory?.verificationSource || "",

    // Case fields
    caseName: person ? `${person.firstName} ${person.lastName}`.trim() : "",
    caseNumber: caseRecord?.mcn || "",
    caseType: caseRecord?.caseType || "",
    applicationDate: caseRecord?.applicationDate || "",
    caseStatus: caseRecord?.status || "",

    // Person fields
    clientFirstName: person?.firstName || "",
    clientLastName: person?.lastName || "",
    clientPhone: person?.phone ? formatPhoneNumber(person.phone) : "",
    clientEmail: person?.email || "",
    clientSSN: person?.ssn || "",
    clientDOB: person?.dateOfBirth || "",
    clientAddress: formatAddress(person),

    // System
    currentDate: getCurrentDateFormatted(),
  };
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * List of date fields that support +/- offset syntax.
 */
const DATE_FIELDS = new Set([
  "currentDate",
  "applicationDate",
  "dateAdded",
  "lastUpdated",
  "lastVerified",
  "clientDOB",
]);

/**
 * Check if a field is a date field that supports offsets.
 */
function isDateField(fieldName: string): boolean {
  return (
    DATE_FIELDS.has(fieldName) ||
    fieldName.toLowerCase().includes("date") ||
    fieldName === "lastUpdated" ||
    fieldName === "lastVerified"
  );
}

/**
 * Check if a value is already a formatted date string (MM/DD/YYYY format).
 * This prevents double-formatting when pre-formatted dates are passed.
 */
function isAlreadyFormattedDate(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

/** Resolve a null/undefined placeholder value, handling currentDate+offset. */
function resolveNullPlaceholder(key: string, offsetStr: string | undefined): string {
  if (key === "currentDate" && offsetStr) {
    return applyDateOffset(new Date(), parseInt(offsetStr, 10));
  }
  return "";
}

/** Format a date-type placeholder value with optional offset. */
function resolveDatePlaceholder(key: string, value: unknown, offsetStr: string | undefined): string {
  const stringValue = String(value);
  if (isAlreadyFormattedDate(stringValue) && !offsetStr) return stringValue;

  const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

  if (key === "currentDate") {
    return offset === 0 ? getCurrentDateFormatted() : applyDateOffset(new Date(), offset);
  }
  if (offset !== 0) return applyDateOffset(stringValue, offset);
  return formatDate(stringValue);
}

/**
 * Render a template by substituting placeholders with context values.
 *
 * Placeholders support two formats:
 * - {fieldName} - Simple substitution
 * - {fieldName+N} or {fieldName-N} - Date fields with day offset
 *
 * Unknown placeholders are left as-is.
 */
export function renderTemplate(
  template: string,
  context: TemplateRenderContext
): string {
  return template.replace(
    /\{(\w+)([+-]\d+)?\}/g,
    (match, fieldName, offsetStr) => {
      const key = fieldName as TemplatePlaceholderField;

      if (!(key in TEMPLATE_PLACEHOLDER_FIELDS)) return match;

      const value = context[key as keyof TemplateRenderContext];

      if (value === undefined || value === null) {
        return resolveNullPlaceholder(key, offsetStr);
      }

      if (isDateField(key)) return resolveDatePlaceholder(key, value, offsetStr);

      if (key === "amount") return formatCurrency(value as number);

      return String(value);
    }
  );
}

/**
 * Render a template for a specific financial item.
 */
export function renderVR(
  template: Template,
  item: FinancialItem,
  itemType: "resources" | "income" | "expenses",
  storedCase: StoredCase
): RenderedTemplate {
  const context = buildRenderContext(item, itemType, storedCase);
  const text = renderTemplate(template.template, context);

  return {
    templateId: template.id,
    itemId: item.id,
    text,
  };
}

/**
 * Render multiple templates for financial items and combine with a separator.
 */
export function renderMultipleVRs(
  template: Template,
  items: Array<{ item: FinancialItem; type: "resources" | "income" | "expenses" }>,
  storedCase: StoredCase
): string {
  const renderedTemplates = items.map(({ item, type }) =>
    renderVR(template, item, type, storedCase)
  );

  return renderedTemplates.map((r) => r.text).join("\n\n-----\n\n");
}
