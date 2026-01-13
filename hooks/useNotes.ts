import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Note, NewNoteData, StoredNote } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import { useDataSync } from './useDataSync';

/**
 * Form state for note editor.
 * @interface NoteFormState
 */
interface NoteFormState {
  /** Form visibility */
  isOpen: boolean;
  /** Currently editing note, undefined if creating */
  editingNote?: Note;
  /** Case ID for the note */
  caseId?: string;
}

/**
 * Return type for useNotes hook.
 * @interface UseNotesReturn
 */
interface UseNotesReturn {
  // Data
  /** All notes for active case */
  notes: StoredNote[];
  /** Reload notes from file system */
  refreshNotes: () => Promise<void>;

  // Form state
  /** Note form open/closed and edit state */
  noteForm: NoteFormState;
  
  // Actions
  /** Open form to add new note for case */
  openAddNote: (caseId: string) => void;
  /** Open form to edit existing note */
  openEditNote: (caseId: string, note: Note) => void;
  /** Save note (create or update, auto-detects) */
  saveNote: (noteData: NewNoteData) => Promise<StoredNote | null>;
  /** Create new note for case */
  addNote: (caseId: string, noteData: NewNoteData) => Promise<StoredNote | null>;
  /** Update existing note */
  updateNote: (caseId: string, noteId: string, noteData: NewNoteData) => Promise<StoredNote | null>;
  /** Delete note */
  deleteNote: (caseId: string, noteId: string) => Promise<void>;
  /** Close form without saving */
  closeNoteForm: () => void;
}

/**
 * Notes management hook.
 * 
 * Provides CRUD operations for case notes and form state management.
 * Automatically persists notes through DataManager.
 * 
 * ## Core Principles
 * 
 * - Uses DataManager exclusively (no direct file access)
 * - File system is single source of truth
 * - No render-time data caching
 * - Automatic persistence on all mutations
 * - Safe to use outside DataManagerProvider (returns null)
 * 
 * ## Note Structure
 * 
 * ```typescript
 * interface StoredNote {
 *   id: string;              // Unique identifier
 *   caseId: string;           // Parent case
 *   content: string;          // Note text (supports markdown)
 *   createdAt: string;        // ISO timestamp
 *   updatedAt: string;        // ISO timestamp
 * }
 * ```
 * 
 * ## Form Management
 * 
 * Handles both create and edit workflows:
 * - `openAddNote(caseId)` - New note for case
 * - `openEditNote(caseId, note)` - Edit existing note
 * - `closeNoteForm()` - Close without saving
 * 
 * ## CRUD Operations
 * 
 * ### Read
 * - `refreshNotes()` - Reload notes from file
 * 
 * ### Create/Update
 * - `addNote()` - Create new note
 * - `updateNote()` - Update existing note
 * - `saveNote()` - Create or update (auto-detect)
 * 
 * ### Delete
 * - `deleteNote()` - Remove note
 * 
 * ## Usage Example
 * 
 * ```typescript
 * function NotesPanel({ caseId }: { caseId: string }) {
 *   const {
 *     notes,
 *     noteForm,
 *     openAddNote,
 *     closeNoteForm,
 *     saveNote,
 *     deleteNote
 *   } = useNotes(caseId);
 *   
 *   const handleSaveNote = async (noteData: NewNoteData) => {
 *     const saved = await saveNote(noteData);
 *     if (saved) {
 *       closeNoteForm();
 *       toast.success('Note saved');
 *     }
 *   };
 *   
 *   return (
 *     <>
 *       <button onClick={() => openAddNote(caseId)}>
 *         Add Note
 *       </button>
 *       {notes.map(note => (
 *         <NoteItem
 *           key={note.id}
 *           note={note}
 *           onEdit={() => openEditNote(caseId, note)}
 *           onDelete={() => deleteNote(caseId, note.id)}
 *         />
 *       ))}
 *       {noteForm.isOpen && (
 *         <NoteForm
 *           initialNote={noteForm.editingNote}
 *           onSave={handleSaveNote}
 *           onClose={closeNoteForm}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 * 
 * ## Data Synchronization
 * 
 * Notes automatically sync when:
 * - File data is loaded via FileStorage
 * - Case is switched
 * - `refreshNotes()` called manually
 * 
 * @hook
 * @param {string} [caseId] - Optional case ID to auto-load notes for
 * @returns {UseNotesReturn} Notes state and operations
 * 
 * @see {@link useDataManagerSafe} for safe DataManager access
 * @see {@link DataManager} for underlying persistence
 */
