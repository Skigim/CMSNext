import { CaseDisplay } from "../types/case";

/**
 * Transform various data formats into the expected case tracking structure
 */
export function transformImportedData(data: any): CaseDisplay[] {
  if (!data) {
    return [];
  }

  console.log('Transforming imported data:', data);

  // If data has a cases array, validate and normalize it
  if (data.cases && Array.isArray(data.cases)) {
    console.log(`Found cases array with ${data.cases.length} items`);
    return normalizeCases(data.cases);
  }

  // If data is an array, assume it's an array of cases and normalize them
  if (Array.isArray(data)) {
    console.log(`Data is array with ${data.length} items`);
    // Only filter if the array contains items that look like cases (not already valid cases)
    const cases = data.filter(item => item && (item.person || item.firstName || item.name || item.caseRecord));
    return normalizeCases(cases);
  }

  // If data has case-like structure at the top level
  if (data.person || data.firstName || data.name) {
    console.log('Found single case at top level');
    return normalizeCases([data]);
  }

  // Nightingale-specific structure
  if (data.people && data.caseRecords) {
    console.log(`Found Nightingale structure: ${data.people.length} people, ${data.caseRecords.length} cases`);
    return combineNightingaleData(data);
  }

  // Try to find cases in various common export formats
  const possibleCaseArrays = [
    { key: 'data.cases', value: data.data?.cases },
    { key: 'export.cases', value: data.export?.cases },
    { key: 'records', value: data.records },
    { key: 'clients', value: data.clients },
    { key: 'people', value: data.people },
    { key: 'cases', value: data.cases }
  ].filter(item => item.value);

  for (const { key, value } of possibleCaseArrays) {
    if (Array.isArray(value) && value.length > 0) {
      console.log(`Found cases in ${key} with ${value.length} items`);
      return normalizeCases(value);
    }
  }

  console.warn('Could not find valid case data in imported file:', Object.keys(data));
  return [];
}

/**
 * Normalize cases to ensure proper structure
 * Defensive migration fix: add missing caseRecord from top-level fields
 */
function normalizeCases(cases: any[]): CaseDisplay[] {
  return cases.map(c => {
    // If caseRecord is missing, null, or undefined, reconstruct it from top-level fields
    if (!c.caseRecord || typeof c.caseRecord !== 'object') {
      console.warn(`Migrating legacy case ${c.id} - reconstructing caseRecord from top-level fields`);
      c.caseRecord = {
        id: `${c.id}-record`,
        personId: c.person?.id || '',
        mcn: c.mcn || '',
        applicationDate: c.createdAt?.split('T')[0] || new Date().toISOString(),
        caseType: 'General',
        spouseId: '',
        status: c.status || 'Pending',
        description: '',
        priority: c.priority || false,
        livingArrangement: c.person?.livingArrangement || 'Unknown',
        withWaiver: false,
        admissionDate: c.createdAt || new Date().toISOString(),
        organizationId: c.person?.organizationId || '',
        authorizedReps: [],
        retroRequested: '',
        financials: c.financials || { resources: [], income: [], expenses: [] },
        notes: c.notes || [],
        createdDate: c.createdAt || new Date().toISOString(),
        updatedDate: c.updatedAt || new Date().toISOString(),
      };
    } else {
      // Ensure caseRecord has required nested structures even if it exists
      if (!c.caseRecord.financials || typeof c.caseRecord.financials !== 'object') {
        console.warn(`Case ${c.id} has caseRecord but missing financials structure - adding defaults`);
        c.caseRecord.financials = { resources: [], income: [], expenses: [] };
      }
      if (!Array.isArray(c.caseRecord.notes)) {
        console.warn(`Case ${c.id} has caseRecord but invalid notes array - adding default`);
        c.caseRecord.notes = [];
      }
    }
    return c;
  });
}

/**
 * Combine Nightingale's separate people and caseRecords arrays
 */
function combineNightingaleData(data: any): CaseDisplay[] {
  const { people, caseRecords } = data;
  
  if (!Array.isArray(people) || !Array.isArray(caseRecords)) {
    return [];
  }

  const cases: CaseDisplay[] = [];
  
  for (const caseRecord of caseRecords) {
    const person = people.find(p => p.id === caseRecord.personId);
    
    if (person) {
      cases.push({
        id: `display-${caseRecord.id}`,
        name: person.name || `${person.firstName} ${person.lastName}`,
        mcn: caseRecord.mcn,
        status: normalizeStatus(caseRecord.status),
        priority: Boolean(caseRecord.priority),
        createdAt: caseRecord.createdDate || caseRecord.createdAt || new Date().toISOString(),
        updatedAt: caseRecord.updatedDate || caseRecord.updatedAt || new Date().toISOString(),
        person: {
          ...person,
          // Ensure address structure is correct
          address: person.address || {
            street: '',
            city: '',
            state: '',
            zip: ''
          },
          mailingAddress: person.mailingAddress || {
            street: '',
            city: '',
            state: '',
            zip: '',
            sameAsPhysical: true
          }
        },
        caseRecord: {
          ...caseRecord,
          // Ensure financials structure is correct
          financials: caseRecord.financials || {
            resources: [],
            income: [],
            expenses: []
          },
          notes: caseRecord.notes || []
        }
      });
    }
  }
  
  return cases;
}

