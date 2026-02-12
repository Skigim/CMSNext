/**
 * Case Summary Generation Module
 *
 * Pure functions for generating case summaries with template support.
 * Combines section rendering and summary generation logic.
 *
 * @module domain/templates/summary
 */

import type {
  StoredCase,
  FinancialItem,
  Note,
  Relationship,
} from "@/types/case";
import type { Template, TemplateRenderContext } from "@/types/template";
import type { SummarySectionKey } from "@/types/categoryConfig";
import { DEFAULT_SUMMARY_SECTION_TEMPLATES } from "@/types/template";
import { formatDateForDisplay } from "@/domain/common";
import {
  formatRetroMonths,
  calculateAge,
  formatVoterStatus,
  calculateAVSTrackingDates,
  extractKnownInstitutions,
} from "@/domain/cases";
import { getAmountInfoForMonth } from "@/domain/financials";
import { renderTemplate } from "./vr";

const SECTION_SEPARATOR = "\n-----\n";

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format currency as $1,500.00
 */
function formatCurrencyAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format frequency for display (e.g., "Monthly" -> "/Monthly")
 */
function formatFrequencyDisplay(frequency?: string): string {
  if (!frequency) return "";
  const formatted =
    frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
  return `/${formatted}`;
}

/**
 * Format phone number as (XXX) XXX-XXXX
 */
