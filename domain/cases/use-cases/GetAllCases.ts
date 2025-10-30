import { ApplicationState } from '@/application/ApplicationState';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { Case } from '@/domain/cases/entities/Case';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('GetAllCasesUseCase');

/**
 * Use Case: Get all cases
 * Pattern: Load from Storage → Update ApplicationState → Return Cases
 */
export class GetAllCasesUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
  ) {}

  async execute(): Promise<Case[]> {
    logger.info('Loading all cases');

    try {
      const cases = await this.storage.cases.getAll();

      logger.info('Cases loaded successfully', { count: cases.length });

      // Return cloned cases to prevent mutation
      return cases.map(c => c.clone());
    } catch (error) {
      logger.error('Failed to load cases', { error });
      throw new DomainError('Failed to load cases', { cause: error });
    }
  }
}

export default GetAllCasesUseCase;
