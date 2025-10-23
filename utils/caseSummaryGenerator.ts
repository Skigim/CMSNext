/**
 * Case Summary Generator
 * ======================
 * Generates a plain-text summary of case information for easy export/sharing
 */

import { CaseDisplay, FinancialItem } from '../types/case';
import { formatCurrency, formatFrequency } from './financialFormatters';

/**
 * Format a date string to a readable format
 */
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not set';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format financial items for display in summary
 */
function formatFinancialItems(items: FinancialItem[], categoryName: string): string {
  if (!items || items.length === 0) {
    return `  No ${categoryName.toLowerCase()} recorded`;
  }

  const formatted = items.map(item => {
    const parts = [`  • ${item.description || 'Unnamed item'}`];
    
    if (item.amount !== undefined && item.amount !== null) {
      const amountStr = formatCurrency(item.amount);
      const freqStr = formatFrequency(item.frequency);
      parts.push(` - ${amountStr}${freqStr}`);
    }
    
    if (item.verificationStatus) {
      parts.push(` (${item.verificationStatus})`);
    }
    
    return parts.join('');
  });

  return formatted.join('\n');
}

/**
 * Format notes for display in summary (showing most recent)
 */
function formatRecentNotes(notes: CaseDisplay['caseRecord']['notes'], limit = 3): string {
  if (!notes || notes.length === 0) {
    return '  No notes recorded';
  }

  // Sort by creation date (most recent first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  const recentNotes = sortedNotes.slice(0, limit);
  
  const formatted = recentNotes.map(note => {
    const date = formatDate(note.createdAt);
    const category = note.category || 'General';
    const preview = note.content.length > 100 
      ? note.content.substring(0, 100) + '...' 
      : note.content;
    
    return `  • [${category}] ${date}\n    ${preview}`;
  });

  const header = notes.length > limit 
    ? `  Showing ${limit} most recent of ${notes.length} total notes:\n\n`
    : '';

  return header + formatted.join('\n\n');
}

/**
 * Generate a comprehensive case summary
 */
export function generateCaseSummary(caseData: CaseDisplay): string {
  const { caseRecord, person, name, mcn, status } = caseData;
  
  const sections = [
    '='.repeat(60),
    'CASE SUMMARY',
    '='.repeat(60),
    '',
    '📋 BASIC INFORMATION',
    '-'.repeat(60),
    `Case Name: ${name || 'Unnamed Case'}`,
    `MCN: ${mcn || 'Not assigned'}`,
    `Case ID: ${caseData.id}`,
    `Status: ${status}`,
    `Priority: ${caseRecord.priority ? 'Yes' : 'No'}`,
    '',
    '👤 PERSON INFORMATION',
    '-'.repeat(60),
    `Name: ${person.firstName} ${person.lastName}`,
    `Email: ${person.email || 'Not provided'}`,
    `Phone: ${person.phone || 'Not provided'}`,
    `Date of Birth: ${formatDate(person.dateOfBirth)}`,
    '',
    '📅 KEY DATES',
    '-'.repeat(60),
    `Application Date: ${formatDate(caseRecord.applicationDate)}`,
    `Admission Date: ${formatDate(caseRecord.admissionDate)}`,
    `Retro Requested: ${caseRecord.retroRequested || 'Not specified'}`,
    `Created: ${formatDate(caseRecord.createdDate)}`,
    `Last Updated: ${formatDate(caseRecord.updatedDate)}`,
    '',
    '💰 FINANCIAL INFORMATION',
    '-'.repeat(60),
    '',
    'Resources:',
    formatFinancialItems(caseRecord.financials.resources || [], 'Resources'),
    '',
    'Income:',
    formatFinancialItems(caseRecord.financials.income || [], 'Income'),
    '',
    'Expenses:',
    formatFinancialItems(caseRecord.financials.expenses || [], 'Expenses'),
    '',
    '📝 RECENT NOTES',
    '-'.repeat(60),
    formatRecentNotes(caseRecord.notes),
    '',
    '='.repeat(60),
    `Generated: ${new Date().toLocaleString('en-US')}`,
    '='.repeat(60),
  ];

  return sections.join('\n');
}
