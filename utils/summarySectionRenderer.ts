/**
 * Summary Section Renderer
 * =========================
 * Builds render contexts for case summary sections using the Template system.
 * Integrates with the unified template rendering pipeline.
 */

import type { StoredCase, FinancialItem, Note, Relationship } from '@/types/case';
import type { TemplateRenderContext } from '@/types/template';
import type { SummarySectionKey } from '@/types/categoryConfig';
import { formatDateForDisplay } from '@/domain/common';
import { renderTemplate } from './vrGenerator';
import {
  formatRetroMonths,
  calculateAge,
  formatVoterStatus,
  calculateAVSTrackingDates,
  extractKnownInstitutions,
} from '@/domain/cases';
import { formatResourceItem, formatIncomeItem, formatExpenseItem } from './caseSummaryGenerator';

/**
 * Format phone number as (XXX) XXX-XXXX
 */
function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phone;
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
 * Build template render context for case info section
 */
export function buildCaseInfoContext(caseRecord: StoredCase['caseRecord']): Partial<TemplateRenderContext> {
  const retroDisplay = formatRetroMonths(caseRecord.retroMonths, caseRecord.applicationDate);
  const appDate = formatDateForDisplay(caseRecord.applicationDate);
  
  return {
    applicationDate: appDate === 'None' ? 'None Attested' : appDate,
    retroDisplay,
    withWaiver: caseRecord.withWaiver ? 'Yes' : 'No',
  };
}

/**
 * Build template render context for person info section
 */
export function buildPersonInfoContext(
  person: StoredCase['person'],
  caseRecord: StoredCase['caseRecord']
): Partial<TemplateRenderContext> {
  const age = calculateAge(person.dateOfBirth);
  const ageDisplay = age !== null ? `(${age})` : '';
  const maritalStatus = caseRecord.maritalStatus || 'Unknown';
  const fullName = `${person.firstName} ${person.lastName} ${ageDisplay}`.trim();
  
  const contactParts: string[] = [];
  if (person.email) contactParts.push(person.email);
  if (person.phone) contactParts.push(formatPhoneNumber(person.phone));
  const contact = contactParts.length > 0 ? contactParts.join(' | ') : 'No contact info';
  
  const voterStatus = formatVoterStatus(caseRecord.voterFormStatus);
  
  return {
    clientFirstName: person.firstName,
    clientLastName: person.lastName,
    age,
    fullName,
    maritalStatus,
    contact,
    clientEmail: person.email || '',
    clientPhone: formatPhoneNumber(person.phone),
    citizenshipVerified: caseRecord.citizenshipVerified ? 'Yes' : 'No',
    agedDisabledVerified: caseRecord.agedDisabledVerified ? 'Yes' : 'No',
    livingArrangement: caseRecord.livingArrangement || 'None Attested',
    voterStatus,
  };
}

/**
 * Build template render context for relationships section
 */
export function buildRelationshipsContext(relationships?: Relationship[]): Partial<TemplateRenderContext> {
  if (!relationships || relationships.length === 0) {
    return {
      relationshipsList: 'None Attested',
    };
  }
  
  const formatted = relationships.map(formatRelationship);
  return {
    relationshipsList: formatted.join('\n'),
  };
}

/**
 * Build template render context for resources section
 */
export function buildResourcesContext(resources: FinancialItem[]): Partial<TemplateRenderContext> {
  if (!resources || resources.length === 0) {
    return {
      resourcesList: 'None Attested',
    };
  }
  
  const formatted = resources.map(formatResourceItem);
  return {
    resourcesList: formatted.join('\n'),
  };
}

/**
 * Build template render context for income section
 */
export function buildIncomeContext(income: FinancialItem[]): Partial<TemplateRenderContext> {
  if (!income || income.length === 0) {
    return {
      incomeList: 'None Attested',
    };
  }
  
  const formatted = income.map(formatIncomeItem);
  return {
    incomeList: formatted.join('\n'),
  };
}

/**
 * Build template render context for expenses section
 */
export function buildExpensesContext(expenses: FinancialItem[]): Partial<TemplateRenderContext> {
  if (!expenses || expenses.length === 0) {
    return {
      expensesList: 'None Attested',
    };
  }
  
  const formatted = expenses.map(formatExpenseItem);
  return {
    expensesList: formatted.join('\n'),
  };
}

/**
 * Build template render context for notes section
 */
export function buildNotesContext(notes: Note[]): Partial<TemplateRenderContext> {
  if (!notes || notes.length === 0) {
    return {
      notesList: 'None Attested',
    };
  }
  
  // Sort by creation date (oldest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
  
  const formatted = sortedNotes.map(note => note.content);
  return {
    notesList: formatted.join('\n\n'),
  };
}

/**
 * Build template render context for AVS tracking section
 */
export function buildAVSTrackingContext(
  caseRecord: StoredCase['caseRecord'],
  resources: FinancialItem[]
): Partial<TemplateRenderContext> {
  const avsDates = calculateAVSTrackingDates(caseRecord.avsConsentDate);
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
  financials?: { resources: FinancialItem[]; income: FinancialItem[]; expenses: FinancialItem[] },
  notes?: Note[]
): TemplateRenderContext {
  const { caseRecord, person } = caseData;
  
  switch (sectionKey) {
    case 'caseInfo':
      return buildCaseInfoContext(caseRecord) as TemplateRenderContext;
    
    case 'personInfo':
      return buildPersonInfoContext(person, caseRecord) as TemplateRenderContext;
    
    case 'relationships':
      return buildRelationshipsContext(person.relationships) as TemplateRenderContext;
    
    case 'resources':
      return buildResourcesContext(financials?.resources || []) as TemplateRenderContext;
    
    case 'income':
      return buildIncomeContext(financials?.income || []) as TemplateRenderContext;
    
    case 'expenses':
      return buildExpensesContext(financials?.expenses || []) as TemplateRenderContext;
    
    case 'notes':
      return buildNotesContext(notes || []) as TemplateRenderContext;
    
    case 'avsTracking':
      return buildAVSTrackingContext(caseRecord, financials?.resources || []) as TemplateRenderContext;
    
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
  financials?: { resources: FinancialItem[]; income: FinancialItem[]; expenses: FinancialItem[] },
  notes?: Note[]
): string {
  const context = buildSectionContext(sectionKey, caseData, financials, notes);
  return renderTemplate(templateContent, context);
}
