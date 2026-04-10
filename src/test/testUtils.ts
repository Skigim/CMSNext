import { vi } from 'vitest'
import { AmountHistoryEntry, CaseDisplay, FinancialItem, Note, Person, CaseRecord, CaseCategory, NewPersonData, NewCaseRecordData, type HouseholdMemberData } from '@/types/case'
import { APPLICATION_STATUS, type Application } from '@/types/application'
import type { NormalizedFileData, StoredCase, StoredFinancialItem, StoredNote } from '@/utils/services/FileStorageService'
import type { FileStorageLifecycleSelectors } from '@/contexts/FileStorageContext'
import { mergeCategoryConfig } from '@/types/categoryConfig'
import { createBlankHouseholdMemberData, normalizeHouseholdMemberDraft } from '@/domain/cases'
import type { IntakeFormData } from '@/domain/validation/intake.schema'
import {
  dehydrateNormalizedData,
  type NormalizedFileDataV20,
  type PersistedNormalizedFileDataV21,
  type PersistedNormalizedFileDataV22,
  type RuntimeNormalizedFileDataV22,
} from '@/utils/persistedV22Storage'
import type { DailyActivityReport, CaseActivityLogState } from '@/types/activityLog'
import type { AlertWithMatch } from '@/utils/alertsData'
import type { AppNavigationConfig } from '@/components/app/AppNavigationShell'

/**
 * Test data factories for creating mock data objects
 */

const createBaseNormalizedMetadata = () => ({
  exported_at: '2026-01-01T00:00:00.000Z',
  total_cases: 0,
  categoryConfig: mergeCategoryConfig(),
  activityLog: [],
})

const createBaseFinancialItemFields = (category: CaseCategory) => {
  const timestamp = new Date().toISOString()

  return {
    id: `${category}-test-1`,
    description: `Test ${category} item`,
    amount: 1000,
    location: 'Test Bank',
    accountNumber: '1234',
    verificationStatus: 'Needs VR',
    frequency: category === 'resources' ? undefined : 'monthly',
    notes: 'Test notes',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

const createBaseNoteFields = () => {
  const timestamp = new Date().toISOString()

  return {
    id: 'note-test-1',
    content: 'This is a test note',
    category: 'General',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const createMockAmountHistoryEntry = (overrides: Partial<AmountHistoryEntry> = {}): AmountHistoryEntry => ({
  id: 'entry-test-1',
  amount: 1000,
  startDate: '2025-06-01',
  endDate: null,
  createdAt: '2025-06-01T00:00:00.000Z',
  ...overrides,
})

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
  familyMemberIds: [],
  legacyFamilyMemberNames: [],
  normalizedRelationships: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  dateAdded: new Date().toISOString(),
  ...overrides
})

export const createMockFinancialItem = (category: CaseCategory, overrides: Partial<FinancialItem> = {}): FinancialItem => ({
  ...createBaseFinancialItemFields(category),
  ...overrides
})

export const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  ...createBaseNoteFields(),
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
  intakeCompleted: true,
  ...overrides
})

export type CaseDisplayOverrides = Partial<Omit<CaseDisplay, 'person' | 'caseRecord'>> & {
  person?: Partial<CaseDisplay['person']>
  caseRecord?: Partial<CaseDisplay['caseRecord']>
}

export const createMockCaseDisplay = (overrides: CaseDisplayOverrides = {}): CaseDisplay => {
  const person = createMockPerson(overrides.person ?? {})
  const caseRecord = createMockCaseRecord({
    personId: person.id,
    ...overrides.caseRecord,
  })
  
  return {
    id: 'case-test-1',
    name: `${person.firstName} ${person.lastName}`,
    mcn: 'MCN123456',
    status: 'Pending',
    priority: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
    person,
    caseRecord,
  }
}

/**
 * Normalized data factories for v2.1 storage format
 */

export const createMockStoredCase = (overrides: Partial<StoredCase> = {}): StoredCase => {
  const basePerson = createMockPerson()
  const person = overrides.person ?? basePerson
  const timestamp = new Date().toISOString()
  const providedPeople = overrides.people ?? [{ personId: person.id, role: 'applicant', isPrimary: true }]
  const primaryRefForPerson =
    providedPeople.find((ref) => ref.personId === person.id && ref.isPrimary) ??
    providedPeople.find((ref) => ref.personId === person.id) ??
    { personId: person.id, role: 'applicant' as const, isPrimary: true }
  const people = providedPeople.some(
    (ref) =>
      ref.personId === primaryRefForPerson.personId &&
      ref.role === primaryRefForPerson.role &&
      ref.isPrimary === primaryRefForPerson.isPrimary,
  )
    ? providedPeople
    : [primaryRefForPerson, ...providedPeople]
  const linkedPeople = overrides.linkedPeople ?? [
    {
      ref: primaryRefForPerson,
      person,
    },
  ]
  const caseRecord: StoredCase['caseRecord'] = {
    id: 'case-record-test-1',
    mcn: 'MCN123456',
    applicationDate: timestamp,
    caseType: 'Medical Assistance',
    personId: person.id,
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
    intakeCompleted: true,
    ...overrides.caseRecord,
  }
   
  return {
    id: 'case-test-1',
    name: `${person.firstName} ${person.lastName}`,
    mcn: 'MCN123456',
    status: 'Pending',
    priority: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    people,
    person,
    linkedPeople,
    caseRecord,
    ...overrides
  }
}

