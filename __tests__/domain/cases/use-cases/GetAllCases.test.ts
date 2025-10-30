import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllCasesUseCase } from '@/domain/cases/use-cases/GetAllCases';
import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { Case } from '@/domain/cases/entities/Case';
import { Person } from '@/domain/cases/entities/Person';

describe('GetAllCasesUseCase', () => {
  let storage: StorageRepository;
  let useCase: GetAllCasesUseCase;

  beforeEach(() => {
    // Reset ApplicationState for each test
    ApplicationState.resetForTesting();

    // Mock storage
    storage = {
      cases: {
        getAll: vi.fn(),
      },
    } as unknown as StorageRepository;

    useCase = new GetAllCasesUseCase(storage);
  });

  it('should load all cases from storage', async () => {
    // Arrange
    const person = Person.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
    });

    const testCase = Case.create({
      mcn: 'MCN-001',
      name: 'Test Case',
      personId: person.id,
      person,
    });

    vi.mocked(storage.cases.getAll).mockResolvedValue([testCase]);

    // Act
    const result = await useCase.execute();

    // Assert
    expect(storage.cases.getAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(testCase.id);
    expect(result[0].mcn).toBe('MCN-001');
  });

  it('should return empty array when no cases exist', async () => {
    // Arrange
    vi.mocked(storage.cases.getAll).mockResolvedValue([]);

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result).toHaveLength(0);
  });

  it('should throw DomainError on storage failure', async () => {
    // Arrange
    vi.mocked(storage.cases.getAll).mockRejectedValue(new Error('Storage error'));

    // Act & Assert
    await expect(useCase.execute()).rejects.toThrow('Failed to load cases');
  });

  it('should return cloned cases to prevent mutation', async () => {
    // Arrange
    const person = Person.create({
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '1985-05-15',
    });

    const testCase = Case.create({
      mcn: 'MCN-002',
      name: 'Another Case',
      personId: person.id,
      person,
    });

    vi.mocked(storage.cases.getAll).mockResolvedValue([testCase]);

    // Act
    const result = await useCase.execute();

    // Assert - modify returned case should not affect original
    const returnedCase = result[0];
    expect(returnedCase).not.toBe(testCase);
    expect(returnedCase.id).toBe(testCase.id);
  });
});
