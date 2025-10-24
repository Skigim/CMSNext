import ApplicationState from '@/application/ApplicationState';
import StorageRepository from '@/infrastructure/storage/StorageRepository';
import { Case, type CaseCreateInput } from '@/domain/cases/entities/Case';
import ValidationError from '@/domain/common/errors/ValidationError';

export type CreateCaseInput = Omit<CaseCreateInput, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: CaseCreateInput['status'];
};

/**
 * Use case responsible for creating a case within the refactored architecture.
 */
export class CreateCaseUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
  ) {}

  /**
   * Execute the create case flow: validate input, instantiate entity, mutate state, persist to storage.
   */
  async execute(input: CreateCaseInput): Promise<Case> {
    this.validate(input);

    const caseEntity = Case.create(input);

    this.appState.addCase(caseEntity);

    try {
      await this.storage.cases.save(caseEntity);
    } catch (error) {
      this.appState.removeCase(caseEntity.id);
      throw error;
    }

    return caseEntity.clone();
  }

  private validate(input: CreateCaseInput): void {
    if (!input.name?.trim()) {
      throw new ValidationError('Case name is required');
    }

    if (!input.mcn?.trim()) {
      throw new ValidationError('Case MCN is required');
    }

    if (!input.personId?.trim()) {
      throw new ValidationError('Case personId is required');
    }
  }
}

export default CreateCaseUseCase;
