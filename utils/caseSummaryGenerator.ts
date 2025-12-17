/**
 * Case Summary Generator
 * ======================
 * Generates a plain-text summary of case information for easy export/sharing.
 * Designed for copy-paste into emails, ticketing systems, or documents.
 */

import { StoredCase, FinancialItem, Note, Relationship } from '../types/case';

const SECTION_SEPARATOR = '\n-----\n';

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
function buildCaseInfoSection(caseRecord: StoredCase['caseRecord']): string {
  const lines = [
    `Application Date: ${formatDateMMDDYYYY(caseRecord.applicationDate)}`,
    `Retro Requested: ${caseRecord.retroRequested || 'None Attested'}`,
    `Waiver Requested: ${caseRecord.withWaiver ? 'Yes' : 'No'}`,
  ];
  return lines.join('\n');
}

/**
 * Build the Person Info section
 */
function buildPersonInfoSection(person: StoredCase['person'], caseRecord: StoredCase['caseRecord']): string {
  const nameLine = `${person.firstName} ${person.lastName}`;
  
  const contactParts: string[] = [];
  if (person.email) contactParts.push(person.email);
  if (person.phone) contactParts.push(formatPhoneNumber(person.phone));
  const contactLine = contactParts.length > 0 ? contactParts.join(' | ') : 'No contact info';
  
  const lines = [
    nameLine,
    contactLine,
    `Citizenship Verified: ${caseRecord.citizenshipVerified ? 'Yes' : 'No'}`,
    `Aged/Disabled Verified: ${caseRecord.agedDisabledVerified ? 'Yes' : 'No'}`,
    `Living Arrangement: ${caseRecord.livingArrangement || 'None Attested'}`,
  ];
  return lines.join('\n');
}

/**
 * Build the Relationships section
 */
function buildRelationshipsSection(relationships?: Relationship[]): string {
  const header = 'Relationships';
  
  if (!relationships || relationships.length === 0) {
    return `${header}\nNone Attested`;
  }
  
  const formatted = relationships.map(formatRelationship);
  return `${header}\n${formatted.join('\n')}`;
}

/**
 * Build a financial section (Resources, Income, or Expenses)
 */
function buildFinancialSection(
  title: string,
  items: FinancialItem[],
  formatter: (item: FinancialItem) => string
): string {
  if (!items || items.length === 0) {
    return `${title}\nNone Attested`;
  }
  
  const formatted = items.map(formatter);
  return `${title}\n${formatted.join('\n')}`;
}

/**
 * Build the Notes section with MLTC prefix
 */
function buildNotesSection(notes: Note[]): string {
  if (!notes || notes.length === 0) {
    return 'MLTC: None Attested';
  }
  
  // Sort by creation date (oldest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
  
  // Full content, separated by blank lines, with MLTC prefix
  const formatted = sortedNotes.map(note => note.content);
  return `MLTC: ${formatted.join('\n\n')}`;
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
  }
): string {
  const { caseRecord, person } = caseData;
  const financials = options?.financials ?? { resources: [], income: [], expenses: [] };
  const notes = options?.notes ?? [];
  const sectionConfig = options?.sections ?? DEFAULT_SUMMARY_SECTIONS;
  
  const enabledSections: string[] = [];
  
  if (sectionConfig.notes) {
    enabledSections.push(buildNotesSection(notes));
  }
  if (sectionConfig.caseInfo) {
    enabledSections.push(buildCaseInfoSection(caseRecord));
  }
  if (sectionConfig.personInfo) {
    enabledSections.push(buildPersonInfoSection(person, caseRecord));
  }
  if (sectionConfig.relationships) {
    enabledSections.push(buildRelationshipsSection(person.relationships));
  }
  if (sectionConfig.resources) {
    enabledSections.push(buildFinancialSection('Resources', financials.resources || [], formatResourceItem));
  }
  if (sectionConfig.income) {
    enabledSections.push(buildFinancialSection('Income', financials.income || [], formatIncomeItem));
  }
  if (sectionConfig.expenses) {
    enabledSections.push(buildFinancialSection('Expenses', financials.expenses || [], formatExpenseItem));
  }

  return enabledSections.join(SECTION_SEPARATOR);
}
