import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('DeleteCaseUseCase');

export interface DeleteCaseInput {
  caseId: string;
}

/**
 * Use Case: Delete a case
 * Pattern: Validate → Optimistic Update → Persist → Rollback on Error
 */
export class DeleteCaseUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(input: DeleteCaseInput): Promise<void> {
    this.validateInput(input);

    const existing = this.appState.getCase(input.caseId);
    if (!existing) {
      throw new DomainError(`Case not found: ${input.caseId}`);
    }

    logger.info('Deleting case', {
      caseId: input.caseId,
      mcn: existing.mcn,
    });

    // Optimistic update - remove from state
    const backup = existing.clone();
    this.appState.removeCase(input.caseId);

    try {
      await this.storage.cases.delete(input.caseId);

      await this.eventBus.publish('CaseDeleted', existing.toJSON(), {
        aggregateId: existing.id,
        metadata: { mcn: existing.mcn },
      });

      logger.info('Case deleted successfully', { caseId: input.caseId });
    } catch (error) {
      logger.error('Failed to delete case, rolling back', {
        error,
        caseId: input.caseId,
      });

      // Rollback - restore case
      this.appState.addCase(backup);
      throw new DomainError('Failed to delete case', { cause: error });
    }
  }

  private validateInput(input: DeleteCaseInput): void {
    if (!input.caseId?.trim()) {
      throw new DomainError('Case ID is required');
    }
  }
}

export default DeleteCaseUseCase;
