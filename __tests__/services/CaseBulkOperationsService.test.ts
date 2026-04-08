import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaseBulkOperationsService } from '@/utils/services/CaseBulkOperationsService';
import type { FileStorageService, NormalizedFileData, StoredCase } from '@/utils/services/FileStorageService';
import type { CaseStatus } from '@/types/case';
import type { CategoryConfig } from '@/types/categoryConfig';
import { createMockApplication, createMockStoredCase } from '@/src/test/testUtils';

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
      touchCaseTimestamps: vi.fn().mockImplementation((cases: StoredCase[], caseIds?: Iterable<string>, timestampOverride?: string) => {
        if (!caseIds) {
          return cases;
        }

        const touchedIds = new Set(caseIds);
        if (touchedIds.size === 0) {
          return cases;
        }

        const timestamp = timestampOverride ?? new Date().toISOString();
        return cases.map(c => (touchedIds.has(c.id) ? { ...c, updatedAt: timestamp } : c));
      }),
      setData: (data: NormalizedFileData | null) => {
        storedData = data;
      },
    };
  };

  const createMockCase = (id: string, status: CaseStatus = 'Pending'): StoredCase => {
    const base = createMockStoredCase();
    return {
      ...base,
      id,
      name: `Case ${id}`,
      mcn: `MCN-${id}`,
      status,
      caseRecord: { ...base.caseRecord, id, mcn: `MCN-${id}`, status },
    };
  };

  const defaultCategoryConfig: CategoryConfig = {
    caseTypes: ['Medicaid'],
    applicationTypes: ['New Application'],
    caseStatuses: [
      { name: 'Pending', colorSlot: 'amber' },
      { name: 'Active', colorSlot: 'green' },
      { name: 'Closed', colorSlot: 'slate' },
    ],
    alertTypes: [],
    livingArrangements: ['Apartment/House'],
    noteCategories: ['General'],
    verificationStatuses: ['Needs VR', 'Verified'],
  };

  const createEmptyNormalizedData = (): NormalizedFileData => ({
    version: '2.1',
    people: [],
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

    it('should sync canonical application status history with the bulk transaction timestamp', async () => {
      // Arrange
      const transactionTimestamp = '2026-04-08T10:00:00.000Z';
      const skewedTimestamp = '2026-04-08T10:00:01.000Z';
      const primaryPersonId = 'person-1';
      const data = createEmptyNormalizedData();
      data.categoryConfig = {
        ...defaultCategoryConfig,
        caseStatuses: [
          { name: 'Approved', colorSlot: 'green', countsAsCompleted: true },
          { name: 'Denied', colorSlot: 'red', countsAsCompleted: true },
          { name: 'Pending', colorSlot: 'amber', countsAsCompleted: false },
        ],
      };
      data.people = [
        {
          ...createMockStoredCase({ person: undefined as never }).person,
          id: primaryPersonId,
          familyMembers: [],
          familyMemberIds: [],
          legacyFamilyMemberNames: [],
          normalizedRelationships: [],
        },
      ];
      data.cases = [
        createMockCase('case-1', 'Approved' as CaseStatus),
      ].map((caseItem) => ({
        ...caseItem,
        person: { ...caseItem.person, id: primaryPersonId },
        linkedPeople: [{ ref: { personId: primaryPersonId, role: 'applicant', isPrimary: true }, person: { ...caseItem.person, id: primaryPersonId } }],
        people: [{ personId: primaryPersonId, role: 'applicant', isPrimary: true }],
        caseRecord: {
          ...caseItem.caseRecord,
          personId: primaryPersonId,
        },
      }));
      data.applications = [
        createMockApplication({
          id: 'application-1',
          caseId: 'case-1',
          applicantPersonId: primaryPersonId,
          applicationDate: '2026-01-01',
          applicationType: 'Renewal',
          status: 'Approved',
          hasWaiver: true,
          retroRequestedAt: '2025-12-01',
          retroMonths: ['2025-12'],
          verification: {
            isAppValidated: true,
            isAgedDisabledVerified: true,
            isCitizenshipVerified: true,
            isResidencyVerified: true,
            avsConsentDate: '2026-01-02',
            voterFormStatus: 'requested',
            isIntakeCompleted: false,
          },
          statusHistory: [
            {
              id: 'history-1',
              status: 'Approved',
              effectiveDate: '2026-01-01',
              changedAt: '2026-01-01T00:00:00.000Z',
              source: 'migration',
            },
          ],
          updatedAt: '2026-01-15T00:00:00.000Z',
        }),
      ];
      mockFileStorage.setData(data);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(transactionTimestamp));
      mockFileStorage.touchCaseTimestamps.mockImplementation(
        (cases: StoredCase[], caseIds?: Iterable<string>, timestampOverride?: string) => {
          if (!caseIds) {
            return cases;
          }

          const touchedIds = new Set(caseIds);
          vi.setSystemTime(new Date(skewedTimestamp));
          const timestamp = timestampOverride ?? new Date().toISOString();
          return cases.map((caseItem) =>
            touchedIds.has(caseItem.id) ? { ...caseItem, updatedAt: timestamp } : caseItem,
          );
        },
      );

      try {
        // Act
        const result = await service.updateCasesStatus(['case-1'], 'Pending');

        // Assert
        expect(result.updated).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }

      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0] as NormalizedFileData;
      expect(mockFileStorage.touchCaseTimestamps).toHaveBeenCalledWith(
        expect.any(Array),
        ['case-1'],
        transactionTimestamp,
      );
      expect(writtenData.cases[0].updatedAt).toBe(transactionTimestamp);
      expect(writtenData.activityLog[0].timestamp).toBe(transactionTimestamp);
      expect(writtenData.applications?.[0]).toMatchObject({
        id: 'application-1',
        status: 'Pending',
        applicationDate: '2026-01-01',
        applicationType: 'Renewal',
        hasWaiver: true,
        retroRequestedAt: '2025-12-01',
        retroMonths: ['2025-12'],
        verification: {
          isAppValidated: true,
          isAgedDisabledVerified: true,
          isCitizenshipVerified: true,
          isResidencyVerified: true,
          avsConsentDate: '2026-01-02',
          voterFormStatus: 'requested',
          isIntakeCompleted: false,
        },
        updatedAt: transactionTimestamp,
      });
      expect(writtenData.applications?.[0].statusHistory).toEqual([
        {
          id: 'history-1',
          status: 'Approved',
          effectiveDate: '2026-01-01',
          changedAt: '2026-01-01T00:00:00.000Z',
          source: 'migration',
        },
        expect.objectContaining({
          status: 'Pending',
          effectiveDate: '2026-04-08',
          changedAt: transactionTimestamp,
          source: 'user',
        }),
      ]);
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
          version: '2.1',
          people: [],
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
        applicationTypes: ['Custom App Type'],
        caseStatuses: [{ name: 'Custom', colorSlot: 'purple' }],
        alertTypes: [{ name: 'CustomAlert', colorSlot: 'red' }],
        livingArrangements: ['Custom Arrangement'],
        noteCategories: ['Custom Note'],
        verificationStatuses: ['Custom VR'],
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
