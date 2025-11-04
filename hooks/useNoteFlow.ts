import { useCallback, useRef, useEffect } from "react";
import { useApplicationState } from "@/application/hooks/useApplicationState";
import { useNoteService } from "@/contexts/NoteServiceContext";
import type { Note, NoteCategory, NoteCreateInput } from "@/domain/notes/entities/Note";
import type { NoteUpdateInput } from "@/domain/notes/use-cases/UpdateNote";

interface UseNoteFlowParams {
  caseId: string | null;
}

interface UseNoteFlowResult {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  createNote: (data: NoteCreateInput) => Promise<Note>;
  updateNote: (noteId: string, updates: NoteUpdateInput) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  getNotesByCategory: (category: NoteCategory) => Note[];
}

/**
 * Hook for managing note operations
 * 
 * Provides access to note management through the service layer
 */
export function useNoteFlow({ caseId }: UseNoteFlowParams): UseNoteFlowResult {
  const service = useNoteService();

  // Use ref to maintain stable service reference across renders
  const serviceRef = useRef(service);
  serviceRef.current = service;

  // Subscribe to reactive state
  const notes = useApplicationState(
    appState => (caseId ? appState.getNotesByCaseId(caseId) : []),
  );
  const isLoading = useApplicationState(appState => appState.getNotesLoading());
  const error = useApplicationState(appState => appState.getNotesError());

  // Load notes when case changes
  useEffect(() => {
    if (!caseId) {
      return;
    }

    const loadNotes = async () => {
      try {
        await serviceRef.current.loadNotesByCaseId(caseId);
      } catch (error) {
        // Error already handled by service layer
        console.error('[useNoteFlow] Failed to load notes:', error);
      }
    };

    loadNotes();
  }, [caseId]);

  const createNote = useCallback(
    async (data: NoteCreateInput): Promise<Note> => {
      return serviceRef.current.createNoteWithFeedback(data);
    },
    [],
  );

  const updateNote = useCallback(
    async (noteId: string, updates: NoteUpdateInput): Promise<void> => {
      await serviceRef.current.updateNoteWithFeedback(noteId, updates);
    },
    [],
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<void> => {
      await serviceRef.current.deleteNoteWithFeedback(noteId);
    },
    [],
  );

  const getNotesByCategory = useCallback(
    (category: NoteCategory): Note[] => {
      return notes.filter((note: Note) => note.category === category);
    },
    [notes],
  );

  return {
    notes,
    isLoading,
    error,
    createNote,
    updateNote,
    deleteNote,
    getNotesByCategory,
  };
}
