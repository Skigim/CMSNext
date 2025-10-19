/**
 * Comprehensive Seed Data Generator for CMSNext
 * 
 * This script generates a full schema with realistic sample data including:
 * - Diverse case portfolio with realistic scenarios
 * - Financial data across all categories (resources, income, expenses)
 * - Comprehensive notes with varied categories
 * - Proper relationships between people, cases, and organizations
 * 
 * Usage:
 * - Run directly: `npx tsx scripts/generateSeedData.ts`
 * - Import as module: `import { generateFullSeedData } from './scripts/generateSeedData';`
 */

import type {
  CaseData,
  Person,
  CaseRecord,
  FinancialItem,
  Note,
  Address,
  MailingAddress
} from '../types/case';
import { defaultCategoryConfig } from '../types/categoryConfig';

// Realistic sample data pools
const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
  'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
  'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah',
  'Timothy', 'Dorothy', 'Ronald', 'Lisa', 'Jason', 'Nancy', 'Edward', 'Karen'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill'
];

const STREETS = [
  'Main St', 'Oak Ave', 'Pine St', 'Cedar Ln', 'Elm Dr', 'Maple Ave', 'Park Blvd',
  'First St', 'Second Ave', 'Third St', 'Church St', 'School St', 'Washington Ave'
];

const CITIES = [
  'Springfield', 'Franklin', 'Georgetown', 'Madison', 'Arlington', 'Centerville',
  'Lebanon', 'Georgetown', 'Clinton', 'Greenville', 'Fairview', 'Salem'
];

const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID'];

const CASE_TYPES = [...defaultCategoryConfig.caseTypes];

const ORGANIZATIONS = [
  'Central Community Services', 'Northern Regional Office', 'Southern District Center',
  'Eastern Area Services', 'Western Community Hub', 'Downtown Service Center'
];

const LIVING_ARRANGEMENTS = [...defaultCategoryConfig.livingArrangements];

const RESOURCE_TYPES = [
  { description: 'Checking Account', range: [500, 5000] as [number, number] },
  { description: 'Savings Account', range: [1000, 25000] as [number, number] },
  { description: 'Certificate of Deposit', range: [2000, 50000] as [number, number] },
  { description: 'Vehicle (Estimated Value)', range: [2000, 35000] as [number, number] }
];

const INCOME_TYPES = [
  { description: 'Employment Income', frequency: 'monthly', range: [1500, 8000] as [number, number] },
  { description: 'Social Security Benefits', frequency: 'monthly', range: [800, 3500] as [number, number] },
  { description: 'Disability Benefits (SSDI)', frequency: 'monthly', range: [900, 2800] as [number, number] },
  { description: 'Part-time Employment', frequency: 'monthly', range: [800, 2500] as [number, number] }
];

const EXPENSE_TYPES = [
  { description: 'Rent/Mortgage', frequency: 'monthly', range: [800, 3500] as [number, number] },
  { description: 'Utilities (Electric)', frequency: 'monthly', range: [80, 300] as [number, number] },
  { description: 'Groceries/Food', frequency: 'monthly', range: [300, 800] as [number, number] },
  { description: 'Transportation/Gas', frequency: 'monthly', range: [150, 500] as [number, number] }
];

const NOTE_CATEGORIES = [...defaultCategoryConfig.noteCategories];

const NOTE_TEMPLATES = {
  'General': [
    'Initial case assessment completed. Client appears eligible for services.',
    'Application submitted to state system. Awaiting approval decision.'
  ],
  'VR Update': [
    'Verification request sent to employer for income confirmation.',
    'Bank statements received and reviewed. Financial verification complete.'
  ],
  'Client Contact': [
    'Phone contact made. Client provided additional documentation.',
    'Home visit conducted. Living situation verified and documented.'
  ],
  'Follow-up': [
    'Follow-up appointment scheduled for benefit review in 6 months.',
    'Service plan updated based on changing client needs and circumstances.'
  ]
};

const VERIFICATION_STATUSES: FinancialItem['verificationStatus'][] = [
  'Needs VR', 'VR Pending', 'AVS Pending', 'Verified'
];