export function useNotes(caseId?: string): UseNotesReturn {
  const dataManager = useDataManagerSafe(); // Returns null if not available - safe fallback
  
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [noteForm, setNoteForm] = useState<NoteFormState>({ isOpen: false });

  const refreshNotes = useCallback(async () => {
    if (!caseId || !dataManager) {
      setNotes([]);
      return;
    }

    try {
      const fetchedNotes = await dataManager.getNotesForCase(caseId);
      setNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  }, [caseId, dataManager]);

  // Sync with file storage data changes
  useDataSync({ onRefresh: refreshNotes });

  /**
   * Open form to add a new note to a case
   */
  const openAddNote = useCallback((targetCaseId: string) => {
    setNoteForm({
      isOpen: true,
      caseId: targetCaseId
    });
  }, []);

  /**
   * Open form to edit an existing note
   */
  const openEditNote = useCallback((targetCaseId: string, note: Note) => {
    setNoteForm({
      isOpen: true,
      editingNote: note,
      caseId: targetCaseId
    });
  }, []);

  const addNote = useCallback(async (targetCaseId: string, noteData: NewNoteData): Promise<StoredNote | null> => {
    if (!dataManager) {
      toast.error('Data storage is not available');
      return null;
    }
    try {
      const note = await dataManager.addNote(targetCaseId, noteData);
      if (caseId === targetCaseId) await refreshNotes();
      return note;
    } catch (e) {
      console.error('Failed to add note:', e);
      toast.error('Failed to add note');
      return null;
    }
  }, [dataManager, caseId, refreshNotes]);

  const updateNote = useCallback(async (targetCaseId: string, noteId: string, noteData: NewNoteData): Promise<StoredNote | null> => {
    if (!dataManager) {
      toast.error('Data storage is not available');
      return null;
    }
    try {
      const note = await dataManager.updateNote(targetCaseId, noteId, noteData);
      if (caseId === targetCaseId) await refreshNotes();
      return note;
    } catch (e) {
      console.error('Failed to update note:', e);
      toast.error('Failed to update note');
      return null;
    }
  }, [dataManager, caseId, refreshNotes]);

  /**
   * Save (create or update) a note
   */
  const saveNote = useCallback(async (noteData: NewNoteData): Promise<StoredNote | null> => {
    if (!noteForm.caseId) {
      toast.error('No case selected for note');
      return null;
    }

    try {
      let savedNote: StoredNote | null;
      
      if (noteForm.editingNote) {
        savedNote = await updateNote(noteForm.caseId, noteForm.editingNote.id, noteData);
        if (savedNote) toast.success("Note updated successfully");
      } else {
        savedNote = await addNote(noteForm.caseId, noteData);
        if (savedNote) toast.success("Note added successfully");
      }
      
      if (savedNote) {
        setNoteForm({ isOpen: false });
      }
      
      return savedNote;
    } catch (err) {
      console.error('Failed to save note:', err);
      return null;
    }
  }, [noteForm.caseId, noteForm.editingNote, addNote, updateNote]);

  /**
   * Delete a note by ID
   */
  const deleteNote = useCallback(async (targetCaseId: string, noteId: string): Promise<void> => {
    if (!dataManager) {
      toast.error('Data storage is not available. Please connect to a folder first.');
      return;
    }

    try {
      await dataManager.deleteNote(targetCaseId, noteId);
      
      toast.success("Note deleted successfully");
      
      // Refresh notes if we're viewing the same case
      if (caseId === targetCaseId) {
        await refreshNotes();
      }
      
      // DataManager handles file system persistence automatically
    } catch (err) {
      console.error('Failed to delete note:', err);
      const errorMsg = 'Failed to delete note. Please try again.';
      toast.error(errorMsg);
    }
  }, [dataManager, caseId, refreshNotes]);

  /**
   * Close the note form without saving
   */
  const closeNoteForm = useCallback(() => {
    setNoteForm({ isOpen: false });
  }, []);

  return {
    // Data
    notes,
    refreshNotes,

    // Form state
    noteForm,
    
    // Actions
    openAddNote,
    openEditNote,
    saveNote,
    addNote,
    updateNote,
    deleteNote,
    closeNoteForm,
  };
}