function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  const digits = phone.replaceAll(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

/**
 * Format a date string to MM/DD/YYYY using centralized utility
 */
function formatDateMMDDYYYY(dateString: string | null | undefined): string {
  const result = formatDateForDisplay(dateString);
  return result === "None" ? "None Attested" : result;
}

// ============================================================================
// Item Formatters (exported for use in financial item cards)
// ============================================================================

/**
 * Format a resource item:
 * Description Account Number w/ Institution/Location - Amount (Verification Source or Status)
 * @param item The financial item
 * @param targetDate Optional date to get the amount for (defaults to current date)
 */
export function formatResourceItem(item: FinancialItem, targetDate?: Date): string {
  const parts: string[] = [];

  // Get amount and verification from history entry
  const amountInfo = getAmountInfoForMonth(item, targetDate);
  const amount = amountInfo.amount;
  const verificationStatus = amountInfo.entry?.verificationStatus ?? "Needs VR";
  const verificationSource = amountInfo.entry?.verificationSource;

  parts.push(item.description || "Unnamed");

  if (item.accountNumber) {
    parts.push(` ${item.accountNumber}`);
  }

  if (item.location) {
    parts.push(` w/ ${item.location}`);
  }

  parts.push(` - ${formatCurrencyAmount(amount)}`);

  if (verificationStatus === "Verified" && verificationSource) {
    parts.push(` (${verificationSource})`);
  } else if (verificationStatus) {
    parts.push(` (${verificationStatus})`);
  }

  return parts.join("");
}

/**
 * Format an income item:
 * Description from Institution - Amount/Frequency (Verification Source or Status)
 * @param item The financial item
 * @param targetDate Optional date to get the amount for (defaults to current date)
 */
export function formatIncomeItem(item: FinancialItem, targetDate?: Date): string {
  const parts: string[] = [];

  // Get amount and verification from history entry
  const amountInfo = getAmountInfoForMonth(item, targetDate);
  const amount = amountInfo.amount;
  const verificationStatus = amountInfo.entry?.verificationStatus ?? "Needs VR";
  const verificationSource = amountInfo.entry?.verificationSource;

  parts.push(item.description || "Unnamed");

  if (item.location) {
    parts.push(` from ${item.location}`);
  }

  parts.push(
    ` - ${formatCurrencyAmount(amount)}${formatFrequencyDisplay(item.frequency)}`
  );

  if (verificationStatus === "Verified" && verificationSource) {
    parts.push(` (${verificationSource})`);
  } else if (verificationStatus) {
    parts.push(` (${verificationStatus})`);
  }

  return parts.join("");
}

/**
 * Format an expense item:
 * Description to Institution - Amount/Frequency (Verification Source or Status)
 * @param item The financial item
 * @param targetDate Optional date to get the amount for (defaults to current date)
 */
export function formatExpenseItem(item: FinancialItem, targetDate?: Date): string {
  const parts: string[] = [];

  // Get amount and verification from history entry
  const amountInfo = getAmountInfoForMonth(item, targetDate);
  const amount = amountInfo.amount;
  const verificationStatus = amountInfo.entry?.verificationStatus ?? "Needs VR";
  const verificationSource = amountInfo.entry?.verificationSource;

  parts.push(item.description || "Unnamed");

  if (item.location) {
    parts.push(` to ${item.location}`);
  }

  parts.push(
    ` - ${formatCurrencyAmount(amount)}${formatFrequencyDisplay(item.frequency)}`
  );

  if (verificationStatus === "Verified" && verificationSource) {
    parts.push(` (${verificationSource})`);
  } else if (verificationStatus) {
    parts.push(` (${verificationStatus})`);
  }

  return parts.join("");
}

/**
 * Format a relationship: Type | Name | Phone
 */
function formatRelationship(rel: Relationship): string {
  const parts = [rel.type || "Unknown", rel.name || "Unknown"];
  if (rel.phone) {
    parts.push(formatPhoneNumber(rel.phone));
  }
  return parts.join(" | ");
}

// ============================================================================
// Section Context Builders
// ============================================================================

/**
 * Build template render context for case info section
 */
export function buildCaseInfoContext(
  caseRecord: StoredCase["caseRecord"]
): Partial<TemplateRenderContext> {
  const retroDisplay = formatRetroMonths(
    caseRecord.retroMonths,
    caseRecord.applicationDate
  );
  const appDate = formatDateForDisplay(caseRecord.applicationDate);

  return {
    applicationDate: appDate === "None" ? "None Attested" : appDate,
    retroDisplay,
    withWaiver: caseRecord.withWaiver ? "Yes" : "No",
  };
}

/**
 * Build template render context for person info section
 */
export function buildPersonInfoContext(
  person: StoredCase["person"],
  caseRecord: StoredCase["caseRecord"]
): Partial<TemplateRenderContext> {
  const age = calculateAge(person.dateOfBirth);
  const ageDisplay = age !== null ? `(${age})` : "";
  const maritalStatus = caseRecord.maritalStatus || "Unknown";
  const fullName = `${person.firstName} ${person.lastName} ${ageDisplay}`.trim();

  const contactParts: string[] = [];
  if (person.email) contactParts.push(person.email);
  if (person.phone) contactParts.push(formatPhoneNumber(person.phone));
  const contact =
    contactParts.length > 0 ? contactParts.join(" | ") : "No contact info";

  const voterStatus = formatVoterStatus(caseRecord.voterFormStatus);

  return {
    clientFirstName: person.firstName,
    clientLastName: person.lastName,
    age,
    fullName,
    maritalStatus,
    contact,
    clientEmail: person.email || "",
    clientPhone: formatPhoneNumber(person.phone),
    citizenshipVerified: caseRecord.citizenshipVerified ? "Yes" : "No",
    agedDisabledVerified: caseRecord.agedDisabledVerified ? "Yes" : "No",
    livingArrangement: caseRecord.livingArrangement || "None Attested",
    voterStatus,
  };
}

/**
 * Build template render context for relationships section
 */
export function buildRelationshipsContext(
  relationships?: Relationship[]
): Partial<TemplateRenderContext> {
  if (!relationships || relationships.length === 0) {
    return {
      relationshipsList: "None Attested",
    };
  }

  const formatted = relationships.map(formatRelationship);
  return {
    relationshipsList: formatted.join("\n"),
  };
}

/**
 * Build template render context for resources section
 * @param resources The financial items
 * @param targetDate Optional date for amount lookup (defaults to current date)
 */
export function buildResourcesContext(
  resources: FinancialItem[],
  targetDate?: Date
): Partial<TemplateRenderContext> {
  if (!resources || resources.length === 0) {
    return {
      resourcesList: "None Attested",
    };
  }

  const formatted = resources.map(item => formatResourceItem(item, targetDate));
  return {
    resourcesList: formatted.join("\n"),
  };
}

/**
 * Build template render context for income section
 * @param income The financial items
 * @param targetDate Optional date for amount lookup (defaults to current date)
 */
export function buildIncomeContext(
  income: FinancialItem[],
  targetDate?: Date
): Partial<TemplateRenderContext> {
  if (!income || income.length === 0) {
    return {
      incomeList: "None Attested",
    };
  }

  const formatted = income.map(item => formatIncomeItem(item, targetDate));
  return {
    incomeList: formatted.join("\n"),
  };
}

/**
 * Build template render context for expenses section
 * @param expenses The financial items
 * @param targetDate Optional date for amount lookup (defaults to current date)
 */
export function buildExpensesContext(
  expenses: FinancialItem[],
  targetDate?: Date
): Partial<TemplateRenderContext> {
  if (!expenses || expenses.length === 0) {
    return {
      expensesList: "None Attested",
    };
  }

  const formatted = expenses.map(item => formatExpenseItem(item, targetDate));
  return {
    expensesList: formatted.join("\n"),
  };
}

/**
 * Build template render context for notes section
 */
export function buildNotesContext(notes: Note[]): Partial<TemplateRenderContext> {
  if (!notes || notes.length === 0) {
    return {
      notesList: "None Attested",
    };
  }

  // Sort by creation date (oldest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });

  const formatted = sortedNotes.map((note) => note.content);
  return {
    notesList: formatted.join("\n\n"),
  };
}

/**
 * Build template render context for AVS tracking section
 */
export function buildAVSTrackingContext(
  caseRecord: StoredCase["caseRecord"],
  resources: FinancialItem[]
): Partial<TemplateRenderContext> {
  const avsDates = calculateAVSTrackingDates(
    caseRecord.avsConsentDate,
    caseRecord.avsSubmitDate
  );
  const knownInstitutions = extractKnownInstitutions(resources);

  return {
    avsSubmitted: avsDates.submitDate,
    consentDate: avsDates.consentDate,
    fiveDayDate: avsDates.fiveDayDate,
    elevenDayDate: avsDates.elevenDayDate,
    knownInstitutions,
  };
}

/**
 * Build render context for any section type
 */
export function buildSectionContext(
  sectionKey: SummarySectionKey,
  caseData: StoredCase,
  financials?: {
    resources: FinancialItem[];
    income: FinancialItem[];
    expenses: FinancialItem[];
  },
  notes?: Note[]
): TemplateRenderContext {
  const { caseRecord, person } = caseData;

  switch (sectionKey) {
    case "caseInfo":
      return buildCaseInfoContext(caseRecord) as TemplateRenderContext;

    case "personInfo":
      return buildPersonInfoContext(person, caseRecord) as TemplateRenderContext;

    case "relationships":
      return buildRelationshipsContext(
        person.relationships
      ) as TemplateRenderContext;

    case "resources":
      return buildResourcesContext(
        financials?.resources || []
      ) as TemplateRenderContext;

    case "income":
      return buildIncomeContext(financials?.income || []) as TemplateRenderContext;

    case "expenses":
      return buildExpensesContext(
        financials?.expenses || []
      ) as TemplateRenderContext;

    case "notes":
      return buildNotesContext(notes || []) as TemplateRenderContext;

    case "avsTracking":
      return buildAVSTrackingContext(
        caseRecord,
        financials?.resources || []
      ) as TemplateRenderContext;

    default:
      return {} as TemplateRenderContext;
  }
}

/**
 * Render a summary section using a template
 */
export function renderSummarySection(
  templateContent: string,
  sectionKey: SummarySectionKey,
  caseData: StoredCase,
  financials?: {
    resources: FinancialItem[];
    income: FinancialItem[];
    expenses: FinancialItem[];
  },
  notes?: Note[]
): string {
  const context = buildSectionContext(sectionKey, caseData, financials, notes);
  return renderTemplate(templateContent, context);
}

// ============================================================================
// Section Builders (Legacy + Template Support)
// ============================================================================

/**
 * Build the Case Info section
 */
function buildCaseInfoSection(
  caseRecord: StoredCase["caseRecord"],
  templateContent?: string,
  caseData?: StoredCase
): string {
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, "caseInfo", caseData);
  }

  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.caseInfo;
    return renderSummarySection(defaultTemplate, "caseInfo", caseData);
  }

  // Fallback: legacy formatting
  const retroDisplay = formatRetroMonths(
    caseRecord.retroMonths,
    caseRecord.applicationDate
  );
  const lines = [
    `Application Date: ${formatDateMMDDYYYY(caseRecord.applicationDate)}`,
    `Retro Requested: ${retroDisplay}`,
    `Waiver Requested: ${caseRecord.withWaiver ? "Yes" : "No"}`,
  ];
  return lines.join("\n");
}

