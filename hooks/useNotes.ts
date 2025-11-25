import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { CaseDisplay, Note, NewNoteData, StoredNote } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';
import { useFileStorageDataChange } from '@/contexts/FileStorageContext';

interface NoteFormState {
  isOpen: boolean;
  editingNote?: Note;
  caseId?: string;
}

interface UseNotesReturn {
  // Data
  notes: StoredNote[];
  refreshNotes: () => Promise<void>;

  // Form state
  noteForm: NoteFormState;
  
  // Actions
  openAddNote: (caseId: string) => void;
  openEditNote: (caseId: string, note: Note) => void;
  saveNote: (noteData: NewNoteData) => Promise<StoredNote | null>;
  addNote: (caseId: string, noteData: NewNoteData) => Promise<StoredNote | null>;
  updateNote: (caseId: string, noteId: string, noteData: NewNoteData) => Promise<StoredNote | null>;
  deleteNote: (caseId: string, noteId: string) => Promise<void>;
  closeNoteForm: () => void;
}

/**
 * Secure notes management hook using DataManager only
 * 
 * Core Principles:
 * - Uses DataManager exclusively (no fileDataProvider fallback)
 * - File system is single source of truth
 * - No render-time data storage
 * - Automatic persistence through DataManager
 */
export function useNotes(caseId?: string): UseNotesReturn {
  const dataManager = useDataManagerSafe(); // Returns null if not available - safe fallback
  const dataChangeCount = useFileStorageDataChange();
  
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

  // Initial fetch and refresh on data change
  useEffect(() => {
    refreshNotes();
  }, [refreshNotes, dataChangeCount]);

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

    const isEditing = !!noteForm.editingNote;

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
    deleteNote,
    closeNoteForm,
  };
}