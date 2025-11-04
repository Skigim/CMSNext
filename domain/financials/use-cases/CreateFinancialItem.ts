import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { IFinancialRepository } from '@/domain/common/repositories';
import { FinancialItem, type FinancialItemCreateInput } from '@/domain/financials/entities/FinancialItem';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('CreateFinancialItemUseCase');

/**
 * Use Case: Create a new financial item
 * Pattern: Validate → Create Entity → Optimistic Update → Persist → Publish Event → Rollback on Error
 */
export class CreateFinancialItemUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: IFinancialRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(input: FinancialItemCreateInput): Promise<FinancialItem> {
    this.validateInput(input);

    const item = FinancialItem.create(input);

    logger.info('[CreateFinancialItem] Creating item', {
      itemId: item.id,
      caseId: item.caseId,
      category: item.category,
    });

    // Optimistic update: add to state immediately
    this.appState.upsertFinancialItem(item);

    try {
      // Persist to storage
      await this.repository.save(item);

      // Publish domain event on success
      await this.eventBus.publish('FinancialItemAdded', item.toJSON(), {
        aggregateId: item.caseId,
        metadata: {
          itemId: item.id,
          category: item.category,
          amount: item.amount,
        },
      });

      logger.lifecycle('[CreateFinancialItem] Item created successfully', {
        itemId: item.id,
      });

      return item.clone();
    } catch (error) {
      logger.error('[CreateFinancialItem] Failed to persist, rolling back', {
        error,
        itemId: item.id,
      });

      // Rollback optimistic update
      this.appState.removeFinancialItem(item.id);
      throw new DomainError('Failed to create financial item', { cause: error });
    }
  }

  private validateInput(input: FinancialItemCreateInput): void {
    if (!input.caseId?.trim()) {
      throw new DomainError('Case ID is required');
    }

    if (!input.description?.trim()) {
      throw new DomainError('Description is required');
    }

    if (typeof input.amount !== 'number' || input.amount < 0) {
      throw new DomainError('Amount must be a non-negative number');
    }

    if (!input.category) {
      throw new DomainError('Category is required');
    }
  }
}
