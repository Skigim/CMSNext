import { ApplicationState } from '@/application/ApplicationState';
import { DomainEventBus } from '@/application/DomainEventBus';
import type { INoteRepository } from '@/domain/common/repositories';
import { Note, type NoteCreateInput } from '@/domain/notes/entities/Note';
import { createLogger } from '@/utils/logger';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('CreateNoteUseCase');

/**
 * Use Case: Create a new note
 * Pattern: Validate → Create Entity → Optimistic Update → Persist → Publish Event → Rollback on Error
 */
export class CreateNoteUseCase {
  constructor(
    private readonly appState: ApplicationState,
    private readonly repository: INoteRepository,
    private readonly eventBus: DomainEventBus = DomainEventBus.getInstance(),
  ) {}

  async execute(input: NoteCreateInput): Promise<Note> {
    this.validateInput(input);

    const note = Note.create(input);

    logger.info('[CreateNote] Creating note', {
      noteId: note.id,
      caseId: note.caseId,
      category: note.category,
    });

    // Optimistic update: add to state immediately
    this.appState.upsertNote(note);

    try {
      // Persist to storage
      await this.repository.save(note);

      // Publish domain event on success
      await this.eventBus.publish('NoteCreated', note.toJSON(), {
        aggregateId: note.caseId,
        metadata: {
          noteId: note.id,
          category: note.category,
        },
      });

      logger.lifecycle('[CreateNote] Note created successfully', {
        noteId: note.id,
      });

      return note.clone();
    } catch (error) {
      logger.error('[CreateNote] Failed to persist, rolling back', {
        error,
        noteId: note.id,
      });

      // Rollback optimistic update
      this.appState.removeNote(note.id);
      throw new DomainError('Failed to create note', { cause: error });
    }
  }

  private validateInput(input: NoteCreateInput): void {
    if (!input.caseId?.trim()) {
      throw new DomainError('Case ID is required');
    }

    if (!input.category?.trim()) {
      throw new DomainError('Category is required');
    }

    if (!input.content?.trim()) {
      throw new DomainError('Content is required');
    }
  }
}