/**
 * Validate that imported data has the expected structure
 */
export function validateImportedCases(cases: any[]): { valid: CaseDisplay[]; invalid: any[] } {
  const valid: CaseDisplay[] = [];
  const invalid: any[] = [];

  console.log(`Validating ${cases.length} imported cases`);

  for (let i = 0; i < cases.length; i++) {
    const caseItem = cases[i];
    if (isValidCaseStructure(caseItem)) {
      valid.push(caseItem);
    } else {
      // Only log the first few invalid cases to avoid console spam
      if (i < 3) {
        console.log(`Case ${i} is invalid:`, {
          hasPerson: !!caseItem?.person,
          hasPersonName: !!(caseItem?.person?.firstName || caseItem?.person?.lastName || caseItem?.person?.name),
          hasCaseRecord: !!caseItem?.caseRecord,
          keys: Object.keys(caseItem || {})
        });
      }
      invalid.push(caseItem);
    }
  }

  console.log(`Validation results: ${valid.length} valid, ${invalid.length} invalid`);
  return { valid, invalid };
}

/**
 * Check if an item has a valid case structure - made more lenient for real-world data
 */
function isValidCaseStructure(item: any): item is CaseDisplay {
  if (!item || typeof item !== 'object') {
    return false;
  }

  // Must have person information - only require basic name fields
  const hasPerson = item.person && 
    (item.person.firstName || item.person.lastName || item.person.name);

  // Must have case record - only require the object to exist
  const hasCaseRecord = item.caseRecord && 
    typeof item.caseRecord === 'object';

  return hasPerson && hasCaseRecord;
}

/**
 * Normalize case status to match expected values
 */
function normalizeStatus(status: any): CaseDisplay['status'] {
  if (!status) return 'Pending';

  const statusStr = String(status).toLowerCase();

  if (statusStr.includes('approve') || statusStr.includes('complete') || statusStr.includes('close')) {
    return 'Closed';
  }

  if (statusStr.includes('deny') || statusStr.includes('reject')) {
    return 'Closed';
  }

  if (statusStr.includes('spend') || statusStr.includes('active')) {
    return 'Active';
  }

  return 'Pending';
}

/**
 * Normalize financial items array
 */
function normalizeFinancialItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  
  return items.map(item => ({
    id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    description: item.description || item.name || '',
    location: item.location || '',
    accountNumber: item.accountNumber || '',
    amount: Number(item.amount) || 0,
    frequency: item.frequency || '',
    owner: item.owner || '',
    verificationStatus: item.verificationStatus || 'Needs VR',
    verificationSource: item.verificationSource || '',
    notes: item.notes || '',
    dateAdded: item.dateAdded || item.createdAt || new Date().toISOString(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  }));
}

/**
 * Normalize notes array
 */
function normalizeNotes(notes: any[]): any[] {
  if (!Array.isArray(notes)) return [];
  
  return notes.map(note => ({
    id: note.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category: note.category || 'General',
    content: note.content || note.text || note.note || '',
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: note.updatedAt || new Date().toISOString()
  }));
}

/**
 * Attempt to repair/normalize imported case data
 */
