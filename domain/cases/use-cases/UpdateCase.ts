import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { Case, type CaseSnapshot } from '@/domain/cases/entities/Case';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('UpdateCaseUseCase');

export interface UpdateCaseInput {
  caseId: string;
  updates: Partial<CaseSnapshot>;
}

/**
 * Use Case: Update an existing case
 * Pattern: Validate → Optimistic Update → Persist → Rollback on Error
 */
export class UpdateCaseUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly storage: StorageRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(input: UpdateCaseInput): Promise<Case> {
    this.validateInput(input);

    const existing = this.appState.getCase(input.caseId);
    if (!existing) {
      throw new DomainError(`Case not found: ${input.caseId}`);
    }

    // Disallow updating identity/creation fields
    const { id: _ignoreId, createdAt: _ignoreCreatedAt, ...rest } = input.updates ?? {};
    const updatedSnapshot: CaseSnapshot = {
      ...existing.toJSON(),
      ...rest,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const updatedCase = Case.rehydrate(updatedSnapshot);

    logger.info('Updating case', {
      caseId: updatedCase.id,
    });

    // Optimistic update
    const previousCase = existing.clone();
    this.appState.updateCase(existing.id, updatedSnapshot);

    try {
      await this.storage.cases.save(updatedCase);

      await this.eventBus.publish('CaseUpdated', updatedCase.toJSON(), {
        aggregateId: updatedCase.id,
        metadata: { mcn: updatedCase.mcn },
      });

      logger.info('Case updated successfully', { caseId: updatedCase.id });

      return updatedCase.clone();
    } catch (error) {
      logger.error('Failed to persist case update, rolling back', {
        error,
        caseId: updatedCase.id,
      });

      // Rollback to previous state (by stable id)
      this.appState.updateCase(existing.id, previousCase.toJSON());
      throw new DomainError('Failed to update case', { cause: error });
    }
  }

  private validateInput(input: UpdateCaseInput): void {
    if (!input.caseId?.trim()) {
      throw new DomainError('Case ID is required');
    }
  }
}

export default UpdateCaseUseCase;
