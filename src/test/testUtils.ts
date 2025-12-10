import { vi } from 'vitest'
import { CaseDisplay, FinancialItem, Note, Person, CaseRecord, CaseCategory } from '@/types/case'
import type { StoredCase, StoredFinancialItem, StoredNote, NormalizedFileData } from '@/utils/services/FileStorageService'
import { mergeCategoryConfig } from '@/types/categoryConfig'

/**
 * Test data factories for creating mock data objects
 */

export const createMockPerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'person-test-1',
  firstName: 'John',
  lastName: 'Doe',
  name: 'John Doe',
  phone: '555-0123',
  email: 'john.doe@example.com',
  address: {
    street: '123 Test St',
    city: 'Test City',
    state: 'TC',
    zip: '12345'
  },
  mailingAddress: {
    street: '123 Test St',
    city: 'Test City',
    state: 'TC',
    zip: '12345',
    sameAsPhysical: true
  },
  dateOfBirth: '1990-01-01',
  ssn: '***-**-1234',
  organizationId: null,
  livingArrangement: 'Home',
  authorizedRepIds: [],
  familyMembers: [],
  status: 'Active',
  createdAt: new Date().toISOString(),
  dateAdded: new Date().toISOString(),
  ...overrides
})

export const createMockFinancialItem = (category: CaseCategory, overrides: Partial<FinancialItem> = {}): FinancialItem => ({
  id: `${category}-test-1`,
  description: `Test ${category} item`,
  amount: 1000,
  location: 'Test Bank',
  accountNumber: '1234',
  verificationStatus: 'Needs VR',
  frequency: category !== 'resources' ? 'monthly' : undefined,
  notes: 'Test notes',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

export const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: 'note-test-1',
  content: 'This is a test note',
  category: 'General',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

export const createMockCaseRecord = (overrides: Partial<CaseRecord> = {}): CaseRecord => ({
  id: 'case-record-test-1',
  mcn: 'MCN123456',
  applicationDate: new Date().toISOString(),
  caseType: 'Medical Assistance',
  personId: 'person-test-1',
  spouseId: '',
  status: 'Pending',
  description: 'Test case description',
  priority: false,
  livingArrangement: 'Home',
  withWaiver: false,
  admissionDate: new Date().toISOString(),
  organizationId: 'org-1',
  authorizedReps: [],
  retroRequested: '',
  financials: {
    resources: [createMockFinancialItem('resources')],
    income: [createMockFinancialItem('income')],
    expenses: [createMockFinancialItem('expenses')]
  },
  notes: [createMockNote()],
  createdDate: new Date().toISOString(),
  updatedDate: new Date().toISOString(),
  ...overrides
})

export const createMockCaseDisplay = (overrides: Partial<CaseDisplay> = {}): CaseDisplay => {
  const person = createMockPerson()
  const caseRecord = createMockCaseRecord()
  
  return {
    id: 'case-test-1',
    name: `${person.firstName} ${person.lastName}`,
    mcn: 'MCN123456',
  status: 'Pending',
    priority: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    person,
    caseRecord,
    ...overrides
  }
}

/**
 * Normalized data factories for v2.0 storage format
 */

export const createMockStoredCase = (overrides: Partial<StoredCase> = {}): StoredCase => {
  const person = createMockPerson()
  const timestamp = new Date().toISOString()
  
  return {
    id: 'case-test-1',
    name: `${person.firstName} ${person.lastName}`,
    mcn: 'MCN123456',
    status: 'Pending',
    priority: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    person,
    caseRecord: {
      id: 'case-record-test-1',
      mcn: 'MCN123456',
      applicationDate: timestamp,
      caseType: 'Medical Assistance',
      personId: 'person-test-1',
      spouseId: '',
      status: 'Pending',
      description: 'Test case description',
      priority: false,
      livingArrangement: 'Home',
      withWaiver: false,
      admissionDate: timestamp,
      organizationId: 'org-1',
      authorizedReps: [],
      retroRequested: '',
      createdDate: timestamp,
      updatedDate: timestamp,
    },
    ...overrides
  }
}

export const createMockStoredFinancialItem = (
  category: CaseCategory, 
  caseId: string = 'case-test-1',
  overrides: Partial<StoredFinancialItem> = {}
): StoredFinancialItem => ({
  id: `${category}-test-1`,
  caseId,
  category,
  description: `Test ${category} item`,
  amount: 1000,
  location: 'Test Bank',
  accountNumber: '1234',
  verificationStatus: 'Needs VR',
  frequency: category !== 'resources' ? 'monthly' : undefined,
  notes: 'Test notes',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

export const createMockStoredNote = (
  caseId: string = 'case-test-1',
  overrides: Partial<StoredNote> = {}
): StoredNote => ({
  id: 'note-test-1',
  caseId,
  content: 'This is a test note',
  category: 'General',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

export const createMockNormalizedFileData = (overrides: Partial<NormalizedFileData> = {}): NormalizedFileData => {
  const storedCase = createMockStoredCase()
  return {
    version: '2.0',
    cases: [storedCase],
    financials: [
      createMockStoredFinancialItem('resources', storedCase.id),
      createMockStoredFinancialItem('income', storedCase.id),
      createMockStoredFinancialItem('expenses', storedCase.id),
    ],
    notes: [createMockStoredNote(storedCase.id)],
    alerts: [],
    exported_at: new Date().toISOString(),
    total_cases: 1,
    categoryConfig: mergeCategoryConfig(),
    activityLog: [],
    ...overrides
  }
}

/**
 * Mock implementations for various services
 */

export const createMockFileHandle = () => ({
  name: 'test-file.json',
  kind: 'file' as const,
  getFile: vi.fn().mockResolvedValue(new File(['{}'], 'test-file.json', { type: 'application/json' })),
  createWritable: vi.fn().mockResolvedValue({
    write: vi.fn(),
    close: vi.fn()
  }),
  queryPermission: vi.fn().mockResolvedValue('granted' as PermissionState),
  requestPermission: vi.fn().mockResolvedValue('granted' as PermissionState)
})

export const createMockDirectoryHandle = () => ({
  name: 'test-directory',
  kind: 'directory' as const,
  getFileHandle: vi.fn().mockResolvedValue(createMockFileHandle()),
  getDirectoryHandle: vi.fn(),
  removeEntry: vi.fn(),
  keys: vi.fn().mockReturnValue([]),
  values: vi.fn().mockReturnValue([]),
  entries: vi.fn().mockReturnValue([]),
  queryPermission: vi.fn().mockResolvedValue('granted' as PermissionState),
  requestPermission: vi.fn().mockResolvedValue('granted' as PermissionState),
  [Symbol.asyncIterator]: vi.fn().mockReturnValue({
    next: vi.fn().mockResolvedValue({ done: true })
  })
})

export const createMockDataManager = () => ({
  // Case operations
  getAllCases: vi.fn().mockResolvedValue([createMockStoredCase()]),
  createCompleteCase: vi.fn().mockImplementation((data) => 
    Promise.resolve(createMockStoredCase({ ...data, id: 'new-case-id' }))
  ),
  updateCompleteCase: vi.fn().mockImplementation((id, data) => 
    Promise.resolve(createMockStoredCase({ id, ...data }))
  ),
  deleteCase: vi.fn().mockResolvedValue(undefined),
  
  // Financial item operations
  addItem: vi.fn().mockImplementation((caseId, category, data) => 
    Promise.resolve(createMockStoredFinancialItem(category, caseId, data))
  ),
  updateItem: vi.fn().mockImplementation((caseId, category, itemId, data) => 
    Promise.resolve(createMockStoredFinancialItem(category, caseId, { id: itemId, ...data }))
  ),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  
  // Note operations
  addNote: vi.fn().mockImplementation((caseId, data) => 
    Promise.resolve(createMockStoredNote(caseId, data))
  ),
  updateNote: vi.fn().mockImplementation((caseId, noteId, data) => 
    Promise.resolve(createMockStoredNote(caseId, { id: noteId, ...data }))
  ),
  deleteNote: vi.fn().mockResolvedValue(undefined),

  // Category configuration
  getCategoryConfig: vi.fn().mockResolvedValue(mergeCategoryConfig()),
  updateCategoryConfig: vi.fn().mockResolvedValue(mergeCategoryConfig()),
  updateCategoryValues: vi.fn().mockResolvedValue(mergeCategoryConfig()),
  resetCategoryConfig: vi.fn().mockResolvedValue(mergeCategoryConfig()),
  
  // Alert operations
  getAlertsIndex: vi.fn().mockResolvedValue({ alerts: [], stats: { total: 0, new: 0, inProgress: 0, resolved: 0 } }),
  updateAlertStatus: vi.fn().mockResolvedValue(null),
  
  // Activity Log
  getActivityLog: vi.fn().mockResolvedValue([]),
  clearActivityLogForDate: vi.fn().mockResolvedValue(0),
})

/**
 * Mock CategoryConfigContext value for component tests
 * This allows testing components that use useCategoryConfig without DataManager
 */
export const createMockCategoryConfigValue = (configOverrides?: Parameters<typeof mergeCategoryConfig>[0]) => ({
  config: mergeCategoryConfig(configOverrides),
  loading: false,
  error: null,
  refresh: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  resetToDefaults: vi.fn().mockResolvedValue(undefined),
  setConfigFromFile: vi.fn(),
})

/**
 * Test environment utilities
 */

export const mockConsoleError = () => {
  const originalError = console.error
  const mockError = vi.fn()
  console.error = mockError
  
  return {
    mockError,
    restore: () => {
      console.error = originalError
    }
  }
}

export const mockConsoleWarn = () => {
  const originalWarn = console.warn
  const mockWarn = vi.fn()
  console.warn = mockWarn
  
  return {
    mockWarn,
    restore: () => {
      console.warn = originalWarn
    }
  }
}

/**
 * Async utilities for testing
 */

export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0))

export const waitFor = (condition: () => boolean, timeout = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    
    const check = () => {
      if (condition()) {
        resolve()
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'))
      } else {
        setTimeout(check, 10)
      }
    }
    
    check()
  })
}

/**
 * Component test helpers
 */

export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn()
}

// Mock the toast library while preserving other exports like Toaster
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: mockToast
  };
})

export { mockToast as toast }