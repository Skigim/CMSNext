import { GetNotesUseCase } from '@/domain/notes/use-cases/GetNotes';
import { CreateNoteUseCase } from '@/domain/notes/use-cases/CreateNote';
import { UpdateNoteUseCase, type NoteUpdateInput } from '@/domain/notes/use-cases/UpdateNote';
import { DeleteNoteUseCase } from '@/domain/notes/use-cases/DeleteNote';
import { ApplicationState } from '@/application/ApplicationState';
import type { INoteRepository } from '@/domain/common/repositories';
import { Note, type NoteCreateInput } from '@/domain/notes/entities/Note';
import { createLogger } from '@/utils/logger';
import { toast } from 'sonner';
import { DomainError } from '@/domain/common/errors/DomainError';

const logger = createLogger('NoteManagementService');

/**
 * Service Layer: Orchestrates note management use cases
 * 
 * Responsibilities:
 * - Coordinate multiple use cases for complex workflows
 * - Handle UI feedback (toasts, loading states)
 * - Provide simplified API for React hooks
 * - Bridge domain layer with presentation layer
 */
export class NoteManagementService {
  private readonly getNotes: GetNotesUseCase;
  private readonly createNote: CreateNoteUseCase;
  private readonly updateNote: UpdateNoteUseCase;
  private readonly deleteNote: DeleteNoteUseCase;

  constructor(
    private readonly appState: ApplicationState,
    repository: INoteRepository,
  ) {
    this.getNotes = new GetNotesUseCase(appState, repository);
    this.createNote = new CreateNoteUseCase(appState, repository);
    this.updateNote = new UpdateNoteUseCase(appState, repository);
    this.deleteNote = new DeleteNoteUseCase(appState, repository);
  }

  /**
   * Load all notes
   */
  async loadNotes(): Promise<Note[]> {
    logger.lifecycle('[NoteManagementService] Loading all notes');

    this.appState.setNotesLoading(true);
    this.appState.setNotesError(null);

    try {
      const notes = await this.getNotes.execute();
      logger.lifecycle('[NoteManagementService] Notes loaded', { count: notes.length });

      return notes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[NoteManagementService] Failed to load notes', { error: errorMessage });

      // Handle storage unavailable case (before file storage connected)
      const storageUnavailablePatterns = ['directory handle', 'not available', 'readFile skipped'];
      const isStorageUnavailable = storageUnavailablePatterns.some(pattern =>
        errorMessage.includes(pattern)
      );

      if (isStorageUnavailable) {
        logger.warn('[NoteManagementService] Storage not available yet - returning empty notes');
        this.appState.setNotes([]);
        this.appState.setNotesError(null);
        return [];
      }

      this.appState.setNotesError(errorMessage || 'Failed to load notes');
      throw error;
    } finally {
      this.appState.setNotesLoading(false);
    }
  }

  /**
   * Load notes for a specific case
   */
  async loadNotesByCaseId(caseId: string): Promise<Note[]> {
    logger.lifecycle('[NoteManagementService] Loading notes for case', { caseId });

    this.appState.setNotesLoading(true);
    this.appState.setNotesError(null);

    try {
      const notes = await this.getNotes.getByCaseId(caseId);
      logger.lifecycle('[NoteManagementService] Notes loaded for case', {
        caseId,
        count: notes.length,
      });

      return notes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[NoteManagementService] Failed to load notes for case', {
        caseId,
        error: errorMessage,
      });

      this.appState.setNotesError(errorMessage || 'Failed to load notes');
      throw error;
    } finally {
      this.appState.setNotesLoading(false);
    }
  }

  /**
   * Create a new note with UI feedback
   */
  async createNoteWithFeedback(data: NoteCreateInput): Promise<Note> {
    this.appState.setNotesError(null);
    const toastId = toast.loading('Creating note...');

    try {
      const note = await this.createNote.execute(data);

      toast.success('Note created successfully', { id: toastId });

      logger.lifecycle('[NoteManagementService] Note created successfully', {
        noteId: note.id,
      });

      return note;
    } catch (error) {
      // Handle AbortError (user cancelled) silently
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('[NoteManagementService] Create operation cancelled by user');
        toast.dismiss(toastId);
        throw error;
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to create note';
      logger.error('[NoteManagementService] Failed to create note', { error });
      toast.error(errorMsg, { id: toastId });
      this.appState.setNotesError(errorMsg);
      throw error;
    }
  }

  /**
   * Update an existing note with UI feedback
   */
  async updateNoteWithFeedback(noteId: string, updates: NoteUpdateInput): Promise<void> {
    this.appState.setNotesError(null);
    const toastId = toast.loading('Updating note...');

    try {
      await this.updateNote.execute(noteId, updates);

      toast.success('Note updated successfully', { id: toastId });

      logger.lifecycle('[NoteManagementService] Note updated successfully', {
        noteId,
      });
    } catch (error) {
      // Handle AbortError (user cancelled) silently
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('[NoteManagementService] Update operation cancelled by user');
        toast.dismiss(toastId);
        throw error;
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to update note';
      logger.error('[NoteManagementService] Failed to update note', {
        noteId,
        error,
      });
      toast.error(errorMsg, { id: toastId });
      this.appState.setNotesError(errorMsg);
      throw error;
    }
  }

  /**
   * Delete a note with UI feedback
   */
  async deleteNoteWithFeedback(noteId: string): Promise<void> {
    this.appState.setNotesError(null);
    const toastId = toast.loading('Deleting note...');

    try {
      await this.deleteNote.execute(noteId);

      toast.success('Note deleted successfully', { id: toastId });

      logger.lifecycle('[NoteManagementService] Note deleted successfully', {
        noteId,
      });
    } catch (error) {
      // Handle AbortError (user cancelled) silently
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('[NoteManagementService] Delete operation cancelled by user');
        toast.dismiss(toastId);
        throw error;
      }

      const errorMsg = error instanceof DomainError ? error.message : 'Failed to delete note';
      logger.error('[NoteManagementService] Failed to delete note', {
        noteId,
        error,
      });
      toast.error(errorMsg, { id: toastId });
      this.appState.setNotesError(errorMsg);
      throw error;
    }
  }
}