export function repairCaseData(rawCases: any[]): CaseDisplay[] {
  return rawCases.map(item => {
    if (isValidCaseStructure(item)) {
      return item;
    }

    // Try to construct a valid case from various formats
    const person = item.person || {
      firstName: item.firstName || '',
      lastName: item.lastName || '',
      name: `${item.firstName || ''} ${item.lastName || ''}`.trim(),
      email: item.email || '',
      phone: item.phone || '',
      dateOfBirth: item.dateOfBirth || item.dob || '',
      ssn: item.ssn || '',
      organizationId: item.organizationId || null,
      livingArrangement: item.livingArrangement || '',
      address: {
        street: item.address?.street || item.address || item.street || '',
        city: item.address?.city || item.city || '',
        state: item.address?.state || item.state || '',
        zip: item.address?.zip || item.zipCode || item.zip || ''
      },
      mailingAddress: {
        street: item.mailingAddress?.street || item.mailingAddress || item.address?.street || item.address || item.street || '',
        city: item.mailingAddress?.city || item.mailingAddress_city || item.address?.city || item.city || '',
        state: item.mailingAddress?.state || item.mailingAddress_state || item.address?.state || item.state || '',
        zip: item.mailingAddress?.zip || item.mailingAddress_zip || item.address?.zip || item.zipCode || item.zip || '',
        sameAsPhysical: item.mailingAddress?.sameAsPhysical || true
      },
      authorizedRepIds: item.authorizedRepIds || [],
      familyMembers: item.familyMembers || [],
      status: item.status || 'Active',
      dateAdded: item.dateAdded || new Date().toISOString()
    };

    const caseRecord = item.caseRecord || {
      mcn: item.mcn || item.caseNumber || item.id || `MCN-${Date.now()}`,
      applicationDate: item.applicationDate || item.dateOpened || item.openDate || new Date().toISOString(),
      caseType: item.caseType || 'General',
      personId: '', // Will be set below
      spouseId: item.spouseId || '',
  status: normalizeStatus(item.status) || 'Pending',
      description: item.description || '',
      priority: Boolean(item.priority === true || item.priority === 'high' || item.priority === 'urgent'),
      livingArrangement: item.livingArrangement || '',
      withWaiver: Boolean(item.withWaiver),
      admissionDate: item.admissionDate || item.dateOpened || item.openDate || new Date().toISOString(),
      organizationId: item.organizationId || '',
      authorizedReps: item.authorizedReps || [],
      retroRequested: item.retroRequested || '',
      financials: {
        resources: normalizeFinancialItems(item.financials?.resources || item.resources || []),
        income: normalizeFinancialItems(item.financials?.income || item.income || []),
        expenses: normalizeFinancialItems(item.financials?.expenses || item.expenses || [])
      },
      notes: normalizeNotes(item.notes || []),
      createdDate: item.createdAt || item.createdDate || new Date().toISOString(),
      updatedDate: item.updatedAt || item.updatedDate || new Date().toISOString()
    };

    // Ensure person has required IDs
    if (!person.id) {
      person.id = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!person.createdAt) {
      person.createdAt = new Date().toISOString();
    }
    if (!person.updatedAt) {
      person.updatedAt = new Date().toISOString();
    }

    // Ensure case record has required IDs
    if (!caseRecord.id) {
      caseRecord.id = `case-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!caseRecord.personId) {
      caseRecord.personId = person.id;
    }

    // Set person ID and link case record to person
    if (!person.id) {
      person.id = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    person.createdAt = person.createdAt || new Date().toISOString();
    
    if (!caseRecord.id) {
      caseRecord.id = `case-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    caseRecord.personId = person.id;

    const repairedCase: CaseDisplay = {
      id: item.id || `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: person.name || `${person.firstName} ${person.lastName}`.trim(),
      mcn: caseRecord.mcn,
      status: caseRecord.status,
      priority: caseRecord.priority,
      createdAt: caseRecord.createdDate,
      updatedAt: caseRecord.updatedDate,
      person,
      caseRecord
    };

    return repairedCase;
  }).filter(item => {
    // Final validation - ensure we have at least names
    return item.person.firstName && item.person.lastName;
  });
}

/**
 * Repair existing loaded case data that might have integrity issues
 */
export function repairLoadedCases(cases: any[]): CaseDisplay[] {
  if (!Array.isArray(cases)) {
    console.warn('repairLoadedCases: Input is not an array:', cases);
    return [];
  }

  console.log(`🔧 Repairing ${cases.length} loaded cases...`);
  
  const repaired: CaseDisplay[] = [];
  const skipped: any[] = [];

  for (const caseItem of cases) {
    try {
      // Check if case is already valid
      if (isValidCaseStructure(caseItem)) {
        repaired.push(caseItem);
        continue;
      }

      // Try to repair the case using the existing repair function
      const repairedCase = repairSingleCase(caseItem);
      if (repairedCase) {
        repaired.push(repairedCase);
      } else {
        skipped.push(caseItem);
      }
    } catch (error) {
      console.error('Error repairing case:', error, caseItem);
      skipped.push(caseItem);
    }
  }

  if (skipped.length > 0) {
    console.warn(`⚠️ Skipped ${skipped.length} cases that couldn't be repaired:`, skipped);
  }

  console.log(`✅ Repaired ${repaired.length} cases successfully`);
  return repaired;
}

/**
 * Repair a single case item using the same logic as repairCaseData but for individual items
 */
function repairSingleCase(item: any): CaseDisplay | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  try {
    // Use the existing repair logic from repairCaseData
    const repairedCases = repairCaseData([item]);
    return repairedCases.length > 0 ? repairedCases[0] : null;
  } catch (error) {
    console.error('Failed to repair single case:', error, item);
    return null;
  }
}