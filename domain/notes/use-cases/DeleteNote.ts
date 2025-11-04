import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { INoteRepository } from '@/domain/common/repositories';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('DeleteNoteUseCase');

/**
 * Use Case: Delete a note
 * Pattern: Load existing → Optimistic delete → Persist → Publish Event → Rollback on Error
 */
export class DeleteNoteUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: INoteRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(noteId: string): Promise<void> {
    logger.info('[DeleteNote] Deleting note', { noteId });

    // Load existing note for potential rollback
    const existingNote = await this.repository.getById(noteId);
    if (!existingNote) {
      throw new DomainError(`Note not found: ${noteId}`);
    }

    // Optimistic delete: remove from state immediately
    this.appState.removeNote(noteId);

    try {
      // Persist deletion to storage
      await this.repository.delete(noteId);

      // Publish domain event on success
      await this.eventBus.publish('NoteDeleted', existingNote.toJSON(), {
        aggregateId: existingNote.caseId,
        metadata: {
          noteId,
          category: existingNote.category,
        },
      });

      logger.lifecycle('[DeleteNote] Note deleted successfully', {
        noteId,
      });
    } catch (error) {
      logger.error('[DeleteNote] Failed to persist deletion, rolling back', {
        error,
        noteId,
      });

      // Rollback optimistic delete: restore note
      this.appState.upsertNote(existingNote);
      throw new DomainError(`Failed to delete note ${noteId}`, { cause: error });
    }
  }
}
