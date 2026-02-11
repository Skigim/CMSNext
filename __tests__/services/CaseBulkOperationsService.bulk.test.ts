import { describe, it, expect, vi } from 'vitest';
import { CaseBulkOperationsService } from '../../utils/services/CaseBulkOperationsService';
import type { FileStorageService, NormalizedFileData, StoredCase } from '../../utils/services/FileStorageService';
import type { AlertWithMatch } from '@/domain/alerts';
import type { CaseActivityEntry } from '../../types/activityLog';
import type { CategoryConfig } from '../../types/categoryConfig';
import type { Person, CaseRecord } from '../../types/case';

// Mock FileStorageService
const createMockFileStorage = (data: NormalizedFileData | null = null) => ({
  readFileData: vi.fn().mockResolvedValue(data),
  writeNormalizedData: vi.fn().mockResolvedValue(undefined),
  touchCaseTimestamps: vi.fn((cases) => cases),
});

// Helper to create mock NormalizedFileData with required fields
const createMockFileData = (
  overrides: Partial<NormalizedFileData> = {}
): NormalizedFileData => ({
  version: '2.0',
  exported_at: new Date().toISOString(),
  total_cases: overrides.cases?.length ?? 0,
  cases: [],
  financials: [],
  notes: [],
  alerts: [],
  categoryConfig: defaultCategoryConfig,
  activityLog: [],
  ...overrides,
});

// Default category config for tests
const defaultCategoryConfig: CategoryConfig = {
  caseTypes: ['Medicaid'],
  applicationTypes: ['New Application'],
  caseStatuses: [
    { name: 'Active', colorSlot: 'green' },
    { name: 'Pending', colorSlot: 'amber' },
  ],
  alertTypes: [],
  livingArrangements: ['Apartment/House'],
  noteCategories: ['General', 'Important'],
  verificationStatuses: ['Needs VR', 'Verified'],
};

const createMockPerson = (id: string): Person => ({
  id,
  firstName: 'Test',
  lastName: 'User',
  name: 'Test User',
  email: 'test@example.com',
  phone: '555-0100',
  dateOfBirth: '1990-01-01',
  ssn: '',
  organizationId: null,
  livingArrangement: 'Apartment/House',
  address: { street: '123 Main St', city: 'Anytown', state: 'ST', zip: '12345' },
  mailingAddress: { street: '123 Main St', city: 'Anytown', state: 'ST', zip: '12345', sameAsPhysical: true },
  authorizedRepIds: [],
  familyMembers: [],
  status: 'active',
  createdAt: '2024-01-01T00:00:00.000Z',
  dateAdded: '2024-01-01T00:00:00.000Z',
});

const createMockCaseRecord = (id: string, mcn: string): Omit<CaseRecord, 'financials' | 'notes'> => ({
  id,
  mcn,
  applicationDate: '2024-01-01',
  caseType: 'Medicaid',
  personId: 'person-1',
  spouseId: '',
  status: 'Active',
  description: '',
  priority: false,
  livingArrangement: 'Apartment/House',
  withWaiver: false,
  admissionDate: '',
  organizationId: '',
  authorizedReps: [],
  retroRequested: '',
  createdDate: '2024-01-01T00:00:00.000Z',
  updatedDate: '2024-01-01T00:00:00.000Z',
});

// Helper to create test cases
const createTestCase = (id: string, name = 'Test Case', mcn = 'MCN-001'): StoredCase => ({
  id,
  name,
  mcn,
  status: 'Active',
  priority: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  person: createMockPerson('person-1'),
  caseRecord: createMockCaseRecord(id, mcn),
});

