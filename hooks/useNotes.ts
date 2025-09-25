import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { CaseDisplay, Note, NewNoteData } from '@/types/case';
import { useDataManagerSafe } from '@/contexts/DataManagerContext';

interface NoteFormState {
  isOpen: boolean;
  editingNote?: Note;
  caseId?: string;
}

interface UseNotesReturn {
  // Form state
  noteForm: NoteFormState;
  
  // Actions
  openAddNote: (caseId: string) => void;
  openEditNote: (caseId: string, noteId: string, cases: CaseDisplay[]) => void;
  saveNote: (noteData: NewNoteData) => Promise<CaseDisplay | null>;
  deleteNote: (caseId: string, noteId: string) => Promise<CaseDisplay | null>;
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
export function useNotes(): UseNotesReturn {
  const dataManager = useDataManagerSafe(); // Returns null if not available - safe fallback
  
  const [noteForm, setNoteForm] = useState<NoteFormState>({ isOpen: false });

  /**
   * Open form to add a new note to a case
   */
  const openAddNote = useCallback((caseId: string) => {
    setNoteForm({
      isOpen: true,
      caseId
    });
  }, []);

  /**
   * Open form to edit an existing note
   */
  const openEditNote = useCallback((caseId: string, noteId: string, cases: CaseDisplay[]) => {
    const selectedCase = cases.find(c => c.id === caseId);
    if (!selectedCase) {
      toast.error('Case not found');
      return;
    }
    
    const note = selectedCase.caseRecord.notes?.find(n => n.id === noteId);
    if (!note) {
      toast.error('Note not found');
      return;
    }
    
    setNoteForm({
      isOpen: true,
      editingNote: note,
      caseId
    });
  }, []);

  /**
   * Save (create or update) a note
   */
  const saveNote = useCallback(async (noteData: NewNoteData): Promise<CaseDisplay | null> => {
    if (!noteForm.caseId) {
      toast.error('No case selected for note');
      return null;
    }

    if (!dataManager) {
      toast.error('Data storage is not available. Please connect to a folder first.');
      return null;
    }

    const isEditing = !!noteForm.editingNote;

    try {
      let updatedCase: CaseDisplay;
      
      if (noteForm.editingNote) {
        // Update existing note
        updatedCase = await dataManager.updateNote(noteForm.caseId, noteForm.editingNote.id, noteData);
        toast.success("Note updated successfully");
      } else {
        // Add new note
        updatedCase = await dataManager.addNote(noteForm.caseId, noteData);
        toast.success("Note added successfully");
      }
      
      // Close the form on success
      setNoteForm({ isOpen: false });
      
      // DataManager handles file system persistence automatically
      return updatedCase;
    } catch (err) {
      console.error('Failed to save note:', err);
      const errorMsg = `Failed to ${isEditing ? 'update' : 'add'} note. Please try again.`;
      toast.error(errorMsg);
      return null;
    }
  }, [dataManager, noteForm.caseId, noteForm.editingNote]);

  /**
   * Delete a note by ID
   */
  const deleteNote = useCallback(async (caseId: string, noteId: string): Promise<CaseDisplay | null> => {
    if (!dataManager) {
      toast.error('Data storage is not available. Please connect to a folder first.');
      return null;
    }

    try {
      const updatedCase = await dataManager.deleteNote(caseId, noteId);
      
      toast.success("Note deleted successfully");
      
      // DataManager handles file system persistence automatically
      return updatedCase;
    } catch (err) {
      console.error('Failed to delete note:', err);
      const errorMsg = 'Failed to delete note. Please try again.';
      toast.error(errorMsg);
      return null;
    }
  }, [dataManager]);

  /**
   * Close the note form without saving
   */
  const closeNoteForm = useCallback(() => {
    setNoteForm({ isOpen: false });
  }, []);

  return {
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