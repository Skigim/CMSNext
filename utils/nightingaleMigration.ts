/**
 * Nightingale Data Migration Utility
 * 
 * Converts Nightingale data format to the case tracking platform's expected format.
 * This is a TypeScript port of the Python migration script.
 * 
 * Key corrections handled:
 * - Uses 'zip' instead of 'zipCode' in addresses
 * - Uses 'applicationDate' and 'updatedDate' instead of 'dateOpened' and 'lastUpdated'
 * - Uses boolean values for priority instead of strings
 * - Includes all required fields with proper defaults
 * - Normalizes status values to valid enum values
 */

import { CaseDisplay, CaseRecord, Person, FinancialItem, Note, Address } from '@/types/case';

/**
 * Generate a unique ID using crypto.randomUUID() with fallback
 */
function generateId(prefix?: string): string {
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  
  return prefix ? `${prefix}${uuid}` : uuid;
}

interface NightingaleData {
  people?: any[];
  caseRecords?: any[];
  cases?: any[];
  organizations?: any[];
}

interface NightingalePerson {
  id?: string;
  name?: string;           // Full name instead of separate first/last
  firstName?: string;      // Keep for backward compatibility
  lastName?: string;       // Keep for backward compatibility
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  ssn?: string;
  organizationId?: string;
  livingArrangement?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    zipCode?: string;
  };
  authorizedRepIds?: string[];
  familyMembers?: any[];
  status?: string;
  createdAt?: string;
  dateAdded?: string;
}

interface NightingaleCase {
  id?: string;
  personId?: string;
  mcn?: string;
  masterCaseNumber?: string; // New field name
  applicationDate?: string;
  dateOpened?: string;
  appDetails?: {            // New nested structure
    appDate?: string;
    caseType?: string;
  };
  caseType?: string;
  spouseId?: string;
  status?: string;
  description?: string;
  priority?: boolean | string;
  livingArrangement?: string;
  withWaiver?: boolean;
  admissionDate?: string;
  organizationId?: string;
  authorizedReps?: any[];
  retroRequested?: string;
  financials?: {
    resources?: any[];
    income?: any[];
    expenses?: any[];
  };
  notes?: any[];
  createdDate?: string;
  createdAt?: string;
  updatedDate?: string;
  lastUpdated?: string;
}

/**
 * Normalize status to match expected enum values
 */
function normalizeStatus(status?: string): 'Pending' | 'Approved' | 'Denied' | 'Spenddown' {
  if (!status) {
    return 'Pending';
  }

  const statusLower = status.toLowerCase();

  if (statusLower.includes('approve') || statusLower.includes('complete') || statusLower.includes('close')) {
    return 'Approved';
  }

  if (statusLower.includes('deny') || statusLower.includes('reject')) {
    return 'Denied';
  }

  if (statusLower.includes('spend')) {
    return 'Spenddown';
  }

  return 'Pending';
}

/**
 * Normalize date string to ISO format
 */
function normalizeDate(dateStr?: string): string {
  if (!dateStr) {
    return new Date().toISOString();
  }
  
  try {
    let date: Date;
    
    if (dateStr.includes('T')) {
      // Already in ISO format
      date = new Date(dateStr.replace('Z', '+00:00'));
    } else {
      // Try parsing as date only
      date = new Date(dateStr);
    }
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    return date.toISOString();
  } catch {
    // If parsing fails, return current time
    return new Date().toISOString();
  }
}

/**
 * Find person by ID in the people array
 */
function findPersonById(people: NightingalePerson[], personId: string): NightingalePerson | undefined {
  return people.find(person => person.id === personId);
}

/**
 * Convert person data from Nightingale format to expected format
 */
