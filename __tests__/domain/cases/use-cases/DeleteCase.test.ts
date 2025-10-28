import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteCaseUseCase } from '@/domain/cases/use-cases/DeleteCase';
import { ApplicationState } from '@/application/ApplicationState';
import type { DomainEventBus } from '@/application/DomainEventBus';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import type { ICaseRepository } from '@/domain/common/repositories';
import { Case } from '@/domain/cases/entities/Case';
import { Person } from '@/domain/cases/entities/Person';

describe('DeleteCaseUseCase', () => {
  let appState: ApplicationState;
  let mockStorage: StorageRepository;
  let mockCaseRepository: ICaseRepository;
  let mockEventBus: DomainEventBus;

  beforeEach(() => {
    ApplicationState.resetForTesting();
    appState = ApplicationState.getInstance();

    mockCaseRepository = {
      save: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
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

  it('deletes a case with optimistic update and persists deletion', async () => {
    const person = Person.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
    });

    const caseToDelete = Case.create({
      mcn: 'MCN-001',
      name: 'Case to Delete',
      personId: person.id,
      person,
    });

    appState.addCase(caseToDelete);

  const useCase = new DeleteCaseUseCase(appState, mockStorage, mockEventBus);

    await useCase.execute({ caseId: caseToDelete.id });

    // Verify removed from state
    const stateCase = appState.getCase(caseToDelete.id);
    expect(stateCase).toBeNull();

    // Verify persistence called
    expect(mockCaseRepository.delete).toHaveBeenCalledTimes(1);
    expect(mockCaseRepository.delete).toHaveBeenCalledWith(caseToDelete.id);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'CaseDeleted',
      expect.objectContaining({ id: caseToDelete.id, mcn: 'MCN-001' }),
      expect.objectContaining({ aggregateId: caseToDelete.id, metadata: { mcn: 'MCN-001' } }),
    );
  });

  it('rolls back deletion when persistence fails', async () => {
    const person = Person.create({
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: new Date('1985-05-15'),
    });

    const caseToDelete = Case.create({
      mcn: 'MCN-002',
      name: 'Should Not Delete',
      personId: person.id,
      person,
    });

    appState.addCase(caseToDelete);

    mockCaseRepository.delete = vi.fn().mockRejectedValue(new Error('delete failed'));

  const useCase = new DeleteCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({ caseId: caseToDelete.id }),
    ).rejects.toThrow('Failed to delete case');

    // Verify rollback - case should still exist
    const stateCase = appState.getCase(caseToDelete.id);
    expect(stateCase).not.toBeNull();
    expect(stateCase?.name).toBe('Should Not Delete');
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('throws error when case not found', async () => {
  const useCase = new DeleteCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({ caseId: 'non-existent-id' }),
    ).rejects.toThrow('Case not found');
  });

  it('validates required fields', async () => {
  const useCase = new DeleteCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({ caseId: '' }),
    ).rejects.toThrow('Case ID is required');
  });
});
