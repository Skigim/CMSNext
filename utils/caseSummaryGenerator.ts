/**
 * Case Summary Generator
 * ======================
 * Generates a plain-text summary of case information for easy export/sharing.
 * Designed for copy-paste into emails, ticketing systems, or documents.
 * 
 * Now integrated with the Template system for customizable section rendering.
 */

import { StoredCase, FinancialItem, Note, Relationship } from '../types/case';
import {
  formatRetroMonths,
  calculateAge,
  formatVoterStatus,
  calculateAVSTrackingDates,
  extractKnownInstitutions,
} from '@/domain/cases';
import type { Template } from '@/types/template';
import type { SummarySectionKey } from '@/types/categoryConfig';
import { DEFAULT_SUMMARY_SECTION_TEMPLATES } from '@/types/template';
import { renderSummarySection } from './summarySectionRenderer';
import { formatDateForDisplay } from '@/utils/dateFormatting';

const SECTION_SEPARATOR = '\n-----\n';

/**
 * Default templates for each section
 * @deprecated Use DEFAULT_SUMMARY_SECTION_TEMPLATES from @/types/template instead
 */
export const DEFAULT_SECTION_TEMPLATES = {
  caseInfo: DEFAULT_SUMMARY_SECTION_TEMPLATES.caseInfo,
  personInfo: DEFAULT_SUMMARY_SECTION_TEMPLATES.personInfo,
  relationships: DEFAULT_SUMMARY_SECTION_TEMPLATES.relationships,
  resources: DEFAULT_SUMMARY_SECTION_TEMPLATES.resources,
  income: DEFAULT_SUMMARY_SECTION_TEMPLATES.income,
  expenses: DEFAULT_SUMMARY_SECTION_TEMPLATES.expenses,
  notes: DEFAULT_SUMMARY_SECTION_TEMPLATES.notes,
  avsTracking: DEFAULT_SUMMARY_SECTION_TEMPLATES.avsTracking,
};

/**
 * Format a date string to MM/DD/YYYY using centralized utility
 */
function formatDateMMDDYYYY(dateString: string | null | undefined): string {
  const result = formatDateForDisplay(dateString);
  return result === 'None' ? 'None Attested' : result;
}

/**
 * Format currency as $1,500.00
 */
function formatCurrencyAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format frequency for display (e.g., "Monthly" -> "/Monthly")
 */
function formatFrequencyDisplay(frequency?: string): string {
  if (!frequency) return '';
  // Capitalize first letter
  const formatted = frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
  return `/${formatted}`;
}

/**
 * Format phone number as (XXX) XXX-XXXX
 */
function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle 10-digit US phone numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Handle 11-digit with leading 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if not a standard format
  return phone;
}

/**
 * Format a resource item:
 * Description Account Number w/ Institution/Location - Amount (Verification Source or Status)
 */
export function formatResourceItem(item: FinancialItem): string {
  const parts: string[] = [];
  
  // Description
  parts.push(item.description || 'Unnamed');
  
  // Account Number (if present)
  if (item.accountNumber) {
    parts.push(` ${item.accountNumber}`);
  }
  
  // Institution/Location (if present)
  if (item.location) {
    parts.push(` w/ ${item.location}`);
  }
  
  // Amount
  parts.push(` - ${formatCurrencyAmount(item.amount)}`);
  
  // Verification source (if verified) or status
  if (item.verificationStatus === 'Verified' && item.verificationSource) {
    parts.push(` (${item.verificationSource})`);
  } else if (item.verificationStatus || item.status) {
    parts.push(` (${item.verificationStatus || item.status})`);
  }
  
  return parts.join('');
}

/**
 * Format an income item:
 * Description from Institution - Amount/Frequency (Verification Source or Status)
 */
export function formatIncomeItem(item: FinancialItem): string {
  const parts: string[] = [];
  
  // Description
  parts.push(item.description || 'Unnamed');
  
  // Institution/Location (if present) - use "from" for income
  if (item.location) {
    parts.push(` from ${item.location}`);
  }
  
  // Amount with frequency
  parts.push(` - ${formatCurrencyAmount(item.amount)}${formatFrequencyDisplay(item.frequency)}`);
  
  // Verification source (if verified) or status
  if (item.verificationStatus === 'Verified' && item.verificationSource) {
    parts.push(` (${item.verificationSource})`);
  } else if (item.verificationStatus || item.status) {
    parts.push(` (${item.verificationStatus || item.status})`);
  }
  
  return parts.join('');
}