export const createMockNormalizedFileData = (
  overrides: Partial<NormalizedFileData> = {},
): RuntimeNormalizedFileDataV22 => ({
  people: [],
  cases: [],
  applications: [],
  financials: [],
  notes: [],
  alerts: [],
  ...createBaseNormalizedMetadata(),
  ...overrides,
  version: '2.2',
})

export const TEST_TRANSACTION_TIMESTAMP = '2026-04-08T10:00:00.000Z'

export const TEST_SKEWED_TRANSACTION_TIMESTAMP = '2026-04-08T10:00:01.000Z'

export const applyTouchedCaseTimestamps = (
  cases: StoredCase[],
  touchedCaseIds?: Iterable<string>,
  timestampOverride?: string,
): StoredCase[] => {
  if (!touchedCaseIds) {
    return cases
  }

  const caseIds = new Set(touchedCaseIds)
  if (caseIds.size === 0) {
    return cases
  }

  const timestamp = timestampOverride ?? new Date().toISOString()
  return cases.map((caseItem) =>
    caseIds.has(caseItem.id) ? { ...caseItem, updatedAt: timestamp } : caseItem,
  )
}

export const createClockSkewTouchCaseTimestamps = (
  skewedTimestamp: string,
  delegate: typeof applyTouchedCaseTimestamps = applyTouchedCaseTimestamps,
) => (
  cases: StoredCase[],
  touchedCaseIds?: Iterable<string>,
  timestampOverride?: string,
): StoredCase[] => {
  vi.setSystemTime(new Date(skewedTimestamp))
  return delegate(cases, touchedCaseIds, timestampOverride)
}

export async function withFrozenSystemTime<T>(
  timestamp: string,
  callback: () => Promise<T> | T,
): Promise<T> {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(timestamp))

  try {
    return await callback()
  } finally {
    vi.useRealTimers()
  }
}

export const createMockPersistedNormalizedFileData = (
  overrides: Partial<NormalizedFileData> = {},
): PersistedNormalizedFileDataV22 => dehydrateNormalizedData(createMockNormalizedFileData(overrides))

export const createMockPersistedNormalizedFileDataV21 = (
  overrides: Partial<NormalizedFileData> = {},
): PersistedNormalizedFileDataV21 => ({
  ...dehydrateNormalizedData(createMockNormalizedFileData(overrides)),
  version: '2.1',
})

