import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DataManager } from '@/utils/DataManager'
import { createMockCaseDisplay, createMockCaseRecord, createMockFinancialItem, createMockNote } from '@/src/test/testUtils'
import { mergeCategoryConfig } from '@/types/categoryConfig'
import AutosaveFileService from '@/utils/AutosaveFileService'
import * as alertsData from '@/utils/alertsData'
import { reportFileStorageError } from '@/utils/fileStorageErrorReporter'

type AlertWithMatch = alertsData.AlertWithMatch

vi.mock('@/utils/fileStorageErrorReporter', () => ({
  reportFileStorageError: vi.fn(() => null),
}));

// Mock the AutosaveFileService
vi.mock('@/utils/AutosaveFileService')

// Mock the dataTransform module
vi.mock('@/utils/dataTransform', () => ({
  transformImportedData: vi.fn((data) => {
    // Mock transformation that returns an array of cases
    if (data.people && data.caseRecords) {
      return [createMockCaseDisplay()]
    }
    return []
  })
}))

const createFileData = (overrides: Record<string, unknown> = {}) => ({
  cases: [],
  exported_at: new Date().toISOString(),
  total_cases: 0,
  categoryConfig: mergeCategoryConfig(),
  ...overrides,
})

const buildAlert = (overrides: Partial<AlertWithMatch> = {}): AlertWithMatch => ({
  id: 'alert-1',
  reportId: 'alert-1',
  alertCode: 'AL-101',
  alertType: 'Recertification Due',
  severity: 'High',
  alertDate: '2025-09-20T00:00:00.000Z',
  createdAt: '2025-09-20T00:00:00.000Z',
  updatedAt: '2025-09-20T00:00:00.000Z',
  mcNumber: '12345',
  personName: 'Jane Doe',
  program: 'Medicaid',
  region: 'North',
  state: 'WA',
  source: 'Import',
  description: 'Recertification interview due',
  status: 'new',
  resolvedAt: null,
  resolutionNotes: undefined,
  metadata: {},
  matchStatus: 'matched',
  matchedCaseId: 'case-1',
  matchedCaseName: 'Jane Doe',
  matchedCaseStatus: 'Active',
  ...overrides,
})