/**
 * Format an expense item:
 * Description to Institution - Amount/Frequency (Verification Source or Status)
 */
export function formatExpenseItem(item: FinancialItem): string {
  const parts: string[] = [];
  
  // Description
  parts.push(item.description || 'Unnamed');
  
  // Institution/Location (if present) - use "to" for expenses
  if (item.location) {
    parts.push(` to ${item.location}`);
  }
  
  // Amount with frequency
  parts.push(` - ${formatCurrencyAmount(item.amount)}${formatFrequencyDisplay(item.frequency)}`);
  
  // Verification source (if verified) or status
  if (item.verificationStatus === 'Verified' && item.verificationSource) {
    parts.push(` (${item.verificationSource})`);
  } else if (item.verificationStatus || item.status) {
    parts.push(` (${item.verificationStatus || item.status})`);
  }
  
  return parts.join('');
}

/**
 * Format a relationship: Type | Name | Phone
 */
function formatRelationship(rel: Relationship): string {
  const parts = [rel.type || 'Unknown', rel.name || 'Unknown'];
  if (rel.phone) {
    parts.push(formatPhoneNumber(rel.phone));
  }
  return parts.join(' | ');
}

/**
 * Build the Case Info section
 */
function buildCaseInfoSection(
  caseRecord: StoredCase['caseRecord'],
  templateContent?: string,
  caseData?: StoredCase
): string {
  // Use template renderer if template and full case data provided
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, 'caseInfo', caseData);
  }
  
  // Use default template if full case data provided
  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.caseInfo;
    return renderSummarySection(defaultTemplate, 'caseInfo', caseData);
  }
  
  // Fallback: legacy formatting
  const retroDisplay = formatRetroMonths(caseRecord.retroMonths, caseRecord.applicationDate);
  const lines = [
    `Application Date: ${formatDateMMDDYYYY(caseRecord.applicationDate)}`,
    `Retro Requested: ${retroDisplay}`,
    `Waiver Requested: ${caseRecord.withWaiver ? 'Yes' : 'No'}`,
  ];
  return lines.join('\n');
}

/**
 * Build the Person Info section
 */
function buildPersonInfoSection(
  person: StoredCase['person'],
  caseRecord: StoredCase['caseRecord'],
  templateContent?: string,
  caseData?: StoredCase
): string {
  // Use template renderer if template and full case data provided
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, 'personInfo', caseData);
  }
  
  // Use default template if full case data provided
  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.personInfo;
    return renderSummarySection(defaultTemplate, 'personInfo', caseData);
  }
  
  // Fallback: legacy formatting
  const age = calculateAge(person.dateOfBirth);
  const ageDisplay = age !== null ? `(${age})` : '';
  const fullName = `${person.firstName} ${person.lastName} ${ageDisplay}`.trim();
  const maritalStatus = caseRecord.maritalStatus || 'Unknown';
  
  const contactParts: string[] = [];
  if (person.email) contactParts.push(person.email);
  if (person.phone) contactParts.push(formatPhoneNumber(person.phone));
  const contact = contactParts.length > 0 ? contactParts.join(' | ') : 'No contact info';
  
  const voterStatus = formatVoterStatus(caseRecord.voterFormStatus);
  const nameLine = `${fullName} | ${maritalStatus}`;
  
  const lines = [
    nameLine,
    contact,
    `Citizenship Verified: ${caseRecord.citizenshipVerified ? 'Yes' : 'No'}`,
    `Aged/Disabled Verified: ${caseRecord.agedDisabledVerified ? 'Yes' : 'No'}`,
    `Living Arrangement: ${caseRecord.livingArrangement || 'None Attested'}`,
    `Voter: ${voterStatus}`,
  ];
  return lines.join('\n');
}

/**
 * Build the Relationships section
 */
