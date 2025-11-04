import { NoteManagementService } from './NoteManagementService';
import { NoteManagementAdapter } from './NoteManagementAdapter';
import type { ApplicationState } from '@/application/ApplicationState';
import type { StorageRepository } from '@/infrastructure/storage/StorageRepository';

/**
 * Factory for creating NoteManagementService instances
 * 
 * Provides singleton pattern for service layer
 */
export class NoteServiceFactory {
  private static instance: NoteManagementService | null = null;

  /**
   * Get or create the singleton NoteManagementService instance
   */
  static getInstance(
    appState: ApplicationState,
    storage: StorageRepository
  ): NoteManagementService {
    if (!this.instance) {
      const adapter = new NoteManagementAdapter(storage);
      this.instance = new NoteManagementService(appState, adapter);
    }
    return this.instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }
}
