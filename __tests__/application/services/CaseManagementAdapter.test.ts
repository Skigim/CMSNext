import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaseManagementAdapter } from '@/application/services/CaseManagementAdapter';
import type { CaseDisplay, NewPersonData, NewCaseRecordData, NewNoteData } from '@/types/case';
import type DataManager from '@/utils/DataManager';

// Hoist mocks to top level
const mocks = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
  fileStorageFlags: {
    dataBaseline: false,
    sessionHadData: false,
    inConnectionFlow: false,
  },
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => mocks.logger,
}));

vi.mock('@/utils/fileStorageFlags', () => ({
  getFileStorageFlags: () => mocks.fileStorageFlags,
  updateFileStorageFlags: (flags: Record<string, boolean>) => {
    Object.assign(mocks.fileStorageFlags, flags);
  },
}));

// Helper to create mock CaseDisplay
const createMockCase = (overrides: Partial<CaseDisplay> = {}): CaseDisplay => ({
  id: 'case-123',
  name: 'Test Case',
  mcn: 'MCN-001',
  status: 'Active',
  priority: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  person: {
    id: 'person-123',
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    dateOfBirth: '1990-01-01',
    ssn: '123-45-6789',
    organizationId: null,
    livingArrangement: 'Apartment',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
    },
    mailingAddress: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '12345',
      sameAsPhysical: true,
    },
    authorizedRepIds: [],
    familyMembers: [],
    status: 'Active',
    createdAt: '2025-01-01T00:00:00Z',
    dateAdded: '2025-01-01T00:00:00Z',
  },
  caseRecord: {
    id: 'record-123',
    mcn: 'MCN-001',
    applicationDate: '2025-01-01',
    caseType: 'General',
    personId: 'person-123',
    spouseId: '',
    status: 'Active',
    description: '',
    priority: false,
    livingArrangement: 'Apartment',
    withWaiver: false,
    admissionDate: '',
    organizationId: '',
    authorizedReps: [],
    retroRequested: '',
    financials: { resources: [], income: [], expenses: [] },
    notes: [],
    createdDate: '2025-01-01T00:00:00Z',
    updatedDate: '2025-01-01T00:00:00Z',
  },
  ...overrides,
});

