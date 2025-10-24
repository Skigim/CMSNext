import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationState from '@/application/ApplicationState';
import StorageRepository from '@/infrastructure/storage/StorageRepository';
import { CaseStatus } from '@/domain/cases/entities/Case';
import { CreateCaseUseCase, type CreateCaseInput } from '@/domain/cases/use-cases/CreateCase';
import ValidationError from '@/domain/common/errors/ValidationError';

class StorageRepositoryStub {
  public readonly savedCases: unknown[] = [];

  public readonly cases = {
    save: vi.fn(async (entity: unknown) => {
      this.savedCases.push(entity);
    }),
    getById: vi.fn(),
    getAll: vi.fn(),
    delete: vi.fn(),
    findByMCN: vi.fn(),
    searchCases: vi.fn(),
  };

  public readonly financials = {} as never;
  public readonly notes = {} as never;
  public readonly alerts = {} as never;
  public readonly activity = {} as never;
}

describe('CreateCaseUseCase', () => {
  let storageStub: StorageRepositoryStub;
  let useCase: CreateCaseUseCase;

  const baseInput: CreateCaseInput = {
    mcn: 'MCN-2001',
    name: 'Integration Case',
    personId: 'person-2001',
    metadata: { createdBy: 'test' },
  };

  beforeEach(() => {
    ApplicationState.resetInstance();
    storageStub = new StorageRepositoryStub();
    useCase = new CreateCaseUseCase(ApplicationState.getInstance(), storageStub as unknown as StorageRepository);
  });

  afterEach(() => {
    ApplicationState.resetInstance();
    vi.clearAllMocks();
  });

  it('creates, stores, and persists a case aggregate', async () => {
    const result = await useCase.execute(baseInput);

    expect(result.name).toBe('Integration Case');
    expect(result.status).toBe(CaseStatus.Active);
    expect(ApplicationState.getInstance().getCase(result.id)).not.toBeNull();
    expect(storageStub.cases.save).toHaveBeenCalledWith(expect.anything());
    expect(storageStub.savedCases).toHaveLength(1);
  });

  it('validates required fields before creation', async () => {
    await expect(useCase.execute({ ...baseInput, name: ' ' })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ ...baseInput, mcn: '' })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ ...baseInput, personId: '' })).rejects.toThrow(ValidationError);
  });

  it('returns a defensive clone of the created case', async () => {
    const result = await useCase.execute(baseInput);

    expect(storageStub.savedCases[0]).toBeDefined();
    if (storageStub.savedCases[0] && typeof storageStub.savedCases[0] === 'object') {
      const saved = storageStub.savedCases[0] as { id: string };
      expect(saved.id).toBe(result.id);
    }

    expect(() => {
      // Attempt to mutate the returned entity should not affect application state
      result.updateStatus(CaseStatus.Pending);
    }).not.toThrow();

    const stored = ApplicationState.getInstance().getCase(result.id);
    expect(stored?.status).toBe(CaseStatus.Active);
  });
});
