import { ApplicationState } from '@/application/ApplicationState';
import type { INoteRepository } from '@/domain/common/repositories';
import { Note } from '@/domain/notes/entities/Note';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('GetNotesUseCase');

/**
 * Use Case: Retrieve notes
 * Pattern: Fetch from repository → Update ApplicationState → Return results
 */
export class GetNotesUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: INoteRepository,
  ) {}

  async execute(): Promise<Note[]> {
    try {
      logger.lifecycle('[GetNotes] Fetching all notes');
      
      const notes = await this.repository.getAll();
      
      // Update centralized state
      this.appState.setNotes(notes);
      
      logger.lifecycle('[GetNotes] Loaded notes', { count: notes.length });
      return notes;
    } catch (error) {
      logger.error('[GetNotes] Failed to fetch notes', { error });
      throw new DomainError('Failed to retrieve notes', { cause: error });
    }
  }

  /**
   * Get notes for a specific case
   */
  async getByCaseId(caseId: string): Promise<Note[]> {
    try {
      logger.lifecycle('[GetNotes] Fetching notes for case', { caseId });
      
      const notes = await this.repository.getByCaseId(caseId);
      
      logger.lifecycle('[GetNotes] Loaded notes for case', { 
        caseId, 
        count: notes.length 
      });
      return notes;
    } catch (error) {
      logger.error('[GetNotes] Failed to fetch notes for case', { 
        caseId, 
        error 
      });
      throw new DomainError(`Failed to retrieve notes for case ${caseId}`, { cause: error });
    }
  }

  /**
   * Get notes filtered by category
   */
  async filterByCategory(caseId: string, category: string): Promise<Note[]> {
    try {
      logger.lifecycle('[GetNotes] Filtering notes by category', { caseId, category });
      
      const notes = await this.repository.filterByCategory(caseId, category);
      
      logger.lifecycle('[GetNotes] Filtered notes by category', {
        caseId,
        category,
        count: notes.length,
      });
      return notes;
    } catch (error) {
      logger.error('[GetNotes] Failed to filter notes', {
        caseId,
        category,
        error,
      });
      throw new DomainError(`Failed to filter notes for case ${caseId}`, { cause: error });
    }
  }
}
