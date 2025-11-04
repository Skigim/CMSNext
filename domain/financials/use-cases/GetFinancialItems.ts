import { ApplicationState } from '@/application/ApplicationState';
import type { IFinancialRepository } from '@/domain/common/repositories';
import { FinancialItem } from '@/domain/financials/entities/FinancialItem';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('GetFinancialItemsUseCase');

/**
 * Use Case: Retrieve all financial items
 * Pattern: Fetch from repository → Update ApplicationState → Return results
 */
export class GetFinancialItemsUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: IFinancialRepository,
  ) {}

  async execute(): Promise<FinancialItem[]> {
    try {
      logger.lifecycle('[GetFinancialItems] Fetching all financial items');
      
      const items = await this.repository.getAll();
      
      // Update centralized state
      this.appState.setFinancialItems(items);
      
      logger.lifecycle('[GetFinancialItems] Loaded items', { count: items.length });
      return items;
    } catch (error) {
      logger.error('[GetFinancialItems] Failed to fetch items', { error });
      throw new DomainError('Failed to retrieve financial items', { cause: error });
    }
  }

  /**
   * Get financial items for a specific case
   */
  async getByCaseId(caseId: string): Promise<FinancialItem[]> {
    try {
      logger.lifecycle('[GetFinancialItems] Fetching items for case', { caseId });
      
      const items = await this.repository.getByCaseId(caseId);
      
      logger.lifecycle('[GetFinancialItems] Loaded items for case', { 
        caseId, 
        count: items.length 
      });
      return items;
    } catch (error) {
      logger.error('[GetFinancialItems] Failed to fetch items for case', { 
        caseId, 
        error 
      });
      throw new DomainError(`Failed to retrieve financial items for case ${caseId}`, { cause: error });
    }
  }
}