export const createMockApplication = (
  overrides: Partial<Application> = {},
): Application => ({
  id: 'application-test-1',
  caseId: 'case-test-1',
  applicantPersonId: 'person-test-1',
  applicationDate: '2026-01-01',
  applicationType: 'New',
  status: APPLICATION_STATUS.Pending,
  statusHistory: [
    {
      id: 'application-history-1',
      status: APPLICATION_STATUS.Pending,
      effectiveDate: '2026-01-01',
      changedAt: '2026-01-01T00:00:00.000Z',
      source: 'migration',
    },
  ],
  hasWaiver: false,
  retroRequestedAt: null,
  retroMonths: [],
  verification: {
    isAppValidated: false,
    isAgedDisabledVerified: false,
    isCitizenshipVerified: false,
    isResidencyVerified: false,
    avsConsentDate: '',
    voterFormStatus: '',
    isIntakeCompleted: true,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

export const createMockNormalizedFileDataV20 = (
  overrides: Partial<NormalizedFileDataV20> = {},
): NormalizedFileDataV20 => ({
  version: '2.0',
  cases: [],
  financials: [],
  notes: [],
  alerts: [],
  ...createBaseNormalizedMetadata(),
  ...overrides,
})

export const omitHydratedPerson = <T extends StoredCase>({
  person: _omittedPerson,
  ...caseWithoutHydratedPerson
}: T): Omit<T, 'person'> => caseWithoutHydratedPerson;

export const createMockNewPersonData = (overrides: Partial<NewPersonData> = {}): NewPersonData => ({
  firstName: 'Casey',
  lastName: 'Tester',
  email: 'casey@example.com',
  phone: '555-0101',
  dateOfBirth: '1990-01-01',
  ssn: '123-45-6789',
  organizationId: null,
  livingArrangement: 'Home',
  address: {
    street: '123 Main St',
    city: 'Test City',
    state: 'TC',
    zip: '12345',
  },
  mailingAddress: {
    street: '123 Main St',
    city: 'Test City',
    state: 'TC',
    zip: '12345',
    sameAsPhysical: true,
  },
  authorizedRepIds: [],
  familyMembers: [],
  relationships: [],
  ...overrides,
})

export const createMockHouseholdMemberData = (
  overrides: Partial<HouseholdMemberData> = {},
): IntakeFormData["householdMembers"][number] =>
  normalizeHouseholdMemberDraft({
    ...createBlankHouseholdMemberData({
      livingArrangement: 'Community',
      defaultState: 'NE',
    }),
    firstName: 'Jordan',
    lastName: 'Tester',
    relationshipType: 'Spouse',
    role: 'household_member',
    phone: '5559876543',
    email: 'jordan@example.com',
    dateOfBirth: '1985-02-03',
    address: {
      street: '',
      apt: '',
      city: '',
      state: 'NE',
      zip: '',
    },
    mailingAddress: {
      street: '',
      apt: '',
      city: '',
      state: 'NE',
      zip: '',
      sameAsPhysical: true,
    },
    ...overrides,
  }) as IntakeFormData["householdMembers"][number]

export const createMockNewCaseRecordData = (overrides: Partial<NewCaseRecordData> = {}): NewCaseRecordData => ({
  mcn: 'MCN-0001',
  applicationDate: '2024-01-01',
  caseType: 'Sample',
  personId: 'temp-person-id',
  spouseId: '',
  status: 'Pending',
  description: 'Test case',
  priority: false,
  livingArrangement: 'Home',
  withWaiver: false,
  admissionDate: '2024-01-05',
  organizationId: 'org-1',
  authorizedReps: [],
  retroRequested: '',
  intakeCompleted: true,
  ...overrides,
})

export const createMockFileStorageLifecycleSelectors = (
  overrides: Partial<FileStorageLifecycleSelectors> = {},
): FileStorageLifecycleSelectors => ({
  lifecycle: 'ready',
  permissionStatus: 'granted',
  isReady: true,
  isBlocked: false,
  isErrored: false,
  isRecovering: false,
  isAwaitingUserChoice: false,
  hasStoredHandle: true,
  isConnected: true,
  lastError: null,
  ...overrides,
})

export const createMockDailyActivityReport = (
  overrides: Partial<DailyActivityReport> = {},
): DailyActivityReport => {
  const { totals, ...remainingOverrides } = overrides

  return {
    date: '2025-01-01',
    entries: [],
    cases: [],
    ...remainingOverrides,
    totals: {
      total: 0,
      statusChanges: 0,
      priorityChanges: 0,
      notesAdded: 0,
      applicationChanges: 0,
      ...totals,
    },
  }
}

export const createMockCaseActivityLogState = (
  overrides: Partial<CaseActivityLogState> = {},
): CaseActivityLogState => {
  const emptyReport = createMockDailyActivityReport()

  return {
    activityLog: [],
    dailyReports: [],
    todayReport: null,
    yesterdayReport: null,
    loading: false,
    error: null,
    refreshActivityLog: vi.fn().mockResolvedValue(undefined),
    getReportForDate: vi.fn(() => emptyReport),
    clearReportForDate: vi.fn().mockResolvedValue(0),
    ...overrides,
  }
}

export const createMockAlertWithMatch = (
  overrides: Partial<AlertWithMatch> = {},
): AlertWithMatch => {
  const timestamp = '2025-09-01T00:00:00.000Z'

  return {
    id: globalThis.crypto.randomUUID(),
    reportId: 'report-1',
    alertCode: 'AL-1',
    alertType: 'Notice',
    alertDate: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    mcNumber: 'MCN123',
    personName: 'Jamie Rivera',
    program: 'Medicaid',
    region: 'Region 1',
    state: 'FL',
    source: 'Import',
    description: 'Follow up with client',
    status: 'new',
    resolvedAt: null,
    resolutionNotes: undefined,
    metadata: {},
    matchStatus: 'matched',
    matchedCaseId: undefined,
    matchedCaseName: undefined,
    matchedCaseStatus: undefined,
    ...overrides,
  }
}

export const createMockAppNavigation = (
  overrides: Partial<AppNavigationConfig> = {},
): AppNavigationConfig => ({
  currentView: 'dashboard',
  breadcrumbTitle: 'Dashboard',
  sidebarOpen: true,
  onNavigate: vi.fn(),
  onNewCase: vi.fn(),
  onSidebarOpenChange: vi.fn(),
  ...overrides,
})

export const createMockStoredFinancialItem = (
  category: CaseCategory, 
  caseId: string = 'case-test-1',
  overrides: Partial<StoredFinancialItem> = {}
): StoredFinancialItem => ({
  ...createBaseFinancialItemFields(category),
  caseId,
  category,
  ...overrides
})

export const createMockStoredNote = (
  caseId: string = 'case-test-1',
  overrides: Partial<StoredNote> = {}
): StoredNote => ({
  ...createBaseNoteFields(),
  caseId,
  ...overrides
})

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
  getAllPeople: vi.fn().mockResolvedValue([createMockPerson()]),
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
 * Component test helpers
 */

const hoistedMockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn()
}))

export const mockToast = hoistedMockToast

// Mock the toast library while preserving other exports like Toaster
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: hoistedMockToast
  };
})

export { mockToast as toast }