const VERIFICATION_SOURCES = [
  'Bank Statement', 'Pay Stub', 'Tax Return', 'Social Security Statement',
  'Employer Letter', 'Court Order', 'Medical Documentation'
];

const CASE_STATUSES: CaseRecord['status'][] = [...defaultCategoryConfig.caseStatuses];

// Utility functions
const randomChoice = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const randomRange = (min: number, max: number): number => 
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomAmount = (range: [number, number]): number => 
  Math.round((Math.random() * (range[1] - range[0]) + range[0]) * 100) / 100;

const generateId = (prefix: string, counter: number): string => 
  `${prefix}${counter.toString().padStart(6, '0')}`;

const generateSSN = (): string => {
  const area = randomRange(100, 999);
  const group = randomRange(10, 99);
  const serial = randomRange(1000, 9999);
  return `${area}-${group}-${serial}`;
};

const generatePhone = (): string => {
  const area = randomRange(200, 999);
  const exchange = randomRange(200, 999);
  const number = randomRange(1000, 9999);
  return `${area}-${exchange}-${number}`;
};

const generateEmail = (firstName: string, lastName: string): string => {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const domain = randomChoice(domains);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
};

const generateAddress = (): Address => ({
  street: `${randomRange(100, 9999)} ${randomChoice(STREETS)}`,
  city: randomChoice(CITIES),
  state: randomChoice(STATES),
  zip: randomRange(10000, 99999).toString()
});

const generateMailingAddress = (physicalAddress: Address): MailingAddress => {
  const sameAsPhysical = Math.random() < 0.8;
  return {
    ...physicalAddress,
    ...(sameAsPhysical ? {} : generateAddress()),
    sameAsPhysical
  };
};

const generateDateInPast = (maxYearsAgo: number): string => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - Math.random() * maxYearsAgo * 365 * 24 * 60 * 60 * 1000);
  return pastDate.toISOString().split('T')[0];
};

const generateDateBetween = (startDate: string, endDate: string): string => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const randomTime = start + Math.random() * (end - start);
  return new Date(randomTime).toISOString();
};

const generatePerson = (id: string): Person => {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const address = generateAddress();
  const createdAt = generateDateInPast(2);

  return {
    id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    email: generateEmail(firstName, lastName),
    phone: generatePhone(),
    dateOfBirth: generateDateInPast(80),
    ssn: generateSSN(),
    organizationId: randomChoice(ORGANIZATIONS),
    livingArrangement: randomChoice(LIVING_ARRANGEMENTS),
    address,
    mailingAddress: generateMailingAddress(address),
    authorizedRepIds: [],
    familyMembers: [],
    status: randomChoice(['Active', 'Inactive', 'Pending']),
    createdAt,
    dateAdded: createdAt
  };
};

const generateFinancialItems = (
  category: 'resources' | 'income' | 'expenses',
  itemId: { current: number }
): FinancialItem[] => {
  const itemTypes = category === 'resources' ? RESOURCE_TYPES :
                   category === 'income' ? INCOME_TYPES : EXPENSE_TYPES;
  
  const numItems = randomRange(0, Math.min(3, itemTypes.length));
  const selectedTypes = [...itemTypes].sort(() => 0.5 - Math.random()).slice(0, numItems);
  
  return selectedTypes.map(type => {
    const amount = randomAmount(type.range);
    const verificationStatus = randomChoice(VERIFICATION_STATUSES);
    const createdAt = generateDateInPast(1);
    
    return {
      id: generateId('FIN', ++itemId.current),
      description: type.description,
      amount,
      frequency: 'frequency' in type ? (type as any).frequency as string : undefined,
      location: randomChoice(['First National Bank', 'ABC Company', 'Service Provider']),
      accountNumber: category === 'resources' ? `****${randomRange(1000, 9999)}` : undefined,
      verificationStatus,
      verificationSource: verificationStatus === 'Verified' ? randomChoice(VERIFICATION_SOURCES) : undefined,
      notes: Math.random() < 0.4 ? `Additional details for ${type.description.toLowerCase()}` : undefined,
      owner: Math.random() < 0.3 ? 'Spouse' : 'Client',
      dateAdded: createdAt,
      createdAt,
      updatedAt: generateDateBetween(createdAt, new Date().toISOString())
    };
  });
};

