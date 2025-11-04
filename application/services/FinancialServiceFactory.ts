import { ApplicationState } from '@/application/ApplicationState';
import { StorageRepository } from '@/infrastructure/storage/StorageRepository';
import { FinancialManagementService } from './FinancialManagementService';
import { FinancialManagementAdapter } from './FinancialManagementAdapter';

/**
 * Factory for creating and managing the Financial Management Service singleton.
 * 
 * Follows the same pattern as CaseServiceFactory to ensure consistent
 * service instantiation across the application.
 */
export class FinancialServiceFactory {
  private static instance: FinancialManagementService | null = null;

  /**
   * Get or create the singleton Financial Management Service instance.
   * 
   * @param storage - Storage repository for financial data persistence
   * @returns Configured FinancialManagementService instance
   */
  static getInstance(storage: StorageRepository): FinancialManagementService {
    if (!FinancialServiceFactory.instance) {
      const appState = ApplicationState.getInstance();
      const adapter = new FinancialManagementAdapter(storage);
      FinancialServiceFactory.instance = new FinancialManagementService(appState, adapter);
    }

    return FinancialServiceFactory.instance;
  }

  /**
   * Reset the singleton instance.
   * Used primarily for testing to ensure clean state between tests.
   */
  static resetInstance(): void {
    if (process.env.NODE_ENV !== 'production') {
      FinancialServiceFactory.instance = null;
    }
  }

  /**
   * Check if the service instance has been created.
   */
  static hasInstance(): boolean {
    return FinancialServiceFactory.instance !== null;
  }
}