/**
 * Build the Person Info section
 */
function buildPersonInfoSection(
  person: StoredCase["person"],
  caseRecord: StoredCase["caseRecord"],
  templateContent?: string,
  caseData?: StoredCase
): string {
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, "personInfo", caseData);
  }

  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.personInfo;
    return renderSummarySection(defaultTemplate, "personInfo", caseData);
  }

  // Fallback: legacy formatting
  const age = calculateAge(person.dateOfBirth);
  const ageDisplay = age !== null ? `(${age})` : "";
  const fullName = `${person.firstName} ${person.lastName} ${ageDisplay}`.trim();
  const maritalStatus = caseRecord.maritalStatus || "Unknown";

  const contactParts: string[] = [];
  if (person.email) contactParts.push(person.email);
  if (person.phone) contactParts.push(formatPhoneNumber(person.phone));
  const contact =
    contactParts.length > 0 ? contactParts.join(" | ") : "No contact info";

  const voterStatus = formatVoterStatus(caseRecord.voterFormStatus);
  const nameLine = `${fullName} | ${maritalStatus}`;

  const lines = [
    nameLine,
    contact,
    `Citizenship Verified: ${caseRecord.citizenshipVerified ? "Yes" : "No"}`,
    `Aged/Disabled Verified: ${caseRecord.agedDisabledVerified ? "Yes" : "No"}`,
    `Living Arrangement: ${caseRecord.livingArrangement || "None Attested"}`,
    `Voter: ${voterStatus}`,
  ];
  return lines.join("\n");
}