const generateNotes = (noteId: { current: number }): Note[] => {
  const numNotes = randomRange(2, 5);
  const notes: Note[] = [];
  
  for (let i = 0; i < numNotes; i++) {
    const category = randomChoice(NOTE_CATEGORIES);
    const templates = NOTE_TEMPLATES[category as keyof typeof NOTE_TEMPLATES];
    const content = randomChoice(templates);
    const createdAt = generateDateInPast(1);
    
    notes.push({
      id: generateId('NOTE', ++noteId.current),
      category,
      content,
      createdAt,
      updatedAt: generateDateBetween(createdAt, new Date().toISOString())
    });
  }
  
  return notes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const generateCaseRecord = (
  id: string,
  personId: string,
  financialItemId: { current: number },
  noteId: { current: number }
): CaseRecord => {
  const createdDate = generateDateInPast(2);
  const applicationDate = generateDateBetween(createdDate, new Date().toISOString());
  
  return {
    id,
    mcn: `MCN${randomRange(100000, 999999)}`,
    applicationDate,
    caseType: randomChoice(CASE_TYPES),
    personId,
    spouseId: Math.random() < 0.3 ? generateId('PER', randomRange(1, 100)) : '',
    status: randomChoice(CASE_STATUSES),
    description: `${randomChoice(CASE_TYPES)} case for comprehensive services and support`,
    priority: Math.random() < 0.2,
    livingArrangement: randomChoice(LIVING_ARRANGEMENTS),
    withWaiver: Math.random() < 0.15,
    admissionDate: applicationDate,
    organizationId: randomChoice(ORGANIZATIONS),
    authorizedReps: [],
    retroRequested: Math.random() < 0.1 ? generateDateInPast(1) : '',
    financials: {
      resources: generateFinancialItems('resources', financialItemId),
      income: generateFinancialItems('income', financialItemId),
      expenses: generateFinancialItems('expenses', financialItemId)
    },
    notes: generateNotes(noteId),
    createdDate,
    updatedDate: generateDateBetween(createdDate, new Date().toISOString())
  };
};

/**
 * Generates comprehensive seed data with specified number of cases
 */
export const generateFullSeedData = (numCases: number = 50): CaseData => {
  console.log(`🌱 Generating seed data with ${numCases} cases...`);
  
  const people: Person[] = [];
  const caseRecords: CaseRecord[] = [];
  
  // Counters for ID generation
  const counters = {
    person: { current: 0 },
    case: { current: 0 },
    financialItem: { current: 0 },
    note: { current: 0 }
  };
  
  // Generate cases with associated people
  for (let i = 0; i < numCases; i++) {
    const personId = generateId('PER', ++counters.person.current);
    const caseId = generateId('CASE', ++counters.case.current);
    
    const person = generatePerson(personId);
    const caseRecord = generateCaseRecord(caseId, personId, counters.financialItem, counters.note);
    
    people.push(person);
    caseRecords.push(caseRecord);
  }
  
  // Generate some additional people without cases (potential clients)
  const extraPeople = Math.floor(numCases * 0.1);
  for (let i = 0; i < extraPeople; i++) {
    const personId = generateId('PER', ++counters.person.current);
    people.push(generatePerson(personId));
  }
  
  const seedData: CaseData = {
    people,
    caseRecords,
    nextPersonId: counters.person.current + 1,
    nextCaseId: counters.case.current + 1,
    nextFinancialItemId: counters.financialItem.current + 1,
    nextNoteId: counters.note.current + 1,
    showAllCases: true,
    showAllContacts: true,
    showAllPeople: true,
    showAllOrganizations: true,
    caseSortReversed: false,
    priorityFilterActive: false,
    contacts: [],
    vrTemplates: [],
    nextVrTemplateId: 1,
    vrCategories: [],
    vrRequests: [],
    nextVrRequestId: 1,
    vrDraftItems: [],
    activeCase: null,
    isDataLoaded: true,
    meta: {
      source: `Generated seed data - ${numCases} cases created on ${new Date().toISOString()}`
    }
  };
  
  // Calculate statistics
  const casesByStatus = CASE_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = caseRecords.filter(c => c.status === status).length;
    return acc;
  }, {});

  const stats = {
    totalPeople: people.length,
    totalCases: caseRecords.length,
    totalFinancialItems: counters.financialItem.current,
    totalNotes: counters.note.current,
    priorityCases: caseRecords.filter(c => c.priority).length,
    casesByStatus,
    financialsByCategory: {
      resources: caseRecords.reduce(
        (sum: number, record: CaseRecord) => sum + record.financials.resources.length,
        0
      ),
      income: caseRecords.reduce(
        (sum: number, record: CaseRecord) => sum + record.financials.income.length,
        0
      ),
      expenses: caseRecords.reduce(
        (sum: number, record: CaseRecord) => sum + record.financials.expenses.length,
        0
      )
    }
  };
  
  console.log('📊 Seed Data Statistics:');
  console.log(`   People: ${stats.totalPeople}`);
  console.log(`   Cases: ${stats.totalCases}`);
  console.log(`   Financial Items: ${stats.totalFinancialItems}`);
  console.log(`   Notes: ${stats.totalNotes}`);
  console.log(`   Priority Cases: ${stats.priorityCases}`);
  console.log(`   Cases by Status:`, stats.casesByStatus);
  console.log(`   Financial Items by Category:`, stats.financialsByCategory);
  
  return seedData;
};

