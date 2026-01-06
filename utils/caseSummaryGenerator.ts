/**
 * Case Summary Generator
 * ======================
 * Generates a plain-text summary of case information for easy export/sharing.
 * Designed for copy-paste into emails, ticketing systems, or documents.
 */

import { StoredCase, FinancialItem, Note, Relationship } from '../types/case';
import {
  formatRetroMonths,
  calculateAge,
  formatVoterStatus,
  calculateAVSTrackingDates,
  extractKnownInstitutions,
} from '@/domain/cases';
import type { SectionTemplate } from '@/types/categoryConfig';

const SECTION_SEPARATOR = '\n-----\n';

/**
 * Template variable renderer - replaces {{variable}} with actual values
 */
function renderTemplate(template: string, variables: Record<string, string | number | boolean | null | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === null || value === undefined) {
      return 'None Attested';
    }
    return String(value);
  });
}

/**
 * Default templates for each section
 */
export const DEFAULT_SECTION_TEMPLATES = {
  caseInfo: `Application Date: {{applicationDate}}
Retro Requested: {{retroDisplay}}
Waiver Requested: {{withWaiver}}`,
  
  personInfo: `{{fullName}} | {{maritalStatus}}
{{contact}}
Citizenship Verified: {{citizenshipVerified}}
Aged/Disabled Verified: {{agedDisabledVerified}}
Living Arrangement: {{livingArrangement}}
Voter: {{voterStatus}}`,
  
  relationships: `Relationships/Representatives
{{relationshipsList}}`,
  
  resources: `Resources
{{resourcesList}}`,
  
  income: `Income
{{incomeList}}`,
  
  expenses: `Expenses
{{expensesList}}`,
  
  notes: `MLTC: {{notesList}}`,
  
  avsTracking: `AVS Submitted: {{avsSubmitted}}
Consent Date: {{consentDate}}
5 Day: {{fiveDayDate}}
11 Day: {{elevenDayDate}}
Known Institutions: {{knownInstitutions}}`,
};

/**
 * Format a date string to MM/DD/YYYY
 */