/**
 * Build the Relationships section
 */
function buildRelationshipsSection(
  relationships?: Relationship[],
  templateContent?: string,
  caseData?: StoredCase
): string {
  const header = "Relationships/Representatives";

  if (templateContent && caseData) {
    return renderSummarySection(templateContent, "relationships", caseData);
  }

  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.relationships;
    return renderSummarySection(defaultTemplate, "relationships", caseData);
  }

  // Fallback: legacy formatting
  if (!relationships || relationships.length === 0) {
    return `${header}\nNone Attested`;
  }

  const formatted = relationships.map(formatRelationship);
  const relationshipsList = formatted.join("\n");
  return `${header}\n${relationshipsList}`;
}

/**
 * Build a financial section (Resources, Income, or Expenses)
 */
function buildFinancialSection(
  title: string,
  items: FinancialItem[],
  formatter: (item: FinancialItem) => string,
  templateContent?: string,
  sectionKey?: SummarySectionKey,
  caseData?: StoredCase,
  financials?: {
    resources: FinancialItem[];
    income: FinancialItem[];
    expenses: FinancialItem[];
  }
): string {
  if (templateContent && sectionKey && caseData) {
    return renderSummarySection(templateContent, sectionKey, caseData, financials);
  }

  if (sectionKey && caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES[sectionKey];
    return renderSummarySection(defaultTemplate, sectionKey, caseData, financials);
  }

  // Fallback: legacy formatting
  if (!items || items.length === 0) {
    return `${title}\nNone Attested`;
  }

  const formatted = items.map(formatter);
  const listContent = formatted.join("\n");
  return `${title}\n${listContent}`;
}

/**
 * Build the Notes section with MLTC prefix
 */
function buildNotesSection(
  notes: Note[],
  templateContent?: string,
  caseData?: StoredCase
): string {
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, "notes", caseData, undefined, notes);
  }

  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.notes;
    return renderSummarySection(defaultTemplate, "notes", caseData, undefined, notes);
  }

  // Fallback: legacy formatting
  if (!notes || notes.length === 0) {
    return "MLTC: None Attested";
  }

  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });

  const formatted = sortedNotes.map((note) => note.content);
  const notesList = formatted.join("\n\n");
  return `MLTC: ${notesList}`;
}

/**
 * Build the AVS Tracking section
 */
function buildAVSTrackingSection(
  caseRecord: StoredCase["caseRecord"],
  resources: FinancialItem[],
  templateContent?: string,
  caseData?: StoredCase,
  financials?: {
    resources: FinancialItem[];
    income: FinancialItem[];
    expenses: FinancialItem[];
  }
): string {
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, "avsTracking", caseData, financials);
  }

  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.avsTracking;
    return renderSummarySection(defaultTemplate, "avsTracking", caseData, financials);
  }

  // Fallback: legacy formatting
  const avsDates = calculateAVSTrackingDates(
    caseRecord.avsConsentDate,
    caseRecord.avsSubmitDate
  );
  const knownInstitutions = extractKnownInstitutions(resources);

  const lines = [
    `AVS Submitted: ${avsDates.submitDate}`,
    `Consent Date: ${avsDates.consentDate}`,
    `5 Day: ${avsDates.fiveDayDate}`,
    `11 Day: ${avsDates.elevenDayDate}`,
    `Known Institutions: ${knownInstitutions}`,
  ];
  return lines.join("\n");
}

// ============================================================================
// Summary Types and Constants
// ============================================================================

/**
 * Section visibility configuration for summary generation
 */