/**
 * Development helper to quickly populate with different data sets
 */
export const seedDataPresets = {
  small: () => generateFullSeedData(10),
  medium: () => generateFullSeedData(25),
  large: () => generateFullSeedData(50),
  stress: () => generateFullSeedData(200),
  demo: () => {
    // Generate a curated demo dataset with specific characteristics
    const data = generateFullSeedData(15);
    
    // Ensure we have some priority cases
    data.caseRecords.slice(0, 3).forEach((caseRecord: CaseRecord) => {
      caseRecord.priority = true;
      caseRecord.status = CASE_STATUSES[CASE_STATUSES.length - 1] ?? caseRecord.status;
    });
    
    // Ensure we have cases in all statuses
    const statuses: CaseRecord['status'][] = [...CASE_STATUSES];
    data.caseRecords.slice(0, statuses.length).forEach((caseRecord: CaseRecord, index: number) => {
      caseRecord.status = statuses[index];
    });
    
    return data;
  }
};

/**
 * Validates generated seed data structure
 */
export const validateSeedData = (data: CaseData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate basic structure
  if (!data.people || !Array.isArray(data.people)) {
    errors.push('Missing or invalid people array');
  }
  
  if (!data.caseRecords || !Array.isArray(data.caseRecords)) {
    errors.push('Missing or invalid caseRecords array');
  }
  
  // Validate people
  data.people?.forEach((person: Person, index: number) => {
    if (!person.id || !person.firstName || !person.lastName) {
      errors.push(`Person at index ${index} missing required fields`);
    }
  });
  
  // Validate case records
  data.caseRecords?.forEach((caseRecord: CaseRecord, index: number) => {
    if (!caseRecord.id || !caseRecord.personId) {
      errors.push(`Case record at index ${index} missing required fields`);
    }
    
    if (!data.people?.find(p => p.id === caseRecord.personId)) {
      errors.push(`Case record at index ${index} references non-existent person ID: ${caseRecord.personId}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Command-line interface for direct execution
export const runGenerateSeedData = async () => {
  const args = process.argv.slice(2);
  const numCases = args[0] ? parseInt(args[0], 10) : 50;
  
  if (isNaN(numCases) || numCases <= 0) {
    console.error('❌ Please provide a valid number of cases to generate');
    process.exit(1);
  }
  
  try {
    const seedData = generateFullSeedData(numCases);
    const validation = validateSeedData(seedData);
    
    if (!validation.isValid) {
      console.error('❌ Generated seed data is invalid:');
      validation.errors.forEach(error => console.error(`   ${error}`));
      process.exit(1);
    }
    
    const filename = `cmsNext-seed-data-${numCases}-cases.json`;
    const fs = await import('fs');
    const path = await import('path');
    
    const outputPath = path.join(process.cwd(), 'data', filename);
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(seedData, null, 2));
    
    console.log('✅ Seed data generated successfully!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Error generating seed data:', error);
    process.exit(1);
  }
};