function formatDateMMDDYYYY(dateString: string | null | undefined): string {
  if (!dateString) return 'None Attested';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'None Attested';
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  } catch {
    return 'None Attested';
  }
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
function buildCaseInfoSection(caseRecord: StoredCase['caseRecord'], template?: SectionTemplate): string {
  const retroDisplay = formatRetroMonths(caseRecord.retroMonths, caseRecord.applicationDate);
  
  if (template) {
    const retroMonths = typeof caseRecord.retroMonths === 'number' ? caseRecord.retroMonths : 0;
    return renderTemplate(template, {
      applicationDate: formatDateMMDDYYYY(caseRecord.applicationDate),
      retroDisplay,
      withWaiver: caseRecord.withWaiver ? 'Yes' : 'No',
      retroMonths,
    });
  }
  
  // Default formatting
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
function buildPersonInfoSection(person: StoredCase['person'], caseRecord: StoredCase['caseRecord'], template?: SectionTemplate): string {
  // Prepare variables
  const age = calculateAge(person.dateOfBirth);
  const ageDisplay = age !== null ? `(${age})` : '';
  const maritalStatus = caseRecord.maritalStatus || 'Unknown';
  const fullName = `${person.firstName} ${person.lastName} ${ageDisplay}`.trim();
  
  const contactParts: string[] = [];
  if (person.email) contactParts.push(person.email);
  if (person.phone) contactParts.push(formatPhoneNumber(person.phone));
  const contact = contactParts.length > 0 ? contactParts.join(' | ') : 'No contact info';
  
  const voterStatus = formatVoterStatus(caseRecord.voterFormStatus);
  
  if (template) {
    return renderTemplate(template, {
      firstName: person.firstName,
      lastName: person.lastName,
      age,
      ageDisplay,
      fullName,
      maritalStatus,
      contact,
      email: person.email,
      phone: formatPhoneNumber(person.phone),
      citizenshipVerified: caseRecord.citizenshipVerified ? 'Yes' : 'No',
      agedDisabledVerified: caseRecord.agedDisabledVerified ? 'Yes' : 'No',
      livingArrangement: caseRecord.livingArrangement || 'None Attested',
      voterStatus,
    });
  }
  
  // Default formatting
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
function buildRelationshipsSection(relationships?: Relationship[], template?: SectionTemplate): string {
  const header = 'Relationships/Representatives';
  
  if (!relationships || relationships.length === 0) {
    const relationshipsList = 'None Attested';
    if (template) {
      return renderTemplate(template, { relationshipsList });
    }
    return `${header}\nNone Attested`;
  }
  
  const formatted = relationships.map(formatRelationship);
  const relationshipsList = formatted.join('\n');
  
  if (template) {
    return renderTemplate(template, { relationshipsList });
  }
  
  return `${header}\n${relationshipsList}`;
}

/**
 * Build a financial section (Resources, Income, or Expenses)
 */
function buildFinancialSection(
  title: string,
  items: FinancialItem[],
  formatter: (item: FinancialItem) => string,
  template?: SectionTemplate
): string {
  if (!items || items.length === 0) {
    const listVarName = title.toLowerCase() === 'resources' ? 'resourcesList' : 
                        title.toLowerCase() === 'income' ? 'incomeList' : 'expensesList';
    if (template) {
      return renderTemplate(template, { [listVarName]: 'None Attested' });
    }
    return `${title}\nNone Attested`;
  }
  
  const formatted = items.map(formatter);
  const listContent = formatted.join('\n');
  
  if (template) {
    const listVarName = title.toLowerCase() === 'resources' ? 'resourcesList' : 
                        title.toLowerCase() === 'income' ? 'incomeList' : 'expensesList';
    return renderTemplate(template, { [listVarName]: listContent });
  }
  
  return `${title}\n${listContent}`;
}

/**
 * Build the Notes section with MLTC prefix
 */
function buildNotesSection(notes: Note[], template?: SectionTemplate): string {
  if (!notes || notes.length === 0) {
    const notesList = 'None Attested';
    if (template) {
      return renderTemplate(template, { notesList });
    }
    return 'MLTC: None Attested';
  }
  
  // Sort by creation date (oldest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
  
  // Full content, separated by blank lines
  const formatted = sortedNotes.map(note => note.content);
  const notesList = formatted.join('\n\n');
  
  if (template) {
    return renderTemplate(template, { notesList });
  }
  
  // Default: MLTC prefix
  return `MLTC: ${notesList}`;
}

/**
 * Build the AVS Tracking section
 */
function buildAVSTrackingSection(caseRecord: StoredCase['caseRecord'], resources: FinancialItem[], template?: SectionTemplate): string {
  const avsDates = calculateAVSTrackingDates(caseRecord.avsConsentDate);
  const knownInstitutions = extractKnownInstitutions(resources);
  
  if (template) {
    return renderTemplate(template, {
      avsSubmitted: avsDates.submitDate,
      consentDate: avsDates.consentDate,
      fiveDayDate: avsDates.fiveDayDate,
      elevenDayDate: avsDates.elevenDayDate,
      knownInstitutions,
    });
  }
  
  // Default formatting
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
 * 
 * Sections separated by -----
 */
export function generateCaseSummary(
  caseData: StoredCase, 
  options?: {
    financials?: { resources: FinancialItem[]; income: FinancialItem[]; expenses: FinancialItem[] };
    notes?: Note[];
    sections?: SummarySections;
    templates?: Partial<Record<string, SectionTemplate>>;
  }
): string {
  const { caseRecord, person } = caseData;
  const financials = options?.financials ?? { resources: [], income: [], expenses: [] };
  const notes = options?.notes ?? [];
  const sectionConfig = options?.sections ?? DEFAULT_SUMMARY_SECTIONS;
  const templates = options?.templates ?? {};
  
  const enabledSections: string[] = [];
  
  if (sectionConfig.notes) {
    enabledSections.push(buildNotesSection(notes, templates.notes));
  }
  if (sectionConfig.caseInfo) {
    enabledSections.push(buildCaseInfoSection(caseRecord, templates.caseInfo));
  }
  if (sectionConfig.personInfo) {
    enabledSections.push(buildPersonInfoSection(person, caseRecord, templates.personInfo));
  }
  if (sectionConfig.relationships) {
    enabledSections.push(buildRelationshipsSection(person.relationships, templates.relationships));
  }
  if (sectionConfig.resources) {
    enabledSections.push(buildFinancialSection('Resources', financials.resources || [], formatResourceItem, templates.resources));
  }
  if (sectionConfig.income) {
    enabledSections.push(buildFinancialSection('Income', financials.income || [], formatIncomeItem, templates.income));
  }
  if (sectionConfig.expenses) {
    enabledSections.push(buildFinancialSection('Expenses', financials.expenses || [], formatExpenseItem, templates.expenses));
  }
  if (sectionConfig.avsTracking) {
    enabledSections.push(buildAVSTrackingSection(caseRecord, financials.resources || [], templates.avsTracking));
  }

  return enabledSections.join(SECTION_SEPARATOR);
}
