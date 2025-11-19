import { describe, it, expect, beforeEach } from 'vitest';
import { DataManager } from '@/utils/DataManager';
import StorageRepository from '@/infrastructure/storage/StorageRepository';
import { FileStorageService } from '@/utils/services/FileStorageService';
import { normalizeCaseNotes } from '@/utils/normalization';
import { CreateFinancialItem } from '@/domain/financials/useCases/CreateFinancialItem';
import { FinancialCategory } from '@/domain/financials/entities/FinancialItem';
import type AutosaveFileService from '@/utils/AutosaveFileService';

// Mock AutosaveFileService
class MockAutosaveFileService {
  private data: any | null;
  public writes = 0;

  constructor(initialData?: any) {
    this.data = initialData ? JSON.parse(JSON.stringify(initialData)) : null;
  }

  async readFile(): Promise<any | null> {
    return this.data ? JSON.parse(JSON.stringify(this.data)) : null;
  }

  async writeFile(payload: any): Promise<boolean> {
    this.data = JSON.parse(JSON.stringify(payload));
    this.writes += 1;
    return true;
  }

  async readNamedFile(_name: string): Promise<any | null> {
    return null;
  }

  async writeNamedFile(_name: string, _content: any): Promise<boolean> {
    return true;
  }
  
  isSupported() { return true; }
  getStatus() { return { isRunning: true }; }
  updateConfig() {}
  startAutosave() {}
  stopAutosave() {}
  destroy() {}
  initializeWithReactState() {}
  setDataLoadCallback() {}
  notifyDataChange() {}
}

describe('Financial Migration Integration', () => {
  let mockFileService: MockAutosaveFileService;
  let fileStorageService: FileStorageService;
  let dataManager: DataManager;
  let storageRepository: StorageRepository;
  let createFinancialItem: CreateFinancialItem;

  beforeEach(() => {
    mockFileService = new MockAutosaveFileService({
      cases: [],
      exported_at: new Date().toISOString(),
      total_cases: 0,
      categoryConfig: {},
      activityLog: []
    });

    fileStorageService = new FileStorageService({
      fileService: mockFileService as unknown as AutosaveFileService,
      persistNormalizationFixes: false,
      normalizeCaseNotes,
    });

    dataManager = new DataManager({
      fileService: mockFileService as unknown as AutosaveFileService,
      fileStorageService: fileStorageService,
      persistNormalizationFixes: false,
    });

    storageRepository = new StorageRepository(fileStorageService);
    createFinancialItem = new CreateFinancialItem(storageRepository.cases, storageRepository);
  });

  it('Round Trip: Legacy Create Case -> New Domain Add Financial -> Legacy Read Case', async () => {
    // 1. Create a Case via DataManager (Legacy)
    const newCaseData = {
      person: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '555-0123',
        dateOfBirth: '1980-01-01',
        ssn: '000-00-0000',
        gender: 'Male',
        livingArrangement: 'Home',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'NY',
          zip: '10001'
        },
        mailingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'NY',
          zip: '10001',
          sameAsPhysical: true
        },
        status: 'Active'
      },
      caseRecord: {
        mcn: 'MCN-TEST-001',
        applicationDate: '2025-01-01',
        caseType: 'Standard',
        personId: '', // Will be ignored/overwritten by service
        status: 'Active' as const,
        description: 'Test Case',
        livingArrangement: 'Home',
        admissionDate: '2025-01-01',
        organizationId: 'ORG-001',
        assignedAdjusterId: 'ADJ-001',
        assignedCaseManagerId: 'CM-001',
        intakeDate: '2025-01-01',
      }
    };

    const createdCase = await dataManager.createCompleteCase(newCaseData);
    expect(createdCase).toBeDefined();
    expect(createdCase.id).toBeDefined();

    // 2. Add a Financial Item via CreateFinancialItem (New Domain)
    const financialItem = await createFinancialItem.execute({
      caseId: createdCase.id,
      category: FinancialCategory.Income,
      description: 'Test Income',
      amount: 5000,
      frequency: 'Monthly',
    });

    expect(financialItem).toBeDefined();
    expect(financialItem.caseId).toBe(createdCase.id);

    // 3. Read the Case back via DataManager (Legacy)
    // We verify the legacy structure directly via fileStorageService which DataManager uses
    const legacyData = await fileStorageService.readFileData();
    expect(legacyData).toBeDefined();
    
    const legacyCase = legacyData!.cases.find(c => c.id === createdCase.id);
    expect(legacyCase).toBeDefined();
    
    // 4. Assert: The Financial Item appears correctly in the Legacy view
    expect(legacyCase!.caseRecord.financials).toBeDefined();
    expect(legacyCase!.caseRecord.financials.income).toBeDefined();
    expect(legacyCase!.caseRecord.financials.income.length).toBe(1);
    expect(legacyCase!.caseRecord.financials.income[0].description).toBe('Test Income');
    expect(legacyCase!.caseRecord.financials.income[0].amount).toBe(5000);
    
    // Verify other categories are present but empty
    expect(legacyCase!.caseRecord.financials.resources).toBeDefined();
    expect(legacyCase!.caseRecord.financials.expenses).toBeDefined();
  });
});
