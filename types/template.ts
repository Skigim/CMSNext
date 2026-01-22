/**
 * Unified Template System
 * =======================
 * A single template schema used across VR, Summary, and Narrative templates.
 * Templates are stored in NormalizedFileData.templates and managed by TemplateContext.
 */

import type { SummarySectionKey } from './categoryConfig';

// =============================================================================
// Template Categories
// =============================================================================

/**
 * Template categories determine where the template appears in the UI
 * and what placeholder fields are available.
 */
export type TemplateCategory = 'vr' | 'summary' | 'narrative';

/**
 * Human-readable labels for template categories.
 */
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  vr: 'Verification Request',
  summary: 'Case Summary',
  narrative: 'Narrative',
};

// =============================================================================
// Template Interface
// =============================================================================

/**
 * Unified template interface.
 * All templates use the same structure regardless of category.
 */
export interface Template {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name for the template */
  name: string;
  /** Category determines UI placement and available placeholders */
  category: TemplateCategory;
  /** 
   * Template content with {field} placeholders.
   * Supports date offsets: {currentDate+30}, {applicationDate-7}
   */
  template: string;
  /** 
   * For summary templates: which section this template is for.
   * Only used when category === 'summary'.
   */
  sectionKey?: SummarySectionKey;
  /**
   * Sort order for templates within a category.
   * Lower numbers appear first. Used for drag-drop reordering.
   */
  sortOrder?: number;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last modified */
  updatedAt: string;
}

// =============================================================================
// Placeholder Fields
// =============================================================================

/**
 * Placeholder field definition for template editor UI.
 */
export interface PlaceholderField {
  /** Display label in the UI */
  label: string;
  /** Grouping category for the placeholder palette */
  fieldCategory: string;
  /** Which template categories this field is available for */
  availableFor: TemplateCategory[];
}

/**
 * All available placeholder fields that can be used in templates.
 * Fields are derived from FinancialItem, Case, Person, and System data.
 * 
 * Syntax: {fieldName} or {fieldName+N} / {fieldName-N} for date offsets
 */
