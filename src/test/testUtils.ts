import { vi } from 'vitest'
import { CaseDisplay, FinancialItem, Note, Person, CaseRecord, CaseCategory } from '../../types/case'

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
  status: 'In Progress',
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
    status: 'In Progress',
    priority: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    person,
    caseRecord,
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
  loadAllCases: vi.fn().mockResolvedValue([createMockCaseDisplay()]),
  createCompleteCase: vi.fn().mockImplementation((data) => 
    Promise.resolve(createMockCaseDisplay({ ...data, id: 'new-case-id' }))
  ),
  updateCase: vi.fn().mockImplementation((id, data) => 
    Promise.resolve(createMockCaseDisplay({ id, ...data }))
  ),
  deleteCase: vi.fn().mockResolvedValue(undefined),
  
  // Financial item operations
  addItem: vi.fn().mockImplementation((caseId, category, data) => 
    Promise.resolve(createMockCaseDisplay({
      id: caseId,
      caseRecord: createMockCaseRecord({
        financials: {
          resources: [],
          income: [],
          expenses: [],
          [category]: [createMockFinancialItem(category, data)]
        }
      })
    }))
  ),
  updateItem: vi.fn().mockImplementation((caseId, _category, _itemId, _data) => 
    Promise.resolve(createMockCaseDisplay({ id: caseId }))
  ),
  deleteItem: vi.fn().mockImplementation((caseId, _category, _itemId) => 
    Promise.resolve(createMockCaseDisplay({ id: caseId }))
  ),
  
  // Note operations
  addNote: vi.fn().mockImplementation((caseId, data) => 
    Promise.resolve(createMockCaseDisplay({
      id: caseId,
      caseRecord: createMockCaseRecord({
        notes: [createMockNote(data)]
      })
    }))
  ),
  updateNote: vi.fn().mockImplementation((caseId, _noteId, _data) => 
    Promise.resolve(createMockCaseDisplay({ id: caseId }))
  ),
  deleteNote: vi.fn().mockImplementation((caseId, _noteId) => 
    Promise.resolve(createMockCaseDisplay({ id: caseId }))
  )
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
  loading: vi.fn(),
  dismiss: vi.fn()
}

// Mock the toast library
vi.mock('sonner', () => ({
  toast: mockToast
}))

export { mockToast as toast }