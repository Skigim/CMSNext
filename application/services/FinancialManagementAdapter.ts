import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import type { IFinancialRepository } from '@/domain/common/repositories';
import { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import type { FinancialCategory } from '@/domain/financials/entities/FinancialItem';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('FinancialManagementAdapter');

/**
 * Adapter bridging domain layer (IFinancialRepository) to infrastructure layer (StorageRepository)
 * 
 * This adapter allows use cases to work with domain entities while the underlying
 * storage uses StorageRepository. With the new storage schema, financials are stored
 * directly at the root level (not embedded in caseRecord).
 * 
 * Pattern: Repository Pattern + Adapter Pattern
 */
export class FinancialManagementAdapter implements IFinancialRepository {
  constructor(private readonly storage: StorageRepository) {}

  async getById(id: string): Promise<FinancialItem | null> {
    try {
      logger.lifecycle('[FinancialAdapter] Getting item by ID', { id });

      const item = await this.storage.financials.getById(id);

      if (!item) {
        logger.warn('[FinancialAdapter] Item not found', { id });
        return null;
      }

      return item;
    } catch (error) {
      logger.error('[FinancialAdapter] Failed to get item by ID', { id, error });
      throw new DomainError(`Failed to retrieve financial item ${id}`, { cause: error });
    }
  }

  async getAll(): Promise<FinancialItem[]> {
    try {
      logger.lifecycle('[FinancialAdapter] Getting all items');

      const items = await this.storage.financials.getAll();

      logger.lifecycle('[FinancialAdapter] Retrieved items', { count: items.length });
      return items;
    } catch (error) {
      logger.error('[FinancialAdapter] Failed to get all items', { error });
      throw new DomainError('Failed to retrieve financial items', { cause: error });
    }
  }

  async save(entity: FinancialItem): Promise<void> {
    try {
      logger.lifecycle('[FinancialAdapter] Saving item', {
        itemId: entity.id,
        caseId: entity.caseId,
      });

      await this.storage.financials.save(entity);

      logger.lifecycle('[FinancialAdapter] Item saved successfully', {
        itemId: entity.id,
      });
    } catch (error) {
      logger.error('[FinancialAdapter] Failed to save item', {
        itemId: entity.id,
        error,
      });
      throw new DomainError(`Failed to save financial item ${entity.id}`, { cause: error });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      logger.lifecycle('[FinancialAdapter] Deleting item', { id });

      await this.storage.financials.delete(id);

      logger.lifecycle('[FinancialAdapter] Item deleted successfully', { id });
    } catch (error) {
      logger.error('[FinancialAdapter] Failed to delete item', { id, error });
      throw new DomainError(`Failed to delete financial item ${id}`, { cause: error });
    }
  }

  async getByCaseId(caseId: string): Promise<FinancialItem[]> {
    try {
      logger.lifecycle('[FinancialAdapter] Getting items by case ID', { caseId });

      const items = await this.storage.financials.getByCaseId(caseId);

      logger.lifecycle('[FinancialAdapter] Retrieved items for case', {
        caseId,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('[FinancialAdapter] Failed to get items by case ID', {
        caseId,
        error,
      });
      throw new DomainError(`Failed to retrieve financial items for case ${caseId}`, { cause: error });
    }
  }

  async getByCategory(category: FinancialCategory): Promise<FinancialItem[]> {
    try {
      logger.lifecycle('[FinancialAdapter] Getting items by category', { category });

      const items = await this.storage.financials.getByCategory(category);

      logger.lifecycle('[FinancialAdapter] Retrieved items by category', {
        category,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('[FinancialAdapter] Failed to get items by category', {
        category,
        error,
      });
      throw new DomainError(`Failed to retrieve financial items for category ${category}`, { cause: error });
    }
  }
}