export const TEMPLATE_PLACEHOLDER_FIELDS: Record<string, PlaceholderField> = {
  // -------------------------------------------------------------------------
  // Financial Item Fields (VR templates only)
  // -------------------------------------------------------------------------
  description: { 
    label: "Description", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  accountNumber: { 
    label: "Account Number", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  amount: { 
    label: "Current Amount", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  location: { 
    label: "Location/Institution", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  owner: { 
    label: "Account Owner", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  frequency: { 
    label: "Frequency", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  verificationStatus: { 
    label: "Verification Status", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  verificationSource: { 
    label: "Verification Source", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  dateAdded: { 
    label: "Date Added", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  itemNotes: { 
    label: "Item Notes", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },
  itemType: { 
    label: "Item Type", 
    fieldCategory: "Financial Item",
    availableFor: ['vr'],
  },

  // -------------------------------------------------------------------------
  // Amount History Fields (VR templates only)
  // -------------------------------------------------------------------------
  lastUpdated: { 
    label: "Last Updated Date", 
    fieldCategory: "Amount History",
    availableFor: ['vr'],
  },
  lastVerified: { 
    label: "Last Verified Date", 
    fieldCategory: "Amount History",
    availableFor: ['vr'],
  },
  historyVerificationSource: { 
    label: "History Verification Source", 
    fieldCategory: "Amount History",
    availableFor: ['vr'],
  },

  // -------------------------------------------------------------------------
  // Case Fields (All templates)
  // -------------------------------------------------------------------------
  caseName: { 
    label: "Client Name", 
    fieldCategory: "Case",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  caseNumber: { 
    label: "Case Number (MCN)", 
    fieldCategory: "Case",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  caseType: { 
    label: "Case Type", 
    fieldCategory: "Case",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  applicationDate: { 
    label: "Application Date", 
    fieldCategory: "Case",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  caseStatus: { 
    label: "Case Status", 
    fieldCategory: "Case",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  retroDisplay: {
    label: "Retro Months Display",
    fieldCategory: "Case",
    availableFor: ['summary', 'narrative'],
  },
  withWaiver: {
    label: "Waiver Requested",
    fieldCategory: "Case",
    availableFor: ['summary', 'narrative'],
  },

  // -------------------------------------------------------------------------
  // Person Fields (All templates)
  // -------------------------------------------------------------------------
  clientFirstName: { 
    label: "Client First Name", 
    fieldCategory: "Person",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  clientLastName: { 
    label: "Client Last Name", 
    fieldCategory: "Person",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  fullName: {
    label: "Full Name (with age)",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  age: {
    label: "Age",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  clientPhone: { 
    label: "Client Phone", 
    fieldCategory: "Person",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  clientEmail: { 
    label: "Client Email", 
    fieldCategory: "Person",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  clientSSN: { 
    label: "Client SSN", 
    fieldCategory: "Person",
    availableFor: ['vr'],
  },
  clientDOB: { 
    label: "Client Date of Birth", 
    fieldCategory: "Person",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  clientAddress: { 
    label: "Client Address", 
    fieldCategory: "Person",
    availableFor: ['vr', 'summary', 'narrative'],
  },
  maritalStatus: {
    label: "Marital Status",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  contact: {
    label: "Contact Info",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  citizenshipVerified: {
    label: "Citizenship Verified",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  agedDisabledVerified: {
    label: "Aged/Disabled Verified",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  livingArrangement: {
    label: "Living Arrangement",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },
  voterStatus: {
    label: "Voter Status",
    fieldCategory: "Person",
    availableFor: ['summary', 'narrative'],
  },

  // -------------------------------------------------------------------------
  // Summary Section Lists (Summary templates only)
  // -------------------------------------------------------------------------
  notesList: {
    label: "Notes List",
    fieldCategory: "Summary Sections",
    availableFor: ['summary'],
  },
  relationshipsList: {
    label: "Relationships List",
    fieldCategory: "Summary Sections",
    availableFor: ['summary'],
  },
  resourcesList: {
    label: "Resources List",
    fieldCategory: "Summary Sections",
    availableFor: ['summary'],
  },
  incomeList: {
    label: "Income List",
    fieldCategory: "Summary Sections",
    availableFor: ['summary'],
  },
  expensesList: {
    label: "Expenses List",
    fieldCategory: "Summary Sections",
    availableFor: ['summary'],
  },

  // -------------------------------------------------------------------------
  // AVS Tracking (Summary templates only)
  // -------------------------------------------------------------------------
  avsSubmitted: {
    label: "AVS Submitted Date",
    fieldCategory: "AVS Tracking",
    availableFor: ['summary'],
  },
  consentDate: {
    label: "Consent Date",
    fieldCategory: "AVS Tracking",
    availableFor: ['summary'],
  },
  fiveDayDate: {
    label: "5 Day Date",
    fieldCategory: "AVS Tracking",
    availableFor: ['summary'],
  },
  elevenDayDate: {
    label: "11 Day Date",
    fieldCategory: "AVS Tracking",
    availableFor: ['summary'],
  },
  knownInstitutions: {
    label: "Known Institutions",
    fieldCategory: "AVS Tracking",
    availableFor: ['summary'],
  },

  // -------------------------------------------------------------------------
  // System Fields (All templates)
  // -------------------------------------------------------------------------
  currentDate: { 
    label: "Current Date", 
    fieldCategory: "System",
    availableFor: ['vr', 'summary', 'narrative'],
  },
} as const;

export type TemplatePlaceholderField = keyof typeof TEMPLATE_PLACEHOLDER_FIELDS;

// =============================================================================
// Render Context
// =============================================================================

/**
 * Context data passed to the template renderer for placeholder substitution.
 * All fields are optional - the renderer will use empty string for missing values.
 */
export interface TemplateRenderContext {
  // Financial item data (VR only)
  description?: string;
  accountNumber?: string;
  amount?: number;
  location?: string;
  owner?: string;
  frequency?: string;
  verificationStatus?: string;
  verificationSource?: string;
  dateAdded?: string;
  itemNotes?: string;
  itemType?: string;
  
  // Amount history (VR only)
  lastUpdated?: string;
  lastVerified?: string;
  historyVerificationSource?: string;
  
  // Case data
  caseName?: string;
  caseNumber?: string;
  caseType?: string;
  applicationDate?: string;
  caseStatus?: string;
  retroDisplay?: string;
  withWaiver?: string;
  
  // Person data
  clientFirstName?: string;
  clientLastName?: string;
  fullName?: string;
  age?: number | null;
  clientPhone?: string;
  clientEmail?: string;
  clientSSN?: string;
  clientDOB?: string;
  clientAddress?: string;
  maritalStatus?: string;
  contact?: string;
  citizenshipVerified?: string;
  agedDisabledVerified?: string;
  livingArrangement?: string;
  voterStatus?: string;
  
  // Summary section lists
  notesList?: string;
  relationshipsList?: string;
  resourcesList?: string;
  incomeList?: string;
  expensesList?: string;
  
  // AVS tracking
  avsSubmitted?: string;
  consentDate?: string;
  fiveDayDate?: string;
  elevenDayDate?: string;
  knownInstitutions?: string;
  
  // System
  currentDate?: string;
}

/**
 * Result of rendering a template for a specific item.
 */
export interface RenderedTemplate {
  /** The template ID used */
  templateId: string;
  /** Optional: The item ID this was generated from (for VR) */
  itemId?: string;
  /** The final rendered text with all placeholders filled */
  text: string;
}

// =============================================================================
// Default Summary Section Templates
// =============================================================================

/**
 * Default templates for each summary section.
 * These are used when no custom template is configured.
 */
export const DEFAULT_SUMMARY_SECTION_TEMPLATES: Record<SummarySectionKey, string> = {
  caseInfo: `Application Date: {applicationDate}
Retro Requested: {retroDisplay}
Waiver Requested: {withWaiver}`,
  
  personInfo: `{fullName} | {maritalStatus}
{contact}
Citizenship Verified: {citizenshipVerified}
Aged/Disabled Verified: {agedDisabledVerified}
Living Arrangement: {livingArrangement}
Voter: {voterStatus}`,
  
  relationships: `Relationships/Representatives
{relationshipsList}`,
  
  resources: `Resources
{resourcesList}`,
  
  income: `Income
{incomeList}`,
  
  expenses: `Expenses
{expensesList}`,
  
  notes: `MLTC: {notesList}`,
  
  avsTracking: `AVS Submitted: {avsSubmitted}
Consent Date: {consentDate}
5 Day: {fiveDayDate}
11 Day: {elevenDayDate}
Known Institutions: {knownInstitutions}`,
};