function convertPersonData(person: NightingalePerson): Person {
  const address = person.address || {};
  
  // Convert date of birth to simpler format if available
  let dateOfBirth = person.dateOfBirth || '';
  if (dateOfBirth) {
    try {
      const date = new Date(dateOfBirth.replace('Z', '+00:00'));
      if (!isNaN(date.getTime())) {
        dateOfBirth = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
    } catch {
      // Keep original if parsing fails
    }
  }
  
  const personId = person.id || generateId();
  
  // Handle both full name and separate first/last name formats
  let firstName = '';
  let lastName = '';
  let fullName = '';
  
  if (person.name) {
    // If full name is provided, split it
    fullName = person.name;
    const nameParts = person.name.split(' ');
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  } else {
    // Use separate firstName/lastName if provided
    firstName = person.firstName || '';
    lastName = person.lastName || '';
    fullName = `${firstName} ${lastName}`.trim();
  }
  
  const convertedAddress: Address = {
    street: address.street || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || address.zipCode || '' // Handle both formats
  };
  
  const convertedPerson: Person = {
    id: personId,
    firstName,
    lastName,
    name: fullName,
    email: person.email || '',
    phone: person.phone || '',
    dateOfBirth,
    ssn: person.ssn || '',
    organizationId: person.organizationId || '',
    livingArrangement: person.livingArrangement || 'Independent',
    address: convertedAddress,
    mailingAddress: {
      ...convertedAddress,
      sameAsPhysical: true
    },
    authorizedRepIds: person.authorizedRepIds || [],
    familyMembers: person.familyMembers || [],
    status: person.status || 'Active',
    createdAt: normalizeDate(person.createdAt),
    dateAdded: normalizeDate(person.dateAdded || person.createdAt)
  };
  
  return convertedPerson;
}

/**
 * Convert financial items (resources, income, expenses) to the target format
 */
function convertFinancialItems(financialItems: any[]): FinancialItem[] {
  return financialItems.map(item => {
    const itemId = item.id || generateId();
    
    // Handle different field name variations
    const amount = parseFloat(item.amount || item.value || 0);
    const description = item.description || item.name || item.type || '';
    const verificationSource = item.verificationSource || item.source || '';
    
    const convertedItem: FinancialItem = {
      id: itemId,
      description,
      location: item.location || '',
      accountNumber: item.accountNumber || '',
      amount,
      frequency: item.frequency || 'Monthly',
      owner: item.owner || '',
      verificationStatus: item.verificationStatus || 'Needs VR',
      verificationSource,
      notes: item.notes || '',
      dateAdded: normalizeDate(item.dateAdded || item.createdAt),
      createdAt: normalizeDate(item.createdAt),
      updatedAt: normalizeDate(item.updatedAt || item.createdAt)
    };
    
    return convertedItem;
  });
}

/**
 * Convert notes to the expected format
 */
function convertNotes(notes: any[]): Note[] {
  return notes.map(note => {
    const noteId = note.id || generateId();
    
    // Handle different field name variations
    const content = note.content || note.text || '';
    const createdAt = note.createdAt || note.timestamp || '';
    
    const convertedNote: Note = {
      id: noteId,
      category: note.category || 'General',
      content,
      createdAt: normalizeDate(createdAt),
      updatedAt: normalizeDate(note.updatedAt || createdAt)
    };
    
    return convertedNote;
  });
}

/**
 * Convert case data from Nightingale format to expected format
 */
function convertCaseData(caseData: NightingaleCase, person: NightingalePerson): CaseRecord {
  const caseId = caseData.id || generateId();
  const personId = person.id || generateId();
  
  // Handle different MCN field names
  const mcn = caseData.mcn || caseData.masterCaseNumber || '';
  
  // Handle nested app details
  const appDetails = caseData.appDetails || {};
  const applicationDate = normalizeDate(
    appDetails.appDate || 
    caseData.applicationDate || 
    caseData.dateOpened || 
    caseData.createdAt
  );
  const caseType = appDetails.caseType || caseData.caseType || 'General';
  
  // Get financials (should be single level in actual structure)
  const financials = caseData.financials || {};
  
  // Convert notes
  const notes = convertNotes(caseData.notes || []);
  
  // Normalize dates
  const updatedDate = normalizeDate(caseData.updatedDate || caseData.lastUpdated || caseData.createdAt);
  const createdDate = normalizeDate(caseData.createdDate || caseData.createdAt || applicationDate);
  
  // Process financials
  const processedFinancials = {
    resources: convertFinancialItems(financials.resources || []),
    income: convertFinancialItems(financials.income || []),
    expenses: convertFinancialItems(financials.expenses || [])
  };

  const convertedCase: CaseRecord = {
    id: caseId,
    personId,
    mcn,
    applicationDate,
    caseType,
    spouseId: caseData.spouseId || '',
    status: normalizeStatus(caseData.status),
    description: caseData.description || '',
    priority: Boolean(caseData.priority),
    livingArrangement: caseData.livingArrangement || person.livingArrangement || 'Independent',
    withWaiver: Boolean(caseData.withWaiver),
    admissionDate: normalizeDate(caseData.admissionDate || applicationDate),
    organizationId: caseData.organizationId || '',
    authorizedReps: caseData.authorizedReps || [],
    retroRequested: caseData.retroRequested || '',
    financials: processedFinancials,
    notes,
    createdDate,
    updatedDate
  };
  
  return convertedCase;
}

/**
 * Convert Nightingale data to multiple cases format
 */
function convertToMultipleCasesFormat(nightingaleData: NightingaleData): CaseDisplay[] {
  const people = nightingaleData.people || [];
  const cases = nightingaleData.caseRecords || nightingaleData.cases || [];
  
  const multipleCases: CaseDisplay[] = [];
  
  // Process all cases using the correct structure
  for (const caseData of cases) {
    const person = findPersonById(people, caseData.personId);
    if (person) {
      // Convert both person and case data
      const convertedPerson = convertPersonData(person);
      const convertedCase = convertCaseData(caseData, person);
      
      // Create the complete case structure
      const caseItem: CaseDisplay = {
        id: generateId(),
        name: convertedPerson.name,
        mcn: convertedCase.mcn,
        status: convertedCase.status,
        priority: convertedCase.priority,
        createdAt: convertedCase.createdDate,
        updatedAt: convertedCase.updatedDate,
        person: convertedPerson,
        caseRecord: convertedCase
      };
      
      multipleCases.push(caseItem);
    }
  }
  
  return multipleCases;
}

/**
 * Main migration function - converts Nightingale data format to platform format
 */
export function migrateNightingaleData(data: any): { 
  success: boolean; 
  cases?: CaseDisplay[]; 
  error?: string;
  summary?: {
    totalCases: number;
    convertedCases: number;
    errors: string[];
  };
} {
  try {
    // Validate input data structure
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'Invalid data format - expected JSON object'
      };
    }
    
    // Check if this is already in platform format
    if (Array.isArray(data) && data.length > 0 && data[0].person && data[0].caseRecord) {
      return {
        success: true,
        cases: data as CaseDisplay[],
        summary: {
          totalCases: data.length,
          convertedCases: data.length,
          errors: []
        }
      };
    }
    
    // Check for Nightingale data structure
    const peopleCount = data.people?.length || 0;
    const casesCount = (data.caseRecords || data.cases)?.length || 0;
    
    if (peopleCount === 0 && casesCount === 0) {
      return {
        success: false,
        error: 'No people or cases found in data - this may not be Nightingale format'
      };
    }
    
    // Convert data to platform format
    const convertedCases = convertToMultipleCasesFormat(data);
    
    return {
      success: true,
      cases: convertedCases,
      summary: {
        totalCases: casesCount,
        convertedCases: convertedCases.length,
        errors: []
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown migration error'
    };
  }
}

/**
 * Check if data appears to be in Nightingale format
 */
export function isNightingaleFormat(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Check for Nightingale structure markers
  const hasNightingaleStructure = (
    data.people && Array.isArray(data.people) && 
    (data.caseRecords || data.cases) && Array.isArray(data.caseRecords || data.cases)
  );
  
  // Check if it's NOT already in platform format
  const isPlatformFormat = (
    Array.isArray(data) && data.length > 0 && 
    data[0].person && data[0].caseRecord
  );
  
  return hasNightingaleStructure && !isPlatformFormat;
}