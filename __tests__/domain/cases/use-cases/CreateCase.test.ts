import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateCaseUseCase } from '@/domain/cases/use-cases/CreateCase';
import { ApplicationState } from '@/application/ApplicationState';
import type { DomainEventBus } from '@/application/DomainEventBus';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import type { ICaseRepository } from '@/domain/common/repositories';
import { CASE_STATUS } from '@/types/case';

const buildPersonInput = () => ({
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: new Date('1990-01-01'),
});

describe('CreateCaseUseCase', () => {
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

  it('creates a case with optimistic update and persists it', async () => {
  const useCase = new CreateCaseUseCase(appState, mockStorage, mockEventBus);

    const result = await useCase.execute({
      mcn: 'MCN-001',
      name: 'Sample Case',
      person: buildPersonInput(),
      metadata: { createdBy: 'unit-test' },
    });

    expect(result).toBeDefined();
    expect(result.mcn).toBe('MCN-001');
    expect(result.name).toBe('Sample Case');

    const cases = appState.getCases();
    expect(cases).toHaveLength(1);
    expect(cases[0].id).toBe(result.id);

    expect(mockCaseRepository.save).toHaveBeenCalledTimes(1);
    expect(mockCaseRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: result.id }));
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'CaseCreated',
      expect.objectContaining({ id: result.id, mcn: 'MCN-001' }),
      expect.objectContaining({ aggregateId: result.id, metadata: { mcn: 'MCN-001' } }),
    );
  });

  it('rolls back optimistic update when persistence fails', async () => {
    mockCaseRepository.save = vi.fn().mockRejectedValue(new Error('persist failed'));

  const useCase = new CreateCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({
        mcn: 'MCN-002',
        name: 'Failure Case',
        person: buildPersonInput(),
      }),
    ).rejects.toThrow('Failed to create case');

    expect(appState.getCases()).toHaveLength(0);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('validates required fields', async () => {
  const useCase = new CreateCaseUseCase(appState, mockStorage, mockEventBus);

    await expect(
      useCase.execute({
        mcn: '',
        name: 'Incomplete Case',
        person: buildPersonInput(),
      }),
    ).rejects.toThrow('MCN is required');

    await expect(
      useCase.execute({
        mcn: 'MCN-003',
        name: '',
        person: buildPersonInput(),
      }),
    ).rejects.toThrow('Case name is required');

    await expect(
      useCase.execute({
        mcn: 'MCN-004',
        name: 'Missing Person',
        person: { ...buildPersonInput(), firstName: '' },
      }),
    ).rejects.toThrow('Person first name is required');
  });

  it('honours provided identifiers, status, and timestamps', async () => {
    const useCase = new CreateCaseUseCase(appState, mockStorage, mockEventBus);

    const now = new Date('2025-10-31T13:45:00Z');
    const nowIso = now.toISOString();

    const customId = 'case-custom-id';

    const result = await useCase.execute({
      id: customId,
      mcn: 'MCN-010',
      name: 'Custom Identifiers Case',
      status: CASE_STATUS.Pending,
      createdAt: now,
      updatedAt: now,
      metadata: { source: 'unit-test' },
      person: buildPersonInput(),
    });

    expect(result.id).toBe(customId);
    expect(result.status).toBe(CASE_STATUS.Pending);
    expect(result.createdAt).toBe(nowIso);
    expect(result.updatedAt).toBe(nowIso);

    expect(mockCaseRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: customId,
        status: CASE_STATUS.Pending,
        createdAt: nowIso,
        updatedAt: nowIso,
        metadata: expect.objectContaining({ source: 'unit-test' }),
      }),
    );
  });
});