describe('CaseManagementAdapter', () => {
  let mockDataManager: Partial<DataManager>;
  let adapter: CaseManagementAdapter;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mocks.fileStorageFlags.dataBaseline = false;
    mocks.fileStorageFlags.sessionHadData = false;
    mocks.fileStorageFlags.inConnectionFlow = false;

    // Create mock DataManager
    mockDataManager = {
      getAllCases: vi.fn(),
      createCompleteCase: vi.fn(),
      updateCompleteCase: vi.fn(),
      deleteCase: vi.fn(),
      addNote: vi.fn(),
      updateNote: vi.fn(),
      updateCaseStatus: vi.fn(),
    };
  });

  describe('constructor and isAvailable', () => {
    it('should create adapter with DataManager', () => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
      expect(adapter.isAvailable()).toBe(true);
    });

    it('should create adapter without DataManager', () => {
      adapter = new CaseManagementAdapter(null);
      expect(adapter.isAvailable()).toBe(false);
    });
  });

  describe('loadCases', () => {
    beforeEach(() => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
    });

    it('should load cases successfully', async () => {
      const mockCases = [createMockCase(), createMockCase({ id: 'case-456' })];
      (mockDataManager.getAllCases as any).mockResolvedValue(mockCases);

      const result = await adapter.loadCases();

      expect(result).toEqual(mockCases);
      expect(mockDataManager.getAllCases).toHaveBeenCalled();
      expect(mocks.logger.info).toHaveBeenCalledWith('Cases loaded', { caseCount: 2 });
      expect(mocks.fileStorageFlags.dataBaseline).toBe(true);
      expect(mocks.fileStorageFlags.sessionHadData).toBe(true);
    });

    it('should handle empty cases', async () => {
      (mockDataManager.getAllCases as any).mockResolvedValue([]);
      mocks.fileStorageFlags.inConnectionFlow = false;

      const result = await adapter.loadCases();

      expect(result).toEqual([]);
      expect(mocks.toast.success).toHaveBeenCalledWith(
        'Connected successfully - ready to start fresh',
        { id: 'connected-empty', duration: 3000 }
      );
      expect(mocks.logger.debug).toHaveBeenCalledWith('Cases loaded (empty)');
    });

    it('should not show toast during connection flow', async () => {
      (mockDataManager.getAllCases as any).mockResolvedValue([]);
      mocks.fileStorageFlags.inConnectionFlow = true;

      await adapter.loadCases();

      expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    it('should throw error when DataManager unavailable', async () => {
      adapter = new CaseManagementAdapter(null);

      await expect(adapter.loadCases()).rejects.toThrow(
        'Data storage is not available. Please connect to a folder first.'
      );
      expect(mocks.toast.error).toHaveBeenCalled();
    });

    it('should handle loading errors with context', async () => {
      const error = new Error('Network failure');
      (mockDataManager.getAllCases as any).mockRejectedValue(error);

      await expect(adapter.loadCases()).rejects.toThrow(/Failed to load cases/);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to load cases',
        expect.objectContaining({
          error: 'Network failure',
          errorType: 'Error',
          operation: 'loadCases',
        })
      );
      expect(mocks.toast.error).toHaveBeenCalled();
    });
  });

  describe('saveCase', () => {
    beforeEach(() => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
    });

    const mockCaseData = {
      person: {
        firstName: 'Jane',
        lastName: 'Smith',
      } as NewPersonData,
      caseRecord: {
        mcn: 'MCN-002',
        status: 'Pending' as const,
      } as NewCaseRecordData,
    };

    it('should create new case successfully', async () => {
      const newCase = createMockCase({ id: 'new-case' });
      (mockDataManager.createCompleteCase as any).mockResolvedValue(newCase);

      const result = await adapter.saveCase(mockCaseData);

      expect(result).toEqual(newCase);
      expect(mockDataManager.createCompleteCase).toHaveBeenCalledWith(mockCaseData);
      expect(mocks.toast.loading).toHaveBeenCalledWith('Creating case...');
      expect(mocks.toast.success).toHaveBeenCalledWith(
        'Case for Jane Smith created successfully',
        { id: 'toast-id' }
      );
    });

    it('should update existing case successfully', async () => {
      const existingCase = createMockCase();
      const updatedCase = createMockCase({ name: 'Updated Case' });
      (mockDataManager.updateCompleteCase as any).mockResolvedValue(updatedCase);

      const result = await adapter.saveCase(mockCaseData, existingCase);

      expect(result).toEqual(updatedCase);
      expect(mockDataManager.updateCompleteCase).toHaveBeenCalledWith(
        existingCase.id,
        mockCaseData
      );
      expect(mocks.toast.loading).toHaveBeenCalledWith('Updating case...');
      expect(mocks.toast.success).toHaveBeenCalledWith(
        'Case for Jane Smith updated successfully',
        { id: 'toast-id' }
      );
    });

    it('should throw error when DataManager unavailable', async () => {
      adapter = new CaseManagementAdapter(null);

      await expect(adapter.saveCase(mockCaseData)).rejects.toThrow(
        'Data storage is not available'
      );
    });

    it('should handle create errors with context', async () => {
      const error = new Error('Validation failed');
      (mockDataManager.createCompleteCase as any).mockRejectedValue(error);

      await expect(adapter.saveCase(mockCaseData)).rejects.toThrow(error);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to save case',
        expect.objectContaining({
          error: 'Validation failed',
          operation: 'createCase',
        })
      );
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create case'),
        { id: 'toast-id' }
      );
    });

    it('should handle update errors with context', async () => {
      const existingCase = createMockCase();
      const error = new Error('Update failed');
      (mockDataManager.updateCompleteCase as any).mockRejectedValue(error);

      await expect(adapter.saveCase(mockCaseData, existingCase)).rejects.toThrow(error);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to save case',
        expect.objectContaining({
          error: 'Update failed',
          operation: 'updateCase',
          caseId: existingCase.id,
        })
      );
    });
  });

  describe('deleteCase', () => {
    beforeEach(() => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
    });

    it('should delete case successfully with person name', async () => {
      (mockDataManager.deleteCase as any).mockResolvedValue(undefined);

      await adapter.deleteCase('case-123', 'John Doe');

      expect(mockDataManager.deleteCase).toHaveBeenCalledWith('case-123');
      expect(mocks.toast.success).toHaveBeenCalledWith('John Doe deleted successfully');
    });

    it('should delete case successfully without person name', async () => {
      (mockDataManager.deleteCase as any).mockResolvedValue(undefined);

      await adapter.deleteCase('case-123');

      expect(mocks.toast.success).toHaveBeenCalledWith('Case deleted successfully');
    });

    it('should throw error when DataManager unavailable', async () => {
      adapter = new CaseManagementAdapter(null);

      await expect(adapter.deleteCase('case-123')).rejects.toThrow(
        'Data storage is not available'
      );
    });

    it('should handle delete errors with context', async () => {
      const error = new Error('Permission denied');
      (mockDataManager.deleteCase as any).mockRejectedValue(error);

      await expect(adapter.deleteCase('case-123')).rejects.toThrow(error);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to delete case',
        expect.objectContaining({
          error: 'Permission denied',
          operation: 'deleteCase',
          caseId: 'case-123',
        })
      );
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete case')
      );
    });
  });

  describe('saveNote', () => {
    beforeEach(() => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
    });

    const mockNoteData: NewNoteData = {
      category: 'General',
      content: 'Test note',
    };

    it('should add new note successfully', async () => {
      const updatedCase = createMockCase();
      (mockDataManager.addNote as any).mockResolvedValue(updatedCase);

      const result = await adapter.saveNote(mockNoteData, 'case-123');

      expect(result).toEqual(updatedCase);
      expect(mockDataManager.addNote).toHaveBeenCalledWith('case-123', mockNoteData);
      expect(mocks.toast.success).toHaveBeenCalledWith('Note added successfully');
    });

    it('should update existing note successfully', async () => {
      const updatedCase = createMockCase();
      (mockDataManager.updateNote as any).mockResolvedValue(updatedCase);

      const result = await adapter.saveNote(mockNoteData, 'case-123', { id: 'note-456' });

      expect(result).toEqual(updatedCase);
      expect(mockDataManager.updateNote).toHaveBeenCalledWith(
        'case-123',
        'note-456',
        mockNoteData
      );
      expect(mocks.toast.success).toHaveBeenCalledWith('Note updated successfully');
    });

    it('should throw error when DataManager unavailable', async () => {
      adapter = new CaseManagementAdapter(null);

      await expect(adapter.saveNote(mockNoteData, 'case-123')).rejects.toThrow(
        'Data storage is not available'
      );
    });

    it('should handle note errors with context', async () => {
      const error = new Error('Note validation failed');
      (mockDataManager.addNote as any).mockRejectedValue(error);

      await expect(adapter.saveNote(mockNoteData, 'case-123')).rejects.toThrow(error);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to save note',
        expect.objectContaining({
          error: 'Note validation failed',
          operation: 'addNote',
          caseId: 'case-123',
        })
      );
    });
  });

  describe('updateCaseStatus', () => {
    beforeEach(() => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
    });

    it('should update status successfully', async () => {
      const updatedCase = createMockCase({ status: 'Closed' });
      (mockDataManager.updateCaseStatus as any).mockResolvedValue(updatedCase);

      const result = await adapter.updateCaseStatus('case-123', 'Closed');

      expect(result).toEqual(updatedCase);
      expect(mockDataManager.updateCaseStatus).toHaveBeenCalledWith('case-123', 'Closed');
      expect(mocks.toast.success).toHaveBeenCalledWith('Status updated to Closed', {
        id: 'toast-id',
        duration: 2000,
      });
    });

    it('should handle AbortError specially', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';
      (mockDataManager.updateCaseStatus as any).mockRejectedValue(abortError);

      await expect(adapter.updateCaseStatus('case-123', 'Closed')).rejects.toThrow(
        abortError
      );
      expect(mocks.toast.dismiss).toHaveBeenCalledWith('toast-id');
      expect(mocks.toast.error).not.toHaveBeenCalled();
      expect(mocks.logger.error).not.toHaveBeenCalled();
    });

    it('should throw error when DataManager unavailable', async () => {
      adapter = new CaseManagementAdapter(null);

      await expect(adapter.updateCaseStatus('case-123', 'Closed')).rejects.toThrow(
        'Data storage is not available'
      );
    });

    it('should handle status update errors with context', async () => {
      const error = new Error('Invalid status transition');
      (mockDataManager.updateCaseStatus as any).mockRejectedValue(error);

      await expect(adapter.updateCaseStatus('case-123', 'Closed')).rejects.toThrow(error);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        'Failed to update case status',
        expect.objectContaining({
          error: 'Invalid status transition',
          operation: 'updateCaseStatus',
          caseId: 'case-123',
          targetStatus: 'Closed',
        })
      );
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update case status to Closed'),
        { id: 'toast-id' }
      );
    });
  });

  describe('importCases', () => {
    beforeEach(() => {
      adapter = new CaseManagementAdapter(mockDataManager as DataManager);
    });

    it('should import cases successfully', async () => {
      const casesToImport = [createMockCase(), createMockCase({ id: 'case-456' })];

      await adapter.importCases(casesToImport);

      expect(mocks.fileStorageFlags.dataBaseline).toBe(true);
      expect(mocks.fileStorageFlags.sessionHadData).toBe(true);
      expect(mocks.toast.success).toHaveBeenCalledWith('Imported 2 cases successfully');
    });

    it('should handle empty import', async () => {
      await adapter.importCases([]);

      expect(mocks.toast.success).toHaveBeenCalledWith('Imported 0 cases successfully');
    });
  });
});
