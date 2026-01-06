import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FinancialsService } from '@/utils/services/FinancialsService';
import type { FileStorageService, NormalizedFileData, StoredFinancialItem, StoredCase } from '@/utils/services/FileStorageService';
import type { CaseCategory, Person, CaseRecord } from '@/types/case';
import type { CategoryConfig } from '@/types/categoryConfig';

describe('FinancialsService', () => {
  let service: FinancialsService;
  let mockFileStorage: ReturnType<typeof createMockFileStorage>;

  const createMockFileStorage = () => {
    let storedData: NormalizedFileData | null = null;

    return {
      readFileData: vi.fn().mockImplementation(() => Promise.resolve(storedData)),
      writeNormalizedData: vi.fn().mockImplementation((data: NormalizedFileData) => {
        storedData = data;
        return Promise.resolve();
      }),
      getFinancialsForCase: vi.fn().mockImplementation((data: NormalizedFileData, caseId: string) => {
        return data.financials.filter(f => f.caseId === caseId);
      }),
      getFinancialsForCaseGrouped: vi.fn().mockImplementation((data: NormalizedFileData, caseId: string) => {
        const items = data.financials.filter(f => f.caseId === caseId);
        return {
          resources: items.filter(i => i.category === 'resources'),
          income: items.filter(i => i.category === 'income'),
          expenses: items.filter(i => i.category === 'expenses'),
        };
      }),
      getCaseById: vi.fn().mockImplementation((data: NormalizedFileData, caseId: string) => {
        return data.cases.find(c => c.id === caseId);
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

  const createMockCase = (id: string): StoredCase => ({
    id,
    name: `Case ${id}`,
    mcn: `MCN-${id}`,
    status: 'Pending',
    priority: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    person: createMockPerson('person-1'),
    caseRecord: createMockCaseRecord(id, `MCN-${id}`),
  });

  const createMockFinancialItem = (
    id: string, 
    caseId: string, 
    category: CaseCategory,
    amount: number = 100
  ): StoredFinancialItem => ({
    id,
    caseId,
    category,
    name: `Item ${id}`,
    description: `Description for ${id}`,
    amount,
    verificationStatus: 'Needs VR',
    dateAdded: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  });

  const createMockCategoryConfig = (): CategoryConfig => ({
    caseTypes: ['Medicaid'],
    caseStatuses: [{ name: 'Pending', colorSlot: 'blue' }],
    alertTypes: [],
    livingArrangements: ['Apartment/House'],
    noteCategories: ['General'],
    verificationStatuses: ['Needs VR', 'Verified'],
    vrScripts: [],
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
    },
  });

  const createBaseMockData = (): NormalizedFileData => ({
    version: '2.0',
    cases: [createMockCase('case-1')],
    financials: [],
    notes: [],
    alerts: [],
    exported_at: '2024-01-15T10:00:00Z',
    total_cases: 1,
    categoryConfig: createMockCategoryConfig(),
    activityLog: [],
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-12-10T12:00:00Z'));
    
    mockFileStorage = createMockFileStorage();
    service = new FinancialsService({
      fileStorage: mockFileStorage as unknown as FileStorageService,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addItem', () => {
    it('should add a new financial item to a case', async () => {
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      const result = await service.addItem('case-1', 'income', {
        name: 'New Income',
        description: 'Monthly salary',
        amount: 500,
        verificationStatus: 'Needs VR',
      });

      expect(result).toMatchObject({
        name: 'New Income',
        description: 'Monthly salary',
        amount: 500,
        verificationStatus: 'Needs VR',
        caseId: 'case-1',
        category: 'income',
      });
      expect(result.id).toEqual(expect.any(String));
      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledTimes(1);
    });

    it('should throw error if case not found', async () => {
      // ARRANGE
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      // ACT & ASSERT
      await expect(
        service.addItem('nonexistent', 'income', { 
          name: 'Test', 
          description: 'Test item',
          amount: 100, 
          verificationStatus: 'Needs VR' 
        })
      ).rejects.toThrow('Case not found');
    });

    it('should throw error if no data', async () => {
      // ARRANGE
      mockFileStorage.setData(null);

      // ACT & ASSERT
      await expect(
        service.addItem('case-1', 'income', { 
          name: 'Test', 
          description: 'Test item',
          amount: 100,
          verificationStatus: 'Needs VR'
        })
      ).rejects.toThrow('Failed to read current data');
    });

    it('should auto-create history entry when adding item with amount', async () => {
      // ARRANGE
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      // ACT
      const result = await service.addItem('case-1', 'income', {
        name: 'New Income',
        description: 'Monthly salary',
        amount: 500,
        verificationStatus: 'Needs VR',
      });

      // ASSERT
      expect(result.amountHistory).toBeDefined();
      expect(result.amountHistory).toHaveLength(1);
      expect(result.amountHistory![0].amount).toBe(500);
      expect(result.amountHistory![0].startDate).toBe('2024-12-01'); // First of current month
      expect(result.amountHistory![0].endDate).toBeFalsy(); // null or undefined
    });

    it('should create history entry when adding item with zero amount', async () => {
      // ARRANGE
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      // ACT
      const result = await service.addItem('case-1', 'income', {
        name: 'New Income',
        description: 'TBD',
        amount: 0,
        verificationStatus: 'Needs VR',
      });

      // ASSERT - zero is a valid amount that should create history
      expect(result.amountHistory).toBeDefined();
      expect(result.amountHistory![0].amount).toBe(0);
    });

    it('should preserve explicit amountHistory when provided', async () => {
      // ARRANGE
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);
      const customHistory = [{
        id: 'custom-id',
        amount: 300,
        startDate: '2024-06-01',
        createdAt: '2024-06-01T10:00:00Z',
      }];

      // ACT
      const result = await service.addItem('case-1', 'income', {
        name: 'New Income',
        description: 'Monthly salary',
        amount: 500,
        verificationStatus: 'Needs VR',
        amountHistory: customHistory,
      });

      // ASSERT
      expect(result.amountHistory).toEqual(customHistory);
    });
  });

  describe('updateItem', () => {
    it('should update an existing financial item', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [createMockFinancialItem('item-1', 'case-1', 'income', 100)];
      mockFileStorage.setData(mockData);

      const result = await service.updateItem('case-1', 'income', 'item-1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.amount).toBe(100); // Unchanged
    });

    it('should auto-create history entry when amount changes', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [createMockFinancialItem('item-1', 'case-1', 'income', 100)];
      mockFileStorage.setData(mockData);

      const result = await service.updateItem('case-1', 'income', 'item-1', {
        amount: 200,
      });

      expect(result.amount).toBe(200);
      expect(result.amountHistory).toBeDefined();
      expect(result.amountHistory).toHaveLength(1);
      expect(result.amountHistory![0].amount).toBe(200);
      expect(result.amountHistory![0].startDate).toContain('2024-12-01'); // First of current month
    });

    it('should close previous ongoing entries when amount changes', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 100,
          startDate: '2024-11-01',
          // No endDate - ongoing entry
          createdAt: '2024-11-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.updateItem('case-1', 'income', 'item-1', {
        amount: 200,
      });

      expect(result.amountHistory).toHaveLength(2);
      // Previous entry should be closed
      expect(result.amountHistory![0].endDate).toContain('2024-11-30');
      // New entry should be open (no endDate)
      expect(result.amountHistory![1].amount).toBe(200);
      expect(result.amountHistory![1].endDate).toBeFalsy();
    });

    it('should not auto-create history when explicit amountHistory provided', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [createMockFinancialItem('item-1', 'case-1', 'income', 100)];
      mockFileStorage.setData(mockData);

      const explicitHistory = [
        {
          id: 'custom-entry',
          amount: 200,
          startDate: '2024-01-01',
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      const result = await service.updateItem('case-1', 'income', 'item-1', {
        amount: 200,
        amountHistory: explicitHistory,
      });

      expect(result.amountHistory).toHaveLength(1);
      expect(result.amountHistory![0].id).toBe('custom-entry');
    });

    it('should throw error if item not found', async () => {
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      await expect(
        service.updateItem('case-1', 'income', 'nonexistent', { name: 'Test' })
      ).rejects.toThrow('Item not found');
    });
  });

  describe('deleteItem', () => {
    it('should delete a financial item', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [createMockFinancialItem('item-1', 'case-1', 'income', 100)];
      mockFileStorage.setData(mockData);

      await service.deleteItem('case-1', 'income', 'item-1');

      expect(mockFileStorage.writeNormalizedData).toHaveBeenCalledWith(
        expect.objectContaining({
          financials: [],
        })
      );
    });

    it('should throw error if item not found', async () => {
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      await expect(
        service.deleteItem('case-1', 'income', 'nonexistent')
      ).rejects.toThrow('Item not found');
    });
  });

  describe('addAmountHistoryEntry', () => {
    it('should add a new history entry', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [createMockFinancialItem('item-1', 'case-1', 'income', 100)];
      mockFileStorage.setData(mockData);

      const result = await service.addAmountHistoryEntry('case-1', 'income', 'item-1', {
        amount: 150,
        startDate: '2024-12-01',
        verificationSource: 'Pay stub',
      });

      expect(result.amountHistory).toHaveLength(1);
      expect(result.amountHistory![0].amount).toBe(150);
      expect(result.amountHistory![0].startDate).toBe('2024-12-01');
      expect(result.amountHistory![0].verificationSource).toBe('Pay stub');
      expect(result.amountHistory![0].id).toBeDefined();
      expect(result.amountHistory![0].createdAt).toBeDefined();
    });

    it('should close previous ongoing entries', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 100,
          startDate: '2024-10-01',
          createdAt: '2024-10-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.addAmountHistoryEntry('case-1', 'income', 'item-1', {
        amount: 200,
        startDate: '2024-12-01',
      });

      expect(result.amountHistory).toHaveLength(2);
      expect(result.amountHistory![0].endDate).toContain('2024-11-30');
      expect(result.amountHistory![1].endDate).toBeUndefined();
    });

    it('should update the item amount based on current month', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [createMockFinancialItem('item-1', 'case-1', 'income', 100)];
      mockFileStorage.setData(mockData);

      const result = await service.addAmountHistoryEntry('case-1', 'income', 'item-1', {
        amount: 999,
        startDate: '2024-12-01',
      });

      // Amount should be updated to reflect the current month's entry
      expect(result.amount).toBe(999);
    });

    it('should throw error if item not found', async () => {
      const mockData = createBaseMockData();
      mockFileStorage.setData(mockData);

      await expect(
        service.addAmountHistoryEntry('case-1', 'income', 'nonexistent', {
          amount: 100,
          startDate: '2024-12-01',
        })
      ).rejects.toThrow('Item not found');
    });
  });

  describe('updateAmountHistoryEntry', () => {
    it('should update an existing history entry', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 100,
          startDate: '2024-12-01',
          createdAt: '2024-12-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.updateAmountHistoryEntry(
        'case-1', 'income', 'item-1', 'entry-1',
        { amount: 250, verificationSource: 'Updated source' }
      );

      expect(result.amountHistory![0].amount).toBe(250);
      expect(result.amountHistory![0].verificationSource).toBe('Updated source');
      expect(result.amountHistory![0].id).toBe('entry-1'); // Preserved
    });

    it('should recalculate item amount after update', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 100,
          startDate: '2024-12-01',
          createdAt: '2024-12-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.updateAmountHistoryEntry(
        'case-1', 'income', 'item-1', 'entry-1',
        { amount: 777 }
      );

      expect(result.amount).toBe(777);
    });

    it('should throw error if entry not found', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      await expect(
        service.updateAmountHistoryEntry(
          'case-1', 'income', 'item-1', 'nonexistent',
          { amount: 100 }
        )
      ).rejects.toThrow('History entry not found');
    });
  });

  describe('deleteAmountHistoryEntry', () => {
    it('should delete a history entry', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 100,
          startDate: '2024-11-01',
          createdAt: '2024-11-01T10:00:00Z',
        },
        {
          id: 'entry-2',
          amount: 200,
          startDate: '2024-12-01',
          createdAt: '2024-12-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.deleteAmountHistoryEntry(
        'case-1', 'income', 'item-1', 'entry-1'
      );

      expect(result.amountHistory).toHaveLength(1);
      expect(result.amountHistory![0].id).toBe('entry-2');
    });

    it('should recalculate amount after deletion', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 100,
          startDate: '2024-11-01',
          createdAt: '2024-11-01T10:00:00Z',
        },
        {
          id: 'entry-2',
          amount: 500,
          startDate: '2024-12-01',
          createdAt: '2024-12-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.deleteAmountHistoryEntry(
        'case-1', 'income', 'item-1', 'entry-2'
      );

      // Should fall back to previous entry or original amount
      expect(result.amountHistory).toHaveLength(1);
    });

    it('should clear amountHistory when last entry deleted', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [
        {
          id: 'entry-1',
          amount: 200,
          startDate: '2024-12-01',
          createdAt: '2024-12-01T10:00:00Z',
        },
      ];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      const result = await service.deleteAmountHistoryEntry(
        'case-1', 'income', 'item-1', 'entry-1'
      );

      expect(result.amountHistory).toBeUndefined();
      expect(result.amount).toBe(100); // Falls back to original
    });

    it('should throw error if entry not found', async () => {
      const mockData = createBaseMockData();
      const itemWithHistory = createMockFinancialItem('item-1', 'case-1', 'income', 100);
      itemWithHistory.amountHistory = [];
      mockData.financials = [itemWithHistory];
      mockFileStorage.setData(mockData);

      await expect(
        service.deleteAmountHistoryEntry('case-1', 'income', 'item-1', 'nonexistent')
      ).rejects.toThrow('History entry not found');
    });
  });

  describe('getItemsForCase', () => {
    it('should return all financial items for a case', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [
        createMockFinancialItem('item-1', 'case-1', 'income', 100),
        createMockFinancialItem('item-2', 'case-1', 'expenses', 50),
        createMockFinancialItem('item-3', 'case-2', 'income', 200),
      ];
      mockFileStorage.setData(mockData);

      const result = await service.getItemsForCase('case-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array if no data', async () => {
      mockFileStorage.setData(null);

      const result = await service.getItemsForCase('case-1');

      expect(result).toEqual([]);
    });
  });

  describe('getItemsForCaseGrouped', () => {
    it('should return items grouped by category', async () => {
      const mockData = createBaseMockData();
      mockData.financials = [
        createMockFinancialItem('item-1', 'case-1', 'income', 100),
        createMockFinancialItem('item-2', 'case-1', 'expenses', 50),
        createMockFinancialItem('item-3', 'case-1', 'resources', 300),
      ];
      mockFileStorage.setData(mockData);

      const result = await service.getItemsForCaseGrouped('case-1');

      expect(result.income).toHaveLength(1);
      expect(result.expenses).toHaveLength(1);
      expect(result.resources).toHaveLength(1);
    });
  });
});