export interface SummarySections {
  caseInfo: boolean;
  personInfo: boolean;
  relationships: boolean;
  resources: boolean;
  income: boolean;
  expenses: boolean;
  notes: boolean;
  avsTracking: boolean;
}

/**
 * Default section visibility - all sections enabled
 */
export const DEFAULT_SUMMARY_SECTIONS: SummarySections = {
  caseInfo: true,
  personInfo: true,
  relationships: true,
  resources: true,
  income: true,
  expenses: true,
  notes: true,
  avsTracking: true,
};

// ============================================================================
// Main Summary Generator
// ============================================================================

/**
 * Generate a comprehensive case summary for sharing
 *
 * Format:
 * - Notes (with MLTC prefix)
 * - Case Info (Application Date, Retro, Waiver)
 * - Person Info (Name, Contact, Citizenship, Aged/Disabled)
 * - Relationships
 * - Resources
 * - Income
 * - Expenses
 * - AVS Tracking
 *
 * Sections separated by -----
 *
 * @param caseData - Case data to generate summary from
 * @param options - Optional configuration
 * @param options.financials - Financial items (resources, income, expenses)
 * @param options.notes - Case notes
 * @param options.sections - Section visibility configuration
 * @param options.templates - Template content strings or Template objects with .template property
 * @param options.templateObjects - Full Template objects from TemplateService (preferred over templates)
 * @param options.sectionOrder - Custom section order (from template sortOrder)
 */
export function generateCaseSummary(
  caseData: StoredCase,
  options?: {
    financials?: {
      resources: FinancialItem[];
      income: FinancialItem[];
      expenses: FinancialItem[];
    };
    notes?: Note[];
    sections?: SummarySections;
    templates?: Partial<Record<string, string>>;
    templateObjects?: Partial<Record<SummarySectionKey, Template>>;
    sectionOrder?: SummarySectionKey[];
  }
): string {
  const { caseRecord, person } = caseData;
  const financials = options?.financials ?? {
    resources: [],
    income: [],
    expenses: [],
  };
  const notes = options?.notes ?? [];
  const sectionConfig = options?.sections ?? DEFAULT_SUMMARY_SECTIONS;

  // Default section order
  const defaultOrder: SummarySectionKey[] = [
    "notes",
    "caseInfo",
    "personInfo",
    "relationships",
    "resources",
    "income",
    "expenses",
    "avsTracking",
  ];
  const sectionOrder = options?.sectionOrder ?? defaultOrder;

  // Extract template content strings from either templates or templateObjects
  const getTemplateContent = (key: SummarySectionKey): string | undefined => {
    // Prefer templateObjects (new approach)
    if (options?.templateObjects?.[key]) {
      return options.templateObjects[key]?.template;
    }
    // Fallback to templates (legacy)
    return options?.templates?.[key];
  };

  // Build section by key
  const buildSection = (key: SummarySectionKey): string | null => {
    if (!sectionConfig[key]) return null;

    switch (key) {
      case "notes":
        return buildNotesSection(notes, getTemplateContent("notes"), caseData);
      case "caseInfo":
        return buildCaseInfoSection(
          caseRecord,
          getTemplateContent("caseInfo"),
          caseData
        );
      case "personInfo":
        return buildPersonInfoSection(
          person,
          caseRecord,
          getTemplateContent("personInfo"),
          caseData
        );
      case "relationships":
        return buildRelationshipsSection(
          person.relationships,
          getTemplateContent("relationships"),
          caseData
        );
      case "resources":
        return buildFinancialSection(
          "Resources",
          financials.resources || [],
          formatResourceItem,
          getTemplateContent("resources"),
          "resources",
          caseData,
          financials
        );
      case "income":
        return buildFinancialSection(
          "Income",
          financials.income || [],
          formatIncomeItem,
          getTemplateContent("income"),
          "income",
          caseData,
          financials
        );
      case "expenses":
        return buildFinancialSection(
          "Expenses",
          financials.expenses || [],
          formatExpenseItem,
          getTemplateContent("expenses"),
          "expenses",
          caseData,
          financials
        );
      case "avsTracking":
        return buildAVSTrackingSection(
          caseRecord,
          financials.resources || [],
          getTemplateContent("avsTracking"),
          caseData,
          financials
        );
      default:
        return null;
    }
  };

  // Build sections in specified order
  const enabledSections: string[] = [];
  for (const key of sectionOrder) {
    const section = buildSection(key);
    if (section) {
      enabledSections.push(section);
    }
  }

  return enabledSections.join(SECTION_SEPARATOR);
}
