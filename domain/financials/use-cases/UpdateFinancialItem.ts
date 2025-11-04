import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { IFinancialRepository } from '@/domain/common/repositories';
import type { FinancialItemSnapshot } from '@/domain/financials/entities/FinancialItem';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('UpdateFinancialItemUseCase');

export type FinancialItemUpdateInput = Partial<Omit<FinancialItemSnapshot, 'id' | 'caseId' | 'createdAt'>>;

/**
 * Use Case: Update an existing financial item
 * Pattern: Load existing → Apply updates → Optimistic update → Persist → Publish Event → Rollback on Error
 */
export class UpdateFinancialItemUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: IFinancialRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(itemId: string, updates: FinancialItemUpdateInput): Promise<void> {
    logger.info('[UpdateFinancialItem] Updating item', { itemId });

    // Load existing item from repository
    const existingItem = await this.repository.getById(itemId);
    if (!existingItem) {
      throw new DomainError(`Financial item not found: ${itemId}`);
    }

    // Apply updates immutably
    const updatedItem = existingItem.applyUpdates(updates);

    // Optimistic update: update state immediately
    this.appState.upsertFinancialItem(updatedItem);

    try {
      // Persist to storage
      await this.repository.save(updatedItem);

      // Publish domain event on success
      await this.eventBus.publish('FinancialItemUpdated', updatedItem.toJSON(), {
        aggregateId: updatedItem.caseId,
        metadata: {
          itemId: updatedItem.id,
          category: updatedItem.category,
        },
      });

      logger.lifecycle('[UpdateFinancialItem] Item updated successfully', {
        itemId,
      });
    } catch (error) {
      logger.error('[UpdateFinancialItem] Failed to persist, rolling back', {
        error,
        itemId,
      });

      // Rollback optimistic update: restore original item
      this.appState.upsertFinancialItem(existingItem);
      throw new DomainError(`Failed to update financial item ${itemId}`, { cause: error });
    }
  }
}
