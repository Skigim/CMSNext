import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { IFinancialRepository } from '@/domain/common/repositories';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('DeleteFinancialItemUseCase');

/**
 * Use Case: Delete a financial item
 * Pattern: Load existing → Optimistic delete → Persist → Publish Event → Rollback on Error
 */
export class DeleteFinancialItemUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: IFinancialRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(itemId: string): Promise<void> {
    logger.info('[DeleteFinancialItem] Deleting item', { itemId });

    // Load existing item for potential rollback
    const existingItem = await this.repository.getById(itemId);
    if (!existingItem) {
      throw new DomainError(`Financial item not found: ${itemId}`);
    }

    // Optimistic delete: remove from state immediately
    this.appState.removeFinancialItem(itemId);

    try {
      // Persist deletion to storage
      await this.repository.delete(itemId);

      // Publish domain event on success
      await this.eventBus.publish('FinancialItemDeleted', existingItem.toJSON(), {
        aggregateId: existingItem.caseId,
        metadata: {
          itemId,
          category: existingItem.category,
        },
      });

      logger.lifecycle('[DeleteFinancialItem] Item deleted successfully', {
        itemId,
      });
    } catch (error) {
      logger.error('[DeleteFinancialItem] Failed to persist deletion, rolling back', {
        error,
        itemId,
      });

      // Rollback optimistic delete: restore item
      this.appState.upsertFinancialItem(existingItem);
      throw new DomainError(`Failed to delete financial item ${itemId}`, { cause: error });
    }
  }
}
