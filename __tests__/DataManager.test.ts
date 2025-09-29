import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { DataManager } from '@/utils/DataManager'
import { createMockCaseDisplay, createMockFinancialItem, createMockNote } from '@/src/test/testUtils'
import { mergeCategoryConfig } from '@/types/categoryConfig'
import AutosaveFileService from '@/utils/AutosaveFileService'

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
      writeFile: vi.fn().mockResolvedValue(true),
      saveData: vi.fn().mockResolvedValue(true),
      startBatchMode: vi.fn(),
      endBatchMode: vi.fn(),
      isSupported: true,
      getFullData: vi.fn().mockReturnValue(createFileData()),
      getStatus: vi.fn().mockReturnValue({
        permissionStatus: 'granted',
        isConnected: true,
        hasData: true
      })
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