import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { INoteRepository } from '@/domain/common/repositories';
import type { NoteSnapshot } from '@/domain/notes/entities/Note';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('UpdateNoteUseCase');

export type NoteUpdateInput = Partial<Omit<NoteSnapshot, 'id' | 'caseId' | 'createdAt'>>;

/**
 * Use Case: Update an existing note
 * Pattern: Load existing → Apply updates → Optimistic update → Persist → Publish Event → Rollback on Error
 */
export class UpdateNoteUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: INoteRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(noteId: string, updates: NoteUpdateInput): Promise<void> {
    logger.info('[UpdateNote] Updating note', { noteId });

    // Load existing note from repository
    const existingNote = await this.repository.getById(noteId);
    if (!existingNote) {
      throw new DomainError(`Note not found: ${noteId}`);
    }

    // Apply updates immutably
    const updatedNote = existingNote.applyUpdates(updates);

    // Optimistic update: update state immediately
    this.appState.upsertNote(updatedNote);

    try {
      // Persist to storage
      await this.repository.save(updatedNote);

      // Publish domain event on success
      await this.eventBus.publish('NoteUpdated', updatedNote.toJSON(), {
        aggregateId: updatedNote.caseId,
        metadata: {
          noteId: updatedNote.id,
          category: updatedNote.category,
        },
      });

      logger.lifecycle('[UpdateNote] Note updated successfully', {
        noteId,
      });
    } catch (error) {
      logger.error('[UpdateNote] Failed to persist, rolling back', {
        error,
        noteId,
      });

      // Rollback optimistic update: restore original note
      this.appState.upsertNote(existingNote);
      throw new DomainError(`Failed to update note ${noteId}`, { cause: error });
    }
  }
}
