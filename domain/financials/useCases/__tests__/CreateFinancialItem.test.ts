import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateFinancialItem, CreateFinancialItemRequest } from '@/domain/financials/useCases/CreateFinancialItem';
import { FinancialCategory } from '@/domain/financials/entities/FinancialItem';
import { Case } from '@/domain/cases/entities/Case';
import { CASE_STATUS } from '@/types/case';
import type { ICaseRepository } from '@/domain/common/repositories/ICaseRepository';
import type { ITransactionRepository } from '@/domain/common/repositories/ITransactionRepository';
import { ValidationError } from '@/domain/common/errors/ValidationError';

describe('CreateFinancialItem Use Case', () => {
  let createFinancialItem: CreateFinancialItem;
  let mockCaseRepository: ICaseRepository;
  let mockTransactionRepository: ITransactionRepository;

  const mockCase = Case.create({
    mcn: 'MCN-123',
    name: 'Test Case',
    personId: 'person-1',
    status: CASE_STATUS.Active,
  });

  // Mock the touch method since it's not available on the plain object returned by create in tests sometimes
  // or if we are mocking the repository return value.
  // However, Case.create returns a real Case instance.
  // The issue might be that in the test environment, the class method isn't being picked up or 
  // the mockCaseRepository.getById is returning a plain object if we mocked it incorrectly?
  // Actually, we are passing the real instance: vi.mocked(mockCaseRepository.getById).mockResolvedValue(mockCase);
  
  // Let's verify if the touch method exists on the instance.
  // It was added in a previous step.
  
  beforeEach(() => {
    mockCaseRepository = {
      getById: vi.fn(),
      getAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findByMCN: vi.fn(),
      searchCases: vi.fn(),
    };

    mockTransactionRepository = {
      runTransaction: vi.fn(),
    };

    createFinancialItem = new CreateFinancialItem(
      mockCaseRepository,
      mockTransactionRepository
    );
  });

  it('should create a financial item and touch the parent case', async () => {
    // Arrange
    vi.mocked(mockCaseRepository.getById).mockResolvedValue(mockCase);
    const initialUpdatedAt = mockCase.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const request: CreateFinancialItemRequest = {
      caseId: mockCase.id,
      category: FinancialCategory.Income,
      description: 'Monthly Salary',
      amount: 5000,
      verificationStatus: 'Verified',
    };

    // Act
    const result = await createFinancialItem.execute(request);

    // Assert
    expect(result).toBeDefined();
    expect(result.amount).toBe(5000);
    expect(result.description).toBe('Monthly Salary');
    
    // Verify Case was touched (timestamp updated)
    expect(mockCase.updatedAt).not.toBe(initialUpdatedAt);

    // Verify Transaction
    expect(mockTransactionRepository.runTransaction).toHaveBeenCalledTimes(1);
    const operations = vi.mocked(mockTransactionRepository.runTransaction).mock.calls[0][0];
    
    expect(operations).toHaveLength(2);
    expect(operations[0]).toEqual({
      type: 'save',
      domain: 'financials',
      entity: result
    });
    expect(operations[1]).toEqual({
      type: 'save',
      domain: 'cases',
      entity: mockCase
    });
  });

  it('should throw error if case not found', async () => {
    // Arrange
    vi.mocked(mockCaseRepository.getById).mockResolvedValue(null);

    const request: CreateFinancialItemRequest = {
      caseId: 'non-existent',
      category: FinancialCategory.Income,
      description: 'Test',
      amount: 100,
    };

    // Act & Assert
    await expect(createFinancialItem.execute(request))
      .rejects
      .toThrow(ValidationError);
      
    expect(mockTransactionRepository.runTransaction).not.toHaveBeenCalled();
  });
});
