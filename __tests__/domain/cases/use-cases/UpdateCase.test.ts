import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateCaseUseCase } from '@/domain/cases/use-cases/UpdateCase';
import { ApplicationState } from '@/application/ApplicationState';
import type { DomainEventBus } from '@/application/DomainEventBus';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import type { ICaseRepository } from '@/domain/common/repositories';
import { Case } from '@/domain/cases/entities/Case';
import { Person } from '@/domain/cases/entities/Person';

describe('UpdateCaseUseCase', () => {
  let appState: ApplicationState;
  let mockStorage: StorageRepository;
  let mockCaseRepository: ICaseRepository;
  let mockEventBus: DomainEventBus;

  beforeEach(() => {
    ApplicationState.resetForTesting();
    appState = ApplicationState.getInstance();

    mockCaseRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      delete: vi.fn(),
      findByMCN: vi.fn(),
      searchCases: vi.fn(),
    } as unknown as ICaseRepository;

    mockStorage = {
      cases: mockCaseRepository,
    } as unknown as StorageRepository;

    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventBus;
  });

  it('updates a case with optimistic update and persists it', async () => {
    // Setup - create initial case
    const person = Person.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
    });

    const initialCase = Case.create({
      mcn: 'MCN-001',
      name: 'Original Name',
      personId: person.id,
      person,
    });

    appState.addCase(initialCase);

  const useCase = new UpdateCaseUseCase(appState, mockStorage, mockEventBus);

    // Execute
    const result = await useCase.execute({
      caseId: initialCase.id,
      updates: { name: 'Updated Name' },
    });

    // Assert
    expect(result.name).toBe('Updated Name');
    expect(result.mcn).toBe('MCN-001');

    const stateCase = appState.getCase(initialCase.id);
    expect(stateCase?.name).toBe('Updated Name');

    expect(mockCaseRepository.save).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'CaseUpdated',
      expect.objectContaining({ id: initialCase.id, name: 'Updated Name' }),
      expect.objectContaining({ aggregateId: initialCase.id, metadata: { mcn: initialCase.mcn } }),
    );
  });

  it('rolls back optimistic update when persistence fails', async () => {
    const person = Person.create({
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: new Date('1985-05-15'),
    });

    const initialCase = Case.create({
      mcn: 'MCN-002',
      name: 'Original',
      personId: person.id,
      person,
    });

    appState.addCase(initialCase);

    mockCaseRepository.save = vi.fn().mockRejectedValue(new Error('persist failed'));

  const useCase = new UpdateCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({
        caseId: initialCase.id,
        updates: { name: 'Should Fail' },
      }),
    ).rejects.toThrow('Failed to update case');

    // Verify rollback - should still have original name
    const stateCase = appState.getCase(initialCase.id);
    expect(stateCase?.name).toBe('Original');
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('throws error when case not found', async () => {
  const useCase = new UpdateCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({
        caseId: 'non-existent-id',
        updates: { name: 'Updated' },
      }),
    ).rejects.toThrow('Case not found');
  });

  it('validates required fields', async () => {
  const useCase = new UpdateCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({
        caseId: '',
        updates: { name: 'Updated' },
      }),
    ).rejects.toThrow('Case ID is required');
  });
});