describe('DataManager', () => {
  let dataManager: DataManager
  let mockAutosaveService: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Create mock autosave service
    mockAutosaveService = {
      initialize: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue(createFileData()),
      readNamedFile: vi.fn().mockResolvedValue(null),
      readTextFile: vi.fn().mockResolvedValue(null),
  writeFile: vi.fn().mockResolvedValue(true),
  writeNamedFile: vi.fn().mockResolvedValue(true),
      writeTextFile: vi.fn().mockResolvedValue(true),
      saveData: vi.fn().mockResolvedValue(true),
      startBatchMode: vi.fn(),
      endBatchMode: vi.fn(),
      isSupported: true,
      getFullData: vi.fn().mockReturnValue(createFileData()),
      getStatus: vi.fn().mockReturnValue({
        permissionStatus: 'granted',
        isConnected: true,
        hasData: true
      }),
      notifyDataChange: vi.fn()
    }

    // Mock the AutosaveFileService constructor
    vi.mocked(AutosaveFileService).mockReturnValue(mockAutosaveService)

    // Create DataManager instance
    dataManager = new DataManager({ fileService: mockAutosaveService })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('readFileData edge cases', () => {
    it('should handle null file data', async () => {
      mockAutosaveService.readFile.mockResolvedValue(null)

      const cases = await dataManager.getAllCases()

      expect(cases).toEqual([])
    })

    it('should handle raw data format with people and caseRecords', async () => {
      mockAutosaveService.readFile.mockResolvedValue({
        people: [{ id: '1', name: 'John Doe' }],
        caseRecords: [{ id: '1', personId: '1' }]
      })

      const cases = await dataManager.getAllCases()

      expect(cases).toHaveLength(1)
    })

    it('should handle unknown data format and transform it', async () => {
      mockAutosaveService.readFile.mockResolvedValue({
        unknownFormat: true,
        someData: 'test'
      })

      const cases = await dataManager.getAllCases()

      expect(cases).toEqual([])
    })

    it('should handle exportedAt vs exported_at field variations', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue({
        cases: [mockCase],
        exportedAt: '2023-01-01T00:00:00.000Z',
        total_cases: 1
      })

      const cases = await dataManager.getAllCases()

      expect(cases).toHaveLength(1)
    })

    it('should handle read errors gracefully', async () => {
      mockAutosaveService.readFile.mockRejectedValue(new Error('File read error'))

      await expect(dataManager.getAllCases()).rejects.toThrow('Failed to read case data: File read error')
    })

    it('should handle non-Error objects in read errors', async () => {
      mockAutosaveService.readFile.mockRejectedValue('String error')

      await expect(dataManager.getAllCases()).rejects.toThrow('Failed to read case data: Unknown error')
    })

    it('should normalize notes missing identifiers when reading cases', async () => {
      const legacyCase = createMockCaseDisplay()
      const timestamp = new Date().toISOString()

      legacyCase.caseRecord.notes = [
        { id: '', category: '', content: 'Legacy note', createdAt: '', updatedAt: '' } as any,
        { id: undefined as any, category: 'General', content: 'Second legacy note', createdAt: timestamp, updatedAt: '' } as any,
      ]

      mockAutosaveService.readFile.mockResolvedValue({
        cases: [legacyCase],
        exported_at: new Date().toISOString(),
        total_cases: 1,
      })

      const cases = await dataManager.getAllCases()

      expect(cases).toHaveLength(1)
      expect(cases[0].caseRecord.notes.every(note => typeof note.id === 'string' && note.id.trim().length > 0)).toBe(true)
      expect(mockAutosaveService.writeFile).toHaveBeenCalledTimes(1)

      const writePayload = mockAutosaveService.writeFile.mock.calls[0][0]
      expect(writePayload.cases[0].caseRecord.notes.every((note: any) => typeof note.id === 'string' && note.id.trim().length > 0)).toBe(true)
    })
  })

  describe('alerts storage', () => {
    afterEach(() => {
      mockAutosaveService.readNamedFile.mockResolvedValue(null)
      mockAutosaveService.readTextFile.mockResolvedValue(null)
      mockAutosaveService.writeNamedFile.mockResolvedValue(true)
    })

    it('loads alerts from json store when available', async () => {
      const alert = buildAlert({ status: 'resolved', resolvedAt: '2025-09-30T00:00:00.000Z' })
      mockAutosaveService.readNamedFile.mockResolvedValue({
        version: 3,
        generatedAt: '2025-09-30T00:00:00.000Z',
        summary: {
          total: 1,
          matched: 1,
          unmatched: 0,
          missingMcn: 0,
          latestUpdated: '2025-09-30T00:00:00.000Z',
        },
        alerts: [alert],
        uniqueAlerts: 1,
      })

      const index = await dataManager.getAlertsIndex({ cases: [] })

      expect(index.summary.total).toBe(1)
      expect(index.alerts[0].id).toBe(alert.id)
      expect(mockAutosaveService.readNamedFile).toHaveBeenCalledWith('alerts.json')
      expect(mockAutosaveService.readTextFile).not.toHaveBeenCalled()
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({
          version: 3,
          alerts: expect.arrayContaining([
            expect.objectContaining({ id: alert.id }),
          ]),
        }),
      )
    })

    it('imports csv when json snapshot missing', async () => {
      const mockCase = createMockCaseDisplay({
        id: 'case-1',
        mcn: '12345',
        caseRecord: createMockCaseRecord({ id: 'record-1', mcn: '12345' })
      })
      const sampleCsv = '"DEPARTMENT OF HEALTH AND HUMAN SERVICES","List Position Alert ","Office","GENEVA - ELIGIBILITY","Number\n\n","61704790","TAYLOR HARRIS","Page -1 of 1","Due Date","Display Date","MC#"," Name","Program","Type","Description","Alert_Number",,09-22-2025,12345,"DOE,JANE","MEDICAID","WRKRM","POLICY RESPONSE",9996,"    Total:",64,"N-FOCUS: NFO6091L01","Monday, September 22, 2025   1:59 pm"'
      mockAutosaveService.readTextFile.mockResolvedValueOnce(sampleCsv)

      const index = await dataManager.getAlertsIndex({ cases: [mockCase] })
      await Promise.resolve()

      expect(index.summary.total).toBe(1)
      expect(index.summary.matched).toBe(1)
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({
          version: 3,
          summary: expect.objectContaining({ total: 1, matched: 1 }),
          alerts: expect.arrayContaining([
            expect.objectContaining({
              alertType: 'WRKRM',
              status: 'new',
              mcNumber: '12345',
            })
          ]),
          uniqueAlerts: 1,
        }),
      )
    })

    it('uses stacked parser output for alert index', async () => {
      const mockCase = createMockCaseDisplay({
        id: 'case-stacked',
        mcn: '7777',
        caseRecord: createMockCaseRecord({ id: 'record-stacked', mcn: '7777' })
      })

      const baseAlert = buildAlert({
        id: 'stacked-alert',
        reportId: 'stacked-alert',
        mcNumber: '7777',
        matchedCaseId: 'case-stacked',
        matchStatus: 'matched'
      })

      const stackedIndex = alertsData.createAlertsIndexFromAlerts([baseAlert])
      const parseStackedSpy = vi.spyOn(alertsData, 'parseStackedAlerts').mockReturnValueOnce(stackedIndex)

      mockAutosaveService.readTextFile.mockResolvedValueOnce('csv-content')

  const index = await dataManager.getAlertsIndex({ cases: [mockCase] })
  await Promise.resolve()
      expect(index.summary.total).toBe(1)
      expect(index.alerts[0].id).toBe('stacked-alert')
      expect(parseStackedSpy).toHaveBeenCalledWith('csv-content', [mockCase])
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({
          version: 3,
          alerts: expect.arrayContaining([
            expect.objectContaining({ id: 'stacked-alert' })
          ]),
        }),
      )
    })

    it('migrates workflow snapshot from legacy json', async () => {
      const mockCase = createMockCaseDisplay({ id: 'case-merge', mcn: '9999', caseRecord: createMockCaseRecord({ id: 'record-merge', mcn: '9999' }) })

    const csvAlert = buildAlert({ id: 'alert-merge', reportId: 'alert-merge', status: 'new', resolvedAt: null, resolutionNotes: undefined })
    const stackedIndex = alertsData.createAlertsIndexFromAlerts([csvAlert])
    vi.spyOn(alertsData, 'parseStackedAlerts').mockReturnValue(stackedIndex)
      mockAutosaveService.readNamedFile.mockResolvedValueOnce({
        version: 1,
        alerts: [
          {
            alertId: 'alert-merge',
            status: 'resolved',
            resolvedAt: '2025-09-29T12:00:00.000Z',
            resolutionNotes: 'Documented'
          }
        ],
        updatedAt: '2025-09-28T00:00:00.000Z'
      })
      mockAutosaveService.readTextFile.mockResolvedValueOnce('csv-input')

      const index = await dataManager.getAlertsIndex({ cases: [mockCase] })
      await Promise.resolve()

      const mergedAlert = index.alerts.find(alert => alert.id === 'alert-merge')
      expect(mergedAlert?.status).toBe('resolved')
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({
          version: 3,
          alerts: expect.arrayContaining([
            expect.objectContaining({
              id: 'alert-merge',
              status: 'resolved',
              resolvedAt: '2025-09-29T12:00:00.000Z',
            })
          ]),
        }),
      )
    })

    it('updates alert status and persists changes to alerts.json', async () => {
      const mockCase = createMockCaseDisplay({ id: 'case-update', mcn: '5555', caseRecord: createMockCaseRecord({ id: 'record-update', mcn: '5555' }) })

      const storedAlert = buildAlert({
        id: 'alert-update',
        reportId: 'alert-update',
        mcNumber: '5555',
        matchedCaseId: 'case-update',
        matchStatus: 'matched',
        status: 'new',
      })

      mockAutosaveService.readNamedFile.mockResolvedValueOnce({
        version: 3,
        generatedAt: '2025-09-28T00:00:00.000Z',
        summary: {
          total: 1,
          matched: 1,
          unmatched: 0,
          missingMcn: 0,
          latestUpdated: '2025-09-28T00:00:00.000Z',
        },
        alerts: [storedAlert],
        uniqueAlerts: 1,
      })

      const updated = await dataManager.updateAlertStatus(
        'alert-update',
        { status: 'resolved', resolutionNotes: 'Handled in outreach' },
        { cases: [mockCase] },
      )

      expect(updated?.status).toBe('resolved')
      expect(updated?.resolutionNotes).toBe('Handled in outreach')
      expect(mockAutosaveService.readTextFile).not.toHaveBeenCalled()
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({
          version: 3,
          alerts: expect.arrayContaining([
            expect.objectContaining({
              id: 'alert-update',
              status: 'resolved',
              resolutionNotes: 'Handled in outreach',
            })
          ]),
        }),
      )
      expect(mockAutosaveService.notifyDataChange).toHaveBeenCalled()
    })

    it('rebuilds alerts.json when stored file contains invalid JSON', async () => {
      const mockCase = createMockCaseDisplay({
        id: 'case-invalid-json',
        mcn: '3333',
        caseRecord: createMockCaseRecord({ id: 'record-invalid-json', mcn: '3333' })
      })

      const csvAlert = buildAlert({
        id: 'alert-invalid-json',
        reportId: 'alert-invalid-json',
        mcNumber: '3333',
        matchedCaseId: 'case-invalid-json',
        matchStatus: 'matched',
      })

      const stackedIndex = alertsData.createAlertsIndexFromAlerts([csvAlert])
      vi.spyOn(alertsData, 'parseStackedAlerts').mockReturnValueOnce(stackedIndex)

      mockAutosaveService.readNamedFile.mockRejectedValueOnce(new SyntaxError('Unexpected token'))
      mockAutosaveService.readTextFile.mockResolvedValueOnce('csv-content')

      const index = await dataManager.getAlertsIndex({ cases: [mockCase] })
      await Promise.resolve()

      expect(index.summary.total).toBe(1)
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({
          version: 3,
          alerts: expect.arrayContaining([
            expect.objectContaining({ id: expect.any(String), status: 'new' })
          ]),
        }),
      )
      expect(reportFileStorageError).not.toHaveBeenCalled()
    })

    it('updates alert status even if alerts.json had invalid JSON previously', async () => {
      const mockCase = createMockCaseDisplay({
        id: 'case-update-invalid-json',
        mcn: '4444',
        caseRecord: createMockCaseRecord({ id: 'record-update-invalid-json', mcn: '4444' })
      })

      const csvAlert = buildAlert({
        id: 'alert-update-invalid-json',
        reportId: 'alert-update-invalid-json',
        mcNumber: '4444',
        matchedCaseId: 'case-update-invalid-json',
        matchStatus: 'matched',
      })

      const stackedIndex = alertsData.createAlertsIndexFromAlerts([csvAlert])
      vi.spyOn(alertsData, 'parseStackedAlerts').mockReturnValueOnce(stackedIndex)

      mockAutosaveService.readNamedFile.mockRejectedValueOnce(new SyntaxError('Unexpected token'))
      mockAutosaveService.readTextFile.mockResolvedValueOnce('csv-content')

      const result = await dataManager.updateAlertStatus(
        'alert-update-invalid-json',
        { status: 'in-progress' },
        { cases: [mockCase] },
      )

      expect(result?.status).toBe('in-progress')
      expect(mockAutosaveService.writeNamedFile).toHaveBeenCalledWith(
        'alerts.json',
        expect.objectContaining({ version: 3 }),
      )
      expect(reportFileStorageError).not.toHaveBeenCalled()
    })

    it('returns empty alerts index when no files found', async () => {
      const index = await dataManager.getAlertsIndex({ cases: [] })

      expect(index.summary.total).toBe(0)
      expect(index.alerts).toEqual([])
    })
  })

  describe('writeFileData validation', () => {
    it('should handle writeFile returning false', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())
      mockAutosaveService.writeFile.mockResolvedValue(false)

      const mockCase = createMockCaseDisplay()
      
      await expect(dataManager.createCompleteCase({
        person: mockCase.person,
        caseRecord: mockCase.caseRecord
      })).rejects.toThrow('File write operation failed')
    })

    it('should handle non-Error objects in write errors', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())
      mockAutosaveService.writeFile.mockRejectedValue('String error')

      const mockCase = createMockCaseDisplay()
      
      await expect(dataManager.createCompleteCase({
        person: mockCase.person,
        caseRecord: mockCase.caseRecord
      })).rejects.toThrow('Failed to save case data: Unknown error')
    })
  })

  describe('case management', () => {
    it('should create a complete case', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const result = await dataManager.createCompleteCase({
        person: mockCase.person,
        caseRecord: mockCase.caseRecord
      })

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.person.firstName).toBe(mockCase.person.firstName)
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should get all cases', async () => {
      const mockCases = [createMockCaseDisplay()]
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: mockCases,
        total_cases: mockCases.length,
      }))

      const cases = await dataManager.getAllCases()

      expect(cases).toEqual(mockCases)
    })

    it('should get a case by ID', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [mockCase],
        total_cases: 1,
      }))

      const result = await dataManager.getCaseById(mockCase.id)

      expect(result).toEqual(mockCase)
    })

    it('should return null for non-existent case', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const result = await dataManager.getCaseById('non-existent')

      expect(result).toBeNull()
    })

    it('should update a complete case', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [mockCase],
        total_cases: 1,
      }))

      const updates = { 
        person: { ...mockCase.person, firstName: 'Updated' },
        caseRecord: mockCase.caseRecord
      }
      const result = await dataManager.updateCompleteCase(mockCase.id, updates)

      expect(result).toBeDefined()
      expect(result.person.firstName).toBe('Updated')
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should delete a case', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [mockCase],
        total_cases: 1,
      }))

      await dataManager.deleteCase(mockCase.id)

      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should update case status without affecting other cases', async () => {
      const pendingCase = createMockCaseDisplay({ id: 'case-1', status: 'Pending' })
      pendingCase.caseRecord.status = 'Pending'

      const untouchedCase = createMockCaseDisplay({ id: 'case-2', status: 'Approved' })
      untouchedCase.caseRecord.status = 'Approved'

      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [pendingCase, untouchedCase],
        total_cases: 2,
      }))

      let capturedPayload: any
      mockAutosaveService.writeFile.mockImplementation(async (data: any) => {
        capturedPayload = data
        return true
      })

      const updatedCase = await dataManager.updateCaseStatus('case-1', 'Approved')

      expect(updatedCase.status).toBe('Approved')
      expect(updatedCase.caseRecord.status).toBe('Approved')
      expect(capturedPayload.cases.find((c: any) => c.id === 'case-1').status).toBe('Approved')
      expect(capturedPayload.cases.find((c: any) => c.id === 'case-1').caseRecord.status).toBe('Approved')
      expect(capturedPayload.cases.find((c: any) => c.id === 'case-2').status).toBe('Approved')
      expect(capturedPayload.cases.find((c: any) => c.id === 'case-2').caseRecord.status).toBe('Approved')
    })
  })

  describe('financial items', () => {
    let mockCase: any

    beforeEach(() => {
      mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [mockCase],
        total_cases: 1,
      }))
    })

    it('should add a financial item', async () => {
      const newItem = createMockFinancialItem('income')

      const result = await dataManager.addItem(mockCase.id, 'income', newItem)

      expect(result).toBeDefined()
      expect(result.caseRecord.financials.income.length).toBeGreaterThan(0)
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should update a financial item', async () => {
      const existingItem = mockCase.caseRecord.financials.income[0]
      const updates = { 
        description: 'Updated description', 
        amount: 2000,
        verificationStatus: 'Verified' as const
      }

      const result = await dataManager.updateItem(
        mockCase.id, 
        'income', 
        existingItem.id, 
        updates
      )

      expect(result).toBeDefined()
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should delete a financial item', async () => {
      const existingItem = mockCase.caseRecord.financials.income[0]

      const result = await dataManager.deleteItem(
        mockCase.id, 
        'income', 
        existingItem.id
      )

      expect(result).toBeDefined()
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })
  })

  describe('notes', () => {
    let mockCase: any

    beforeEach(() => {
      mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [mockCase],
        total_cases: 1,
      }))
    })

    it('should add a note', async () => {
      const newNote = createMockNote()

      const result = await dataManager.addNote(mockCase.id, {
        content: newNote.content,
        category: newNote.category
      })

      expect(result).toBeDefined()
      expect(result.caseRecord.notes.length).toBeGreaterThan(0)
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should update a note', async () => {
      const existingNote = mockCase.caseRecord.notes[0]
      const updates = { 
        content: 'Updated note content',
        category: 'General' as const
      }

      const result = await dataManager.updateNote(mockCase.id, existingNote.id, updates)

      expect(result).toBeDefined()
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })

    it('should delete a note', async () => {
      const existingNote = mockCase.caseRecord.notes[0]

      const result = await dataManager.deleteNote(mockCase.id, existingNote.id)

      expect(result).toBeDefined()
      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
    })
  })

  describe('timestamp control', () => {
    it('updates updatedAt only for cases that were modified', async () => {
      const originalTimestamp = '2024-01-01T00:00:00.000Z'
      const untouchedTimestamp = '2023-12-15T12:00:00.000Z'
      const targetCase = createMockCaseDisplay({ id: 'case-target', updatedAt: originalTimestamp })
      const untouchedCase = createMockCaseDisplay({ id: 'case-untouched', updatedAt: untouchedTimestamp })

      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [targetCase, untouchedCase],
        total_cases: 2,
      }))

      let capturedPayload: any
      mockAutosaveService.writeFile.mockImplementation(async (data: any) => {
        capturedPayload = data
        return true
      })

      const result = await dataManager.updateCompleteCase('case-target', {
        person: { ...targetCase.person, firstName: 'Casey' },
        caseRecord: targetCase.caseRecord,
      })

      expect(result.updatedAt).not.toBe(originalTimestamp)
      expect(capturedPayload.cases.find((c: any) => c.id === 'case-target').updatedAt).toBe(result.updatedAt)
      expect(capturedPayload.cases.find((c: any) => c.id === 'case-untouched').updatedAt).toBe(untouchedTimestamp)
    })

    it('preserves updatedAt during passive writes', async () => {
      const originalTimestamp = '2024-02-02T08:00:00.000Z'
      const existingCase = createMockCaseDisplay({ id: 'case-passive', updatedAt: originalTimestamp })

      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [existingCase],
        total_cases: 1,
      }))

      let capturedPayload: any
      mockAutosaveService.writeFile.mockImplementation(async (data: any) => {
        capturedPayload = data
        return true
      })

      const updatedConfig = mergeCategoryConfig({ caseTypes: ['Passive Update'] })
      await dataManager.updateCategoryConfig(updatedConfig)

      expect(capturedPayload.cases[0].updatedAt).toBe(originalTimestamp)
    })
  })

  describe('category configuration', () => {
    it('merges missing category values when retrieving config', async () => {
      const partialConfig = {
        caseTypes: ['Custom Type'],
        caseStatuses: [],
        livingArrangements: [],
        noteCategories: [],
      } as any

      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        categoryConfig: partialConfig,
      }))

      const result = await dataManager.getCategoryConfig()
      const defaults = mergeCategoryConfig()

      expect(result.caseTypes).toEqual(['Custom Type'])
      expect(result.caseStatuses).toEqual(defaults.caseStatuses)
      expect(result.livingArrangements).toEqual(defaults.livingArrangements)
      expect(result.noteCategories).toEqual(defaults.noteCategories)
    })

    it('sanitizes and persists category configuration updates', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      let capturedPayload: any
      mockAutosaveService.writeFile.mockImplementationOnce(async (data: any) => {
        capturedPayload = data
        return true
      })

      const unsanitizedConfig = {
        caseTypes: [' Medicaid ', 'medicaid', ''],
        caseStatuses: ['Pending', 'pending', ' '],
        livingArrangements: ['Apartment', 'Apartment  ', '  '],
        noteCategories: ['General', 'general', ''],
      } as any

      const result = await dataManager.updateCategoryConfig(unsanitizedConfig)
      const expected = mergeCategoryConfig({
        caseTypes: ['Medicaid'],
        caseStatuses: ['Pending'],
        livingArrangements: ['Apartment'],
        noteCategories: ['General'],
      })

      expect(result).toEqual(expected)
      expect(capturedPayload.categoryConfig).toEqual(expected)
    })

    it('rejects empty category value updates', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      await expect(dataManager.updateCategoryValues('caseTypes', [])).rejects.toThrow(
        'At least one option is required',
      )
    })

    it('updates individual category values with sanitization', async () => {
      const existingConfig = mergeCategoryConfig({ caseTypes: ['Existing'] })

      mockAutosaveService.readFile
        .mockResolvedValueOnce(createFileData({ categoryConfig: existingConfig }))
        .mockResolvedValueOnce(createFileData({ categoryConfig: existingConfig }))

      let capturedPayload: any
      mockAutosaveService.writeFile.mockImplementationOnce(async (data: any) => {
        capturedPayload = data
        return true
      })

      const result = await dataManager.updateCategoryValues('caseTypes', [' SNAP ', 'snap'])

      expect(result.caseTypes).toEqual(['SNAP'])
      expect(capturedPayload.categoryConfig.caseTypes).toEqual(['SNAP'])
      expect(result.caseStatuses).toEqual(existingConfig.caseStatuses)
    })

    it('resets category configuration to defaults', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        categoryConfig: mergeCategoryConfig({ caseTypes: ['Custom'] }),
      }))

      let capturedPayload: any
      mockAutosaveService.writeFile.mockImplementationOnce(async (data: any) => {
        capturedPayload = data
        return true
      })

      const defaults = mergeCategoryConfig()
      const result = await dataManager.resetCategoryConfig()

      expect(result).toEqual(defaults)
      expect(capturedPayload.categoryConfig).toEqual(defaults)
    })
  })

  describe('error handling', () => {
    it('should handle save errors gracefully', async () => {
      mockAutosaveService.writeFile.mockRejectedValue(new Error('Save failed'))
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const mockCase = createMockCaseDisplay()
      
      await expect(dataManager.createCompleteCase({
        person: mockCase.person,
        caseRecord: mockCase.caseRecord
      })).rejects.toThrow('Save failed')
    })

    it('should handle case not found for update', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const mockCase = createMockCaseDisplay()
      
      await expect(dataManager.updateCompleteCase('non-existent', {
        person: mockCase.person,
        caseRecord: mockCase.caseRecord
      })).rejects.toThrow('Case not found')
    })

    it('should handle case not found for delete', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      await expect(dataManager.deleteCase('non-existent')).rejects.toThrow('Case not found')
    })

    it('should handle case not found for financial item operations', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const newItem = createMockFinancialItem('income')

      await expect(dataManager.addItem('non-existent', 'income', newItem)).rejects.toThrow('Case not found')
      await expect(dataManager.updateItem('non-existent', 'income', 'item-id', newItem)).rejects.toThrow('Case not found')
      await expect(dataManager.deleteItem('non-existent', 'income', 'item-id')).rejects.toThrow('Case not found')
    })

    it('should handle item not found for update and delete', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: [mockCase],
        total_cases: 1,
      }))

      const newItem = createMockFinancialItem('income')

      await expect(dataManager.updateItem(mockCase.id, 'income', 'non-existent-item', newItem)).rejects.toThrow('Item not found')
      await expect(dataManager.deleteItem(mockCase.id, 'income', 'non-existent-item')).rejects.toThrow('Item not found')
    })

    it('should handle case not found for note operations', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const newNote = createMockNote()

      await expect(dataManager.addNote('non-existent', { content: newNote.content, category: newNote.category })).rejects.toThrow('Case not found')
      await expect(dataManager.updateNote('non-existent', 'note-id', { content: newNote.content, category: newNote.category })).rejects.toThrow('Case not found')
      await expect(dataManager.deleteNote('non-existent', 'note-id')).rejects.toThrow('Case not found')
    })

    it('should handle note not found for update and delete', async () => {
      const mockCase = createMockCaseDisplay()
      mockAutosaveService.readFile.mockResolvedValue({
        cases: [mockCase],
        exported_at: new Date().toISOString(),
        total_cases: 1
      })

      const newNote = createMockNote()

      await expect(dataManager.updateNote(mockCase.id, 'non-existent-note', { content: newNote.content, category: newNote.category })).rejects.toThrow('Note not found')
      await expect(dataManager.deleteNote(mockCase.id, 'non-existent-note')).rejects.toThrow('Note not found')
    })

    it('should handle read errors for all operations', async () => {
      mockAutosaveService.readFile.mockRejectedValue(new Error('Read failed'))

      await expect(dataManager.getCaseById('any-id')).rejects.toThrow('Failed to read case data')
      await expect(dataManager.getCasesCount()).rejects.toThrow('Failed to read case data')
      await expect(async () => await dataManager.clearAllData()).not.toThrow() // clearAllData doesn't read first
    })
  })

  describe('bulk operations and utilities', () => {
    it('should get cases count', async () => {
      const mockCases = [createMockCaseDisplay(), createMockCaseDisplay()]
      mockAutosaveService.readFile.mockResolvedValue(createFileData({
        cases: mockCases,
        total_cases: mockCases.length,
      }))

      const count = await dataManager.getCasesCount()

      expect(count).toBe(2)
    })

    it('should import multiple cases', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      const casesToImport = [createMockCaseDisplay(), createMockCaseDisplay()]

      await dataManager.importCases(casesToImport)

      expect(mockAutosaveService.writeFile).toHaveBeenCalled()
      const writeCall = mockAutosaveService.writeFile.mock.calls[0][0]
      expect(writeCall.cases).toHaveLength(2)
    })

    it('should clear all data', async () => {
      await dataManager.clearAllData()

      expect(mockAutosaveService.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: [],
          exported_at: expect.any(String),
          total_cases: 0,
          categoryConfig: expect.any(Object),
        })
      )
    })
    it('should check if connected', () => {
      const isConnected = dataManager.isConnected()

      expect(isConnected).toBe(true)
      expect(mockAutosaveService.getStatus).toHaveBeenCalled()
    })

    it('should get status', () => {
      const status = dataManager.getStatus()

      expect(status).toEqual({
        permissionStatus: 'granted',
        isConnected: true,
        hasData: true
      })
      expect(mockAutosaveService.getStatus).toHaveBeenCalled()
    })

    it('should handle import cases with read failure', async () => {
      mockAutosaveService.readFile.mockRejectedValue(new Error('Read failed'))

      const casesToImport = [createMockCaseDisplay()]

      await expect(dataManager.importCases(casesToImport)).rejects.toThrow('Failed to read case data')
    })
  })

  describe('data integrity and validation', () => {
    it('should preserve existing data when updating case', async () => {
      const mockCase = createMockCaseDisplay()
      // Start with empty financials, then add specific items we want to preserve
      mockCase.caseRecord.financials = {
        resources: [],
        income: [createMockFinancialItem('income')],
        expenses: []
      }
      mockCase.caseRecord.notes = [createMockNote()]
      
      mockAutosaveService.readFile.mockResolvedValue({
        cases: [mockCase],
        exported_at: new Date().toISOString(),
        total_cases: 1
      })

      const updates = { 
        person: { ...mockCase.person, firstName: 'Updated' },
        caseRecord: { ...mockCase.caseRecord, description: 'Updated description' }
      }
      
      const result = await dataManager.updateCompleteCase(mockCase.id, updates)

      expect(result.person.firstName).toBe('Updated')
      expect(result.caseRecord.description).toBe('Updated description')
      expect(result.caseRecord.financials.income).toHaveLength(1) // Preserved
      expect(result.caseRecord.notes).toHaveLength(1) // Preserved
    })

    it('should handle cases with missing notes array', async () => {
      const mockCase = createMockCaseDisplay()
      // Remove notes array to test edge case
      delete (mockCase.caseRecord as any).notes
      
      mockAutosaveService.readFile.mockResolvedValue({
        cases: [mockCase],
        exported_at: new Date().toISOString(),
        total_cases: 1
      })

      const newNote = createMockNote()
      const result = await dataManager.addNote(mockCase.id, {
        content: newNote.content,
        category: newNote.category
      })

      expect(result.caseRecord.notes).toHaveLength(1)
    })

    it('should set default values for missing case data', async () => {
      mockAutosaveService.readFile.mockResolvedValue(createFileData())

      // Create minimal case data
      const minimalCaseData = {
        person: {
          firstName: 'John',
          lastName: 'Doe'
        },
        caseRecord: {
          mcn: 'MCN123',
          status: 'Pending' as const
        }
      }

      const result = await dataManager.createCompleteCase(minimalCaseData as any)

      expect(result.person.email).toBe('')
      expect(result.person.phone).toBe('')
      expect(result.person.address).toEqual({
        street: '',
        city: '',
        state: '',
        zip: ''
      })
      expect(result.caseRecord.spouseId).toBe('')
      expect(result.caseRecord.description).toBe('')
    })

    it('should validate and ensure unique IDs for imported cases', async () => {
      mockAutosaveService.readFile.mockResolvedValue({
        cases: [],
        exported_at: new Date().toISOString(),
        total_cases: 0
      })

      const casesToImport = [
        { ...createMockCaseDisplay(), id: '' }, // Empty ID should get new one
        createMockCaseDisplay() // Existing ID should be preserved
      ]

      await dataManager.importCases(casesToImport)

      const writeCall = mockAutosaveService.writeFile.mock.calls[0][0]
      expect(writeCall.cases[0].id).toBeTruthy() // Should have been assigned
      expect(writeCall.cases[1].id).toBe(casesToImport[1].id) // Should be preserved
    })
  })
})