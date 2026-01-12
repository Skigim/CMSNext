import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaseBulkOperationsService } from '@/utils/services/CaseBulkOperationsService';
import type { FileStorageService, NormalizedFileData, StoredCase } from '@/utils/services/FileStorageService';
import type { Person, CaseRecord, CaseStatus } from '@/types/case';
import type { CategoryConfig } from '@/types/categoryConfig';

// Mock the logger using vi.hoisted to ensure proper initialization order
const mockLoggerFns = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  lifecycle: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => mockLoggerFns,
}));

describe('CaseBulkOperationsService', () => {
  let service: CaseBulkOperationsService;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;

  const createMockFileStorage = () => {
    let storedData: NormalizedFileData | null = null;

    return {
      readFileData: vi.fn().mockImplementation(() => Promise.resolve(storedData)),
      writeNormalizedData: vi.fn().mockImplementation((data: NormalizedFileData) => {
        storedData = data;
        return Promise.resolve();
      }),
      touchCaseTimestamps: vi.fn().mockImplementation((cases: StoredCase[], _caseIds: string[]) => {
        return cases.map(c => ({ ...c, updatedAt: new Date().toISOString() }));
      }),
      setData: (data: NormalizedFileData | null) => {
        storedData = data;
      },
    };
  };

  const createMockPerson = (id: string): Person => ({
    id,
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-0100',
    dateOfBirth: '1980-01-01',
    ssn: '123-45-6789',
    organizationId: null,
    livingArrangement: 'Apartment/House',
    address: { street: '123 Main St', city: 'Anytown', state: 'ST', zip: '12345' },
    mailingAddress: { street: '123 Main St', city: 'Anytown', state: 'ST', zip: '12345', sameAsPhysical: true },
    authorizedRepIds: [],
    familyMembers: [],
    status: 'active',
    createdAt: '2024-01-15T10:00:00Z',
    dateAdded: '2024-01-15T10:00:00Z',
  });

  const createMockCaseRecord = (id: string, mcn: string): Omit<CaseRecord, 'financials' | 'notes'> => ({
    id,
    mcn,
    applicationDate: '2024-01-15',
    caseType: 'Medicaid',
    personId: 'person-1',
    spouseId: '',
    status: 'Pending',
    description: '',
    priority: false,
    livingArrangement: 'Apartment/House',
    withWaiver: false,
    admissionDate: '',
    organizationId: '',
    authorizedReps: [],
    retroRequested: '',
    createdDate: '2024-01-15T10:00:00Z',
    updatedDate: '2024-01-15T10:00:00Z',
  });

  const createMockCase = (id: string, status: CaseStatus = 'Pending'): StoredCase => ({
    id,
    name: `Case ${id}`,
    mcn: `MCN-${id}`,
    status,
    priority: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    person: createMockPerson('person-1'),
    caseRecord: {
      ...createMockCaseRecord(id, `MCN-${id}`),
      status, // Ensure caseRecord status matches
    },
  });

  const defaultCategoryConfig: CategoryConfig = {
    caseTypes: ['Medicaid'],
    caseStatuses: [
      { name: 'Pending', colorSlot: 'amber' },
      { name: 'Active', colorSlot: 'green' },
      { name: 'Closed', colorSlot: 'slate' },
    ],
    alertTypes: [],
    livingArrangements: ['Apartment/House'],
    noteCategories: ['General'],
    verificationStatuses: ['Needs VR', 'Verified'],
    summaryTemplate: {
      sectionOrder: ['notes', 'caseInfo', 'personInfo', 'relationships', 'resources', 'income', 'expenses', 'avsTracking'],
      defaultSections: {
        notes: true,
        caseInfo: true,
        personInfo: true,
        relationships: true,
        resources: true,
        income: true,
        expenses: true,
        avsTracking: true,
      },
      sectionTemplates: {},
    },
  };

  const createEmptyNormalizedData = (): NormalizedFileData => ({
    version: '2.0',
    cases: [],
    financials: [],
    notes: [],
    alerts: [],
    exported_at: '2024-01-15T10:00:00Z',
    total_cases: 0,
    categoryConfig: defaultCategoryConfig,
    activityLog: [],
  });

  beforeEach(() => {
    mockFileStorage = createMockFileStorage();
    service = new CaseBulkOperationsService({
      fileStorage: mockFileStorage as unknown as FileStorageService,
    });
  });

  // =============================================================================
  // BULK DELETE OPERATIONS
  // =============================================================================

  describe('deleteCases', () => {
    it('should return early with empty result when given empty array', async () => {
      const result = await service.deleteCases([]);
      expect(result).toEqual({ deleted: 0, notFound: [] });
      expect(mockFileStorage.readFileData).not.toHaveBeenCalled();
    });

    it('should throw error when no data exists', async () => {
      mockFileStorage.setData(null);
      await expect(service.deleteCases(['case-1'])).rejects.toThrow('Failed to read current data');
    });

    it('should delete single case and associated data', async () => {
      const testCase = createMockCase('case-1');
      const data = createEmptyNormalizedData();
      data.cases = [testCase];
      data.financials = [{ id: 'fin-1', caseId: 'case-1', category: 'resources', name: 'Item', description: 'Test item', amount: 100, verificationStatus: 'Needs VR', createdAt: '', updatedAt: '' }];
      data.notes = [{ id: 'note-1', caseId: 'case-1', category: 'General', content: 'Test note', createdAt: '', updatedAt: '' }];
      data.alerts = [{ id: 'alert-1', caseId: 'case-1', alertCode: 'TST', alertType: 'General', alertDate: '', mcNumber: 'MCN-1', createdAt: '', updatedAt: '' }];
      mockFileStorage.setData(data);

      const result = await service.deleteCases(['case-1']);

      expect(result).toEqual({ deleted: 1, notFound: [] });
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: [],
          financials: [],
          notes: [],
          alerts: [],
        })
      );
    });

    it('should delete multiple cases at once', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [
        createMockCase('case-1'),
        createMockCase('case-2'),
        createMockCase('case-3'),
      ];
      mockFileStorage.setData(data);

      const result = await service.deleteCases(['case-1', 'case-3']);

      expect(result).toEqual({ deleted: 2, notFound: [] });
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: expect.arrayContaining([
            expect.objectContaining({ id: 'case-2' }),
          ]),
        })
      );
    });

    it('should track not found case IDs', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1')];
      mockFileStorage.setData(data);

      const result = await service.deleteCases(['case-1', 'case-nonexistent']);

      expect(result).toEqual({ deleted: 1, notFound: ['case-nonexistent'] });
    });

    it('should handle all IDs not found', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1')];
      mockFileStorage.setData(data);

      const result = await service.deleteCases(['case-x', 'case-y']);

      expect(result).toEqual({ deleted: 0, notFound: ['case-x', 'case-y'] });
    });
  });

  // =============================================================================
  // BULK UPDATE STATUS OPERATIONS
  // =============================================================================

  describe('updateCasesStatus', () => {
    it('should return early with empty result when given empty array', async () => {
      const result = await service.updateCasesStatus([], 'Active');
      expect(result).toEqual({ updated: [], notFound: [] });
      expect(mockFileStorage.readFileData).not.toHaveBeenCalled();
    });

    it('should throw error when no data exists', async () => {
      mockFileStorage.setData(null);
      await expect(service.updateCasesStatus(['case-1'], 'Active')).rejects.toThrow('Failed to read current data');
    });

    it('should update status for single case', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1', 'Pending')];
      mockFileStorage.setData(data);

      const result = await service.updateCasesStatus(['case-1'], 'Active');

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].status).toBe('Active');
      expect(result.notFound).toEqual([]);
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          activityLog: expect.arrayContaining([
            expect.objectContaining({
              type: 'status-change',
              payload: { fromStatus: 'Pending', toStatus: 'Active' },
            }),
          ]),
        })
      );
    });

    it('should update status for multiple cases', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [
        createMockCase('case-1', 'Pending'),
        createMockCase('case-2', 'Pending'),
        createMockCase('case-3', 'Active'),
      ];
      mockFileStorage.setData(data);

      const result = await service.updateCasesStatus(['case-1', 'case-2'], 'Active');

      expect(result.updated).toHaveLength(2);
      expect(result.notFound).toEqual([]);
    });

    it('should skip cases with same status', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1', 'Active')];
      mockFileStorage.setData(data);

      const result = await service.updateCasesStatus(['case-1'], 'Active');

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].status).toBe('Active');
      // Activity log should not contain entry for unchanged case
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          activityLog: [],
        })
      );
    });

    it('should track not found case IDs', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1', 'Pending')];
      mockFileStorage.setData(data);

      const result = await service.updateCasesStatus(['case-1', 'case-nonexistent'], 'Active');

      expect(result.updated).toHaveLength(1);
      expect(result.notFound).toEqual(['case-nonexistent']);
    });
  });

  // =============================================================================
  // BULK UPDATE PRIORITY OPERATIONS
  // =============================================================================

  describe('updateCasesPriority', () => {
    it('should return early with empty result when given empty array', async () => {
      const result = await service.updateCasesPriority([], true);
      expect(result).toEqual({ updated: [], notFound: [] });
      expect(mockFileStorage.readFileData).not.toHaveBeenCalled();
    });

    it('should throw error when no data exists', async () => {
      mockFileStorage.setData(null);
      await expect(service.updateCasesPriority(['case-1'], true)).rejects.toThrow('Failed to read current data');
    });

    it('should update priority for single case', async () => {
      const data = createEmptyNormalizedData();
      const testCase = createMockCase('case-1');
      testCase.priority = false;
      data.cases = [testCase];
      mockFileStorage.setData(data);

      const result = await service.updateCasesPriority(['case-1'], true);

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].priority).toBe(true);
      expect(result.notFound).toEqual([]);
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          activityLog: expect.arrayContaining([
            expect.objectContaining({
              type: 'priority-change',
              payload: { fromPriority: false, toPriority: true },
            }),
          ]),
        })
      );
    });

    it('should update priority for multiple cases', async () => {
      const data = createEmptyNormalizedData();
      const case1 = createMockCase('case-1');
      const case2 = createMockCase('case-2');
      case1.priority = false;
      case2.priority = false;
      data.cases = [case1, case2];
      mockFileStorage.setData(data);

      const result = await service.updateCasesPriority(['case-1', 'case-2'], true);

      expect(result.updated).toHaveLength(2);
      expect(result.updated.every(c => c.priority === true)).toBe(true);
    });

    it('should skip cases with same priority', async () => {
      const data = createEmptyNormalizedData();
      const testCase = createMockCase('case-1');
      testCase.priority = true;
      data.cases = [testCase];
      mockFileStorage.setData(data);

      const result = await service.updateCasesPriority(['case-1'], true);

      expect(result.updated).toHaveLength(1);
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          activityLog: [],
        })
      );
    });

    it('should track not found case IDs', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1')];
      mockFileStorage.setData(data);

      const result = await service.updateCasesPriority(['case-1', 'case-nonexistent'], true);

      expect(result.updated).toHaveLength(1);
      expect(result.notFound).toEqual(['case-nonexistent']);
    });
  });

  // =============================================================================
  // BULK IMPORT OPERATIONS
  // =============================================================================

  describe('importCases', () => {
    it('should throw error when no data exists', async () => {
      mockFileStorage.setData(null);
      await expect(service.importCases([createMockCase('case-1')])).rejects.toThrow('Failed to read current data');
    });

    it('should import single case', async () => {
      const data = createEmptyNormalizedData();
      mockFileStorage.setData(data);

      await service.importCases([createMockCase('case-1')]);

      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: expect.arrayContaining([
            expect.objectContaining({ id: 'case-1' }),
          ]),
        })
      );
    });

    it('should import multiple cases', async () => {
      const data = createEmptyNormalizedData();
      mockFileStorage.setData(data);

      await service.importCases([
        createMockCase('case-1'),
        createMockCase('case-2'),
      ]);

      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: expect.arrayContaining([
            expect.objectContaining({ id: 'case-1' }),
            expect.objectContaining({ id: 'case-2' }),
          ]),
        })
      );
    });

    it('should skip cases with duplicate IDs', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1')];
      mockFileStorage.setData(data);

      mockLoggerFns.warn.mockClear();

      await service.importCases([
        createMockCase('case-1'),
        createMockCase('case-2'),
      ]);

      expect(mockLoggerFns.warn).toHaveBeenCalledWith(
        'Skipping import: case already exists',
        expect.objectContaining({ caseId: 'case-1' })
      );
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: expect.arrayContaining([
            expect.objectContaining({ id: 'case-1' }),
            expect.objectContaining({ id: 'case-2' }),
          ]),
        })
      );
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: expect.not.arrayContaining([
            expect.objectContaining({ id: 'case-1', name: expect.stringMatching(/imported/) }),
          ]),
        })
      );
    });

    it('should not write when all cases are duplicates', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1')];
      mockFileStorage.setData(data);

      mockLoggerFns.info.mockClear();

      await service.importCases([createMockCase('case-1')]);

      expect(mockLoggerFns.info).toHaveBeenCalledWith(
        'No new cases to import (all IDs already exist)'
      );
      expect(mockFileStorage.writeNormalizedData).not.toHaveBeenCalled();
    });

    it('should preserve existing cases when importing new ones', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('existing-case')];
      mockFileStorage.setData(data);

      await service.importCases([createMockCase('new-case')]);

      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          cases: expect.arrayContaining([
            expect.objectContaining({ id: 'existing-case' }),
            expect.objectContaining({ id: 'new-case' }),
          ]),
        })
      );
    });
  });

  // =============================================================================
  // CLEAR ALL DATA OPERATIONS
  // =============================================================================

  describe('clearAllData', () => {
    it('should clear all data and preserve category config', async () => {
      const data = createEmptyNormalizedData();
      data.cases = [createMockCase('case-1')];
      data.financials = [{ id: 'fin-1', caseId: 'case-1', category: 'resources', name: 'Item', description: 'Test item', amount: 100, verificationStatus: 'Needs VR', createdAt: '', updatedAt: '' }];
      data.notes = [{ id: 'note-1', caseId: 'case-1', category: 'General', content: 'Note', createdAt: '', updatedAt: '' }];
      data.alerts = [{ id: 'alert-1', caseId: 'case-1', alertCode: 'TST', alertType: 'General', alertDate: '', mcNumber: 'MCN-1', createdAt: '', updatedAt: '' }];
      mockFileStorage.setData(data);

      await service.clearAllData(defaultCategoryConfig);

      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.0',
          cases: [],
          financials: [],
          notes: [],
          alerts: [],
          activityLog: [],
          categoryConfig: defaultCategoryConfig,
        })
      );
    });

    it('should write with different category config', async () => {
      const customConfig: CategoryConfig = {
        caseTypes: ['Custom Type'],
        caseStatuses: [{ name: 'Custom', colorSlot: 'purple' }],
        alertTypes: [{ name: 'CustomAlert', colorSlot: 'red' }],
        livingArrangements: ['Custom Arrangement'],
        noteCategories: ['Custom Note'],
        verificationStatuses: ['Custom VR'],
        summaryTemplate: {
          sectionOrder: ['notes', 'caseInfo', 'personInfo', 'relationships', 'resources', 'income', 'expenses', 'avsTracking'],
          defaultSections: {
            notes: true,
            caseInfo: true,
            personInfo: true,
            relationships: true,
            resources: true,
            income: true,
            expenses: true,
            avsTracking: true,
          },
          sectionTemplates: {},
        },
      };

      await service.clearAllData(customConfig);

      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryConfig: customConfig,
        })
      );
    });
  });
});
