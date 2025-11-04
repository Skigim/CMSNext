import { GetFinancialItemsUseCase } from '@/domain/financials/use-cases/GetFinancialItems';
import { CreateFinancialItemUseCase } from '@/domain/financials/use-cases/CreateFinancialItem';
import { UpdateFinancialItemUseCase, type FinancialItemUpdateInput } from '@/domain/financials/use-cases/UpdateFinancialItem';
import { DeleteFinancialItemUseCase } from '@/domain/financials/use-cases/DeleteFinancialItem';
import { ApplicationState } from '@/application/ApplicationState';
import type { IFinancialRepository } from '@/domain/common/repositories';
import { FinancialItem, type FinancialItemCreateInput } from '@/domain/financials/entities/FinancialItem';
import { createLogger } from '@/utils/logger';
import { toast } from 'sonner';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('FinancialManagementService');

/**
 * Service Layer: Orchestrates financial item management use cases
 * 
 * Responsibilities:
 * - Coordinate multiple use cases for complex workflows
 * - Handle UI feedback (toasts, loading states)
 * - Provide simplified API for React hooks
 * - Bridge domain layer with presentation layer
 */
export class FinancialManagementService {
  private readonly getFinancialItems: GetFinancialItemsUseCase;
  private readonly createFinancialItem: CreateFinancialItemUseCase;
  private readonly updateFinancialItem: UpdateFinancialItemUseCase;
  private readonly deleteFinancialItem: DeleteFinancialItemUseCase;

  constructor(
    private readonly appState: ApplicationState,
    repository: IFinancialRepository,
  ) {
    this.getFinancialItems = new GetFinancialItemsUseCase(appState, repository);
    this.createFinancialItem = new CreateFinancialItemUseCase(appState, repository);
    this.updateFinancialItem = new UpdateFinancialItemUseCase(appState, repository);
    this.deleteFinancialItem = new DeleteFinancialItemUseCase(appState, repository);
  }

  /**
   * Load all financial items
   */
  async loadItems(): Promise<FinancialItem[]> {
    logger.lifecycle('[FinancialManagementService] Loading all financial items');

    this.appState.setFinancialItemsLoading(true);
    this.appState.setFinancialItemsError(null);

    try {
      const items = await this.getFinancialItems.execute();
      logger.lifecycle('[FinancialManagementService] Items loaded', { count: items.length });

      return items;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FinancialManagementService] Failed to load items', { error: errorMessage });

      // Handle storage unavailable case (before file storage connected)
      const storageUnavailablePatterns = ['directory handle', 'not available', 'readFile skipped'];
      const isStorageUnavailable = storageUnavailablePatterns.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (isStorageUnavailable) {
        logger.warn('[FinancialManagementService] Storage not available yet - returning empty items');
        this.appState.setFinancialItems([]);
        this.appState.setFinancialItemsError(null);
        return [];
      }

      this.appState.setFinancialItemsError(errorMessage || 'Failed to load financial items');
      throw error;
    } finally {
      this.appState.setFinancialItemsLoading(false);
    }
  }

  /**
   * Load financial items for a specific case
   */
  async loadItemsByCaseId(caseId: string): Promise<FinancialItem[]> {
    logger.lifecycle('[FinancialManagementService] Loading items for case', { caseId });

    this.appState.setFinancialItemsLoading(true);
    this.appState.setFinancialItemsError(null);

    try {
      const items = await this.getFinancialItems.getByCaseId(caseId);
      logger.lifecycle('[FinancialManagementService] Items loaded for case', {
        caseId,
        count: items.length,
      });

      return items;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FinancialManagementService] Failed to load items for case', {
        caseId,
        error: errorMessage,
      });

      this.appState.setFinancialItemsError(errorMessage || 'Failed to load financial items');
      throw error;
    } finally {
      this.appState.setFinancialItemsLoading(false);
    }
  }

  /**
   * Create a new financial item with UI feedback
   */
  async createItemWithFeedback(data: FinancialItemCreateInput): Promise<FinancialItem> {
    this.appState.setFinancialItemsError(null);
    const toastId = toast.loading('Creating financial item...');

    try {
      const item = await this.createFinancialItem.execute(data);

      toast.success('Financial item created successfully', { id: toastId });

      logger.lifecycle('[FinancialManagementService] Item created successfully', {
        itemId: item.id,
      });

      return item;
    } catch (error) {
      // Handle AbortError (user cancelled) silently
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('[FinancialManagementService] Create operation cancelled by user');
        toast.dismiss(toastId);
        throw error;
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to create financial item';
      logger.error('[FinancialManagementService] Failed to create item', { error });
      toast.error(errorMsg, { id: toastId });
      this.appState.setFinancialItemsError(errorMsg);
      throw error;
    }
  }

  /**
   * Update an existing financial item with UI feedback
   */
  async updateItemWithFeedback(
    itemId: string,
    updates: FinancialItemUpdateInput
  ): Promise<void> {
    this.appState.setFinancialItemsError(null);
    const toastId = toast.loading('Updating financial item...');

    try {
      await this.updateFinancialItem.execute(itemId, updates);

      toast.success('Financial item updated successfully', { id: toastId });

      logger.lifecycle('[FinancialManagementService] Item updated successfully', {
        itemId,
      });
    } catch (error) {
      // Handle AbortError (user cancelled) silently
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('[FinancialManagementService] Update operation cancelled by user');
        toast.dismiss(toastId);
        throw error;
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to update financial item';
      logger.error('[FinancialManagementService] Failed to update item', {
        itemId,
        error,
      });
      toast.error(errorMsg, { id: toastId });
      this.appState.setFinancialItemsError(errorMsg);
      throw error;
    }
  }

  /**
   * Delete a financial item with UI feedback
   */
  async deleteItemWithFeedback(itemId: string): Promise<void> {
    this.appState.setFinancialItemsError(null);
    const toastId = toast.loading('Deleting financial item...');

    try {
      await this.deleteFinancialItem.execute(itemId);

      toast.success('Financial item deleted successfully', { id: toastId });

      logger.lifecycle('[FinancialManagementService] Item deleted successfully', {
        itemId,
      });
    } catch (error) {
      // Handle AbortError (user cancelled) silently
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('[FinancialManagementService] Delete operation cancelled by user');
        toast.dismiss(toastId);
        throw error;
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to delete financial item';
      logger.error('[FinancialManagementService] Failed to delete item', {
        itemId,
        error,
      });
      toast.error(errorMsg, { id: toastId });
      this.appState.setFinancialItemsError(errorMsg);
      throw error;
    }
  }
}