// Helper to create test alerts
const createTestAlert = (id: string, caseId: string, description: string): AlertWithMatch => ({
  id,
  alertCode: 'TEST-001',
  alertType: 'Test',
  alertDate: '2024-01-01',
  description,
  status: 'new',
  matchStatus: 'matched',
  matchedCaseId: caseId,
  matchedCaseName: 'Test Case',
  matchedCaseStatus: 'Active',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

describe('CaseBulkOperationsService', () => {
  describe('resolveAlertsForCases', () => {
    it('should resolve all matching alerts for selected cases', async () => {
      const case1 = createTestCase('case-1');
      const case2 = createTestCase('case-2');
      
      const alert1 = createTestAlert('alert-1', 'case-1', 'Court Notice');
      const alert2 = createTestAlert('alert-2', 'case-1', 'Court Notice');
      const alert3 = createTestAlert('alert-3', 'case-2', 'Court Notice');
      
      const mockData = createMockFileData({
        cases: [case1, case2],
        alerts: [alert1, alert2, alert3],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.resolveAlertsForCases(
        ['case-1', 'case-2'],
        [alert1, alert2, alert3],
        'Court Notice'
      );
      
      expect(result.resolvedCount).toBe(3);
      expect(result.caseCount).toBe(2);
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
      
      // Verify the alerts were updated with resolved status
      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
      const resolvedAlerts = writtenData.alerts.filter(
        (a: { status: string }) => a.status === 'resolved'
      );
      expect(resolvedAlerts).toHaveLength(3);
    });

    it('should only resolve alerts matching the description filter', async () => {
      const case1 = createTestCase('case-1');
      
      const alert1 = createTestAlert('alert-1', 'case-1', 'Court Notice');
      const alert2 = createTestAlert('alert-2', 'case-1', 'Income Verification');
      
      const mockData = createMockFileData({
        cases: [case1],
        alerts: [alert1, alert2],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.resolveAlertsForCases(
        ['case-1'],
        [alert1, alert2],
        'Court Notice'
      );
      
      expect(result.resolvedCount).toBe(1);
      expect(result.caseCount).toBe(1);
    });

    it('should return zero counts when no alerts match', async () => {
      const case1 = createTestCase('case-1');
      
      const alert1 = createTestAlert('alert-1', 'case-1', 'Income Verification');
      
      const mockData = createMockFileData({
        cases: [case1],
        alerts: [alert1],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.resolveAlertsForCases(
        ['case-1'],
        [alert1],
        'Court Notice' // Different from alert description
      );
      
      expect(result.resolvedCount).toBe(0);
      expect(result.caseCount).toBe(0);
      expect(mockFileStorage.writeNormalizedData).not.toHaveBeenCalled();
    });

    it('should handle empty case IDs array', async () => {
      const mockFileStorage = createMockFileStorage(null);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.resolveAlertsForCases([], [], 'Court Notice');
      
      expect(result.resolvedCount).toBe(0);
      expect(result.caseCount).toBe(0);
      expect(mockFileStorage.readFileData).not.toHaveBeenCalled();
    });
  });

  describe('addNoteToCases', () => {
    it('should add notes to all specified cases', async () => {
      const case1 = createTestCase('case-1', 'John Doe');
      const case2 = createTestCase('case-2', 'Jane Smith');
      
      const mockData = createMockFileData({
        cases: [case1, case2],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.addNoteToCases(
        ['case-1', 'case-2'],
        { content: 'Bulk test note', category: 'Important' }
      );
      
      expect(result.addedCount).toBe(2);
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
      
      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.notes).toHaveLength(2);
      expect(writtenData.notes[0].content).toBe('Bulk test note');
      expect(writtenData.notes[0].category).toBe('Important');
      expect(writtenData.notes[1].content).toBe('Bulk test note');
    });

    it('should skip non-existent case IDs', async () => {
      const case1 = createTestCase('case-1');
      
      const mockData = createMockFileData({
        cases: [case1],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.addNoteToCases(
        ['case-1', 'non-existent-case'],
        { content: 'Test note', category: 'General' }
      );
      
      expect(result.addedCount).toBe(1); // Only case-1 should receive a note
      
      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.notes).toHaveLength(1);
      expect(writtenData.notes[0].caseId).toBe('case-1');
    });

    it('should create activity log entries for each note', async () => {
      const case1 = createTestCase('case-1', 'John Doe');
      const case2 = createTestCase('case-2', 'Jane Smith');
      
      const mockData = createMockFileData({
        cases: [case1, case2],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      await service.addNoteToCases(
        ['case-1', 'case-2'],
        { content: 'Activity test', category: 'General' }
      );
      
      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.activityLog).toHaveLength(2);
      
      const noteAddedEntries = writtenData.activityLog.filter(
        (e: CaseActivityEntry) => e.type === 'note-added'
      );
      expect(noteAddedEntries).toHaveLength(2);
    });

    it('should use default category when not provided', async () => {
      const case1 = createTestCase('case-1');
      
      const mockData = createMockFileData({
        cases: [case1],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      await service.addNoteToCases(
        ['case-1'],
        { content: 'Test note', category: '' }
      );
      
      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
      expect(writtenData.notes[0].category).toBe('General');
    });

    it('should handle empty case IDs array', async () => {
      const mockFileStorage = createMockFileStorage(null);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      const result = await service.addNoteToCases(
        [],
        { content: 'Test', category: 'General' }
      );
      
      expect(result.addedCount).toBe(0);
      expect(mockFileStorage.readFileData).not.toHaveBeenCalled();
    });

    it('should sanitize PII in activity log preview', async () => {
      const case1 = createTestCase('case-1');
      
      const mockData = createMockFileData({
        cases: [case1],
      });
      
      const mockFileStorage = createMockFileStorage(mockData);
      const service = new CaseBulkOperationsService({
        fileStorage: mockFileStorage as unknown as FileStorageService,
      });
      
      await service.addNoteToCases(
        ['case-1'],
        { content: 'Contact at test@email.com or call 1234567890. SSN: 123-45-6789', category: 'General' }
      );
      
      const writtenData = mockFileStorage.writeNormalizedData.mock.calls[0][0];
      const activityEntry = writtenData.activityLog[0];
      
      // Note content should NOT be sanitized
      expect(writtenData.notes[0].content).toContain('test@email.com');
      
      // Activity log preview SHOULD be sanitized
      expect(activityEntry.payload.preview).not.toContain('test@email.com');
      expect(activityEntry.payload.preview).toContain('***@***');
      expect(activityEntry.payload.preview).toContain('***-**-****');
    });
  });
});