function buildRelationshipsSection(
  relationships?: Relationship[],
  templateContent?: string,
  caseData?: StoredCase
): string {
  const header = 'Relationships/Representatives';
  
  // Use template renderer if template and full case data provided
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, 'relationships', caseData);
  }
  
  // Use default template if full case data provided
  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.relationships;
    return renderSummarySection(defaultTemplate, 'relationships', caseData);
  }
  
  // Fallback: legacy formatting
  if (!relationships || relationships.length === 0) {
    return `${header}\nNone Attested`;
  }
  
  const formatted = relationships.map(formatRelationship);
  const relationshipsList = formatted.join('\n');
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
  financials?: { resources: FinancialItem[]; income: FinancialItem[]; expenses: FinancialItem[] }
): string {
  // Use template renderer if template, section key, and full case data provided
  if (templateContent && sectionKey && caseData) {
    return renderSummarySection(templateContent, sectionKey, caseData, financials);
  }
  
  // Use default template if section key and full case data provided
  if (sectionKey && caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES[sectionKey];
    return renderSummarySection(defaultTemplate, sectionKey, caseData, financials);
  }
  
  // Fallback: legacy formatting
  if (!items || items.length === 0) {
    return `${title}\nNone Attested`;
  }
  
  const formatted = items.map(formatter);
  const listContent = formatted.join('\n');
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
  // Use template renderer if template and full case data provided
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, 'notes', caseData, undefined, notes);
  }
  
  // Use default template if full case data provided
  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.notes;
    return renderSummarySection(defaultTemplate, 'notes', caseData, undefined, notes);
  }
  
  // Fallback: legacy formatting
  if (!notes || notes.length === 0) {
    return 'MLTC: None Attested';
  }
  
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
  
  const formatted = sortedNotes.map(note => note.content);
  const notesList = formatted.join('\n\n');
  return `MLTC: ${notesList}`;
}

/**
 * Build the AVS Tracking section
 */
function buildAVSTrackingSection(
  caseRecord: StoredCase['caseRecord'],
  resources: FinancialItem[],
  templateContent?: string,
  caseData?: StoredCase,
  financials?: { resources: FinancialItem[]; income: FinancialItem[]; expenses: FinancialItem[] }
): string {
  // Use template renderer if template and full case data provided
  if (templateContent && caseData) {
    return renderSummarySection(templateContent, 'avsTracking', caseData, financials);
  }
  
  // Use default template if full case data provided
  if (caseData) {
    const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES.avsTracking;
    return renderSummarySection(defaultTemplate, 'avsTracking', caseData, financials);
  }
  
  // Fallback: legacy formatting
  const avsDates = calculateAVSTrackingDates(caseRecord.avsConsentDate);
  const knownInstitutions = extractKnownInstitutions(resources);
  
  const lines = [
    `AVS Submitted: ${avsDates.submitDate}`,
    `Consent Date: ${avsDates.consentDate}`,
    `5 Day: ${avsDates.fiveDayDate}`,
    `11 Day: ${avsDates.elevenDayDate}`,
    `Known Institutions: ${knownInstitutions}`,
  ];
  return lines.join('\n');
}

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
    financials?: { resources: FinancialItem[]; income: FinancialItem[]; expenses: FinancialItem[] };
    notes?: Note[];
    sections?: SummarySections;
    templates?: Partial<Record<string, string>>;
    templateObjects?: Partial<Record<SummarySectionKey, Template>>;
    sectionOrder?: SummarySectionKey[];
  }
): string {
  const { caseRecord, person } = caseData;
  const financials = options?.financials ?? { resources: [], income: [], expenses: [] };
  const notes = options?.notes ?? [];
  const sectionConfig = options?.sections ?? DEFAULT_SUMMARY_SECTIONS;
  
  // Default section order
  const defaultOrder: SummarySectionKey[] = [
    'notes', 'caseInfo', 'personInfo', 'relationships',
    'resources', 'income', 'expenses', 'avsTracking'
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
      case 'notes':
        return buildNotesSection(notes, getTemplateContent('notes'), caseData);
      case 'caseInfo':
        return buildCaseInfoSection(caseRecord, getTemplateContent('caseInfo'), caseData);
      case 'personInfo':
        return buildPersonInfoSection(person, caseRecord, getTemplateContent('personInfo'), caseData);
      case 'relationships':
        return buildRelationshipsSection(person.relationships, getTemplateContent('relationships'), caseData);
      case 'resources':
        return buildFinancialSection('Resources', financials.resources || [], formatResourceItem, 
          getTemplateContent('resources'), 'resources', caseData, financials);
      case 'income':
        return buildFinancialSection('Income', financials.income || [], formatIncomeItem, 
          getTemplateContent('income'), 'income', caseData, financials);
      case 'expenses':
        return buildFinancialSection('Expenses', financials.expenses || [], formatExpenseItem, 
          getTemplateContent('expenses'), 'expenses', caseData, financials);
      case 'avsTracking':
        return buildAVSTrackingSection(caseRecord, financials.resources || [], 
          getTemplateContent('avsTracking'), caseData, financials);
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
