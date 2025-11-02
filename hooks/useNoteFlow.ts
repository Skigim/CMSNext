import { useCallback } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import ApplicationState from "@/application/ApplicationState";
import type { CaseDisplay, NewNoteData } from "../types/case";
import { useNotes } from "./useNotes";

interface UseNoteFlowParams {
  selectedCase: CaseDisplay | null;
  cases: CaseDisplay[];
}

interface UseNoteFlowResult {
  noteForm: ReturnType<typeof useNotes>["noteForm"];
  handleAddNote: () => void;
  handleEditNote: (noteId: string) => void;
  handleDeleteNote: (noteId: string) => Promise<void>;
  handleSaveNote: (noteData: NewNoteData) => Promise<void>;
  handleCancelNoteForm: () => void;
  handleBatchUpdateNote: (noteId: string, updatedNote: NewNoteData) => Promise<void>;
  handleBatchCreateNote: (noteData: NewNoteData) => Promise<void>;
}

export function useNoteFlow({
  selectedCase,
  cases,
}: UseNoteFlowParams): UseNoteFlowResult {
  const dataManager = useDataManagerSafe();
  const { noteForm, openAddNote, openEditNote, saveNote, deleteNote, closeNoteForm } = useNotes();

  const handleAddNote = useCallback(() => {
    if (!selectedCase) {
      return;
    }
    openAddNote(selectedCase.id);
  }, [openAddNote, selectedCase]);

  const handleEditNote = useCallback(
    (noteId: string) => {
      if (!selectedCase) {
        return;
      }
      openEditNote(selectedCase.id, noteId, cases);
    },
    [cases, openEditNote, selectedCase],
  );

  const handleSaveNote = useCallback(
    async (noteData: NewNoteData) => {
      try {
        const updatedCase = await saveNote(noteData);
        if (updatedCase) {
          const appState = ApplicationState.getInstance();
          appState.upsertCaseFromLegacy(updatedCase);
          appState.setCasesError(null);
        }
      } catch (err) {
        console.error("[NoteFlow] Failed to save note:", err);
        throw err;
      }
    },
    [saveNote],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!selectedCase) {
        return;
      }

      try {
        const updatedCase = await deleteNote(selectedCase.id, noteId);
        if (updatedCase) {
          const appState = ApplicationState.getInstance();
          appState.upsertCaseFromLegacy(updatedCase);
          appState.setCasesError(null);
        }
      } catch (err) {
        console.error("[NoteFlow] Failed to delete note:", err);
      }
    },
    [deleteNote, selectedCase],
  );

  const handleBatchUpdateNote = useCallback(
    async (noteId: string, updatedNote: NewNoteData) => {
      if (!selectedCase || !dataManager) {
        if (!dataManager) {
          const errorMsg = "Data storage is not available. Please check your connection.";
          ApplicationState.getInstance().setCasesError(errorMsg);
          toast.error(errorMsg);
        }
        return;
      }

      try {
        const appState = ApplicationState.getInstance();
        appState.setCasesError(null);
        const updatedCase = await dataManager.updateNote(selectedCase.id, noteId, updatedNote);
        appState.upsertCaseFromLegacy(updatedCase);
        toast.success("Note updated successfully", { duration: 2000 });
      } catch (err) {
        console.error("[NoteFlow] Failed to update note:", err);

        let errorMsg = "Failed to update note. Please try again.";
        if (err instanceof Error) {
          if (err.message.includes("File was modified by another process")) {
            errorMsg = "File was modified by another process. Your changes were not saved. Please refresh and try again.";
          } else if (err.message.includes("Permission denied")) {
            errorMsg = "Permission denied. Please check that you have write access to the data folder.";
          } else if (
            err.message.includes("state cached in an interface object") ||
            err.message.includes("state had changed")
          ) {
            errorMsg = "Data sync issue detected. Please refresh the page and try again.";
          }
        }

        ApplicationState.getInstance().setCasesError(errorMsg);
        toast.error(errorMsg, { duration: 5000 });
        throw err;
      }
    },
    [dataManager, selectedCase],
  );

  const handleBatchCreateNote = useCallback(
    async (noteData: NewNoteData) => {
      if (!selectedCase || !dataManager) {
        if (!dataManager) {
          const errorMsg = "Data storage is not available. Please check your connection.";
          ApplicationState.getInstance().setCasesError(errorMsg);
          toast.error(errorMsg);
        }
        return;
      }

      try {
        const appState = ApplicationState.getInstance();
        appState.setCasesError(null);
        const updatedCase = await dataManager.addNote(selectedCase.id, noteData);
        appState.upsertCaseFromLegacy(updatedCase);
        toast.success("Note added successfully", { duration: 2000 });
      } catch (err) {
        console.error("[NoteFlow] Failed to create note:", err);

        let errorMsg = "Failed to create note. Please try again.";
        if (err instanceof Error) {
          if (err.message.includes("File was modified by another process")) {
            errorMsg = "File was modified by another process. Your note was not saved. Please refresh and try again.";
          } else if (err.message.includes("Permission denied")) {
            errorMsg = "Permission denied. Please check that you have write access to the data folder.";
          } else if (
            err.message.includes("state cached in an interface object") ||
            err.message.includes("state had changed")
          ) {
            errorMsg = "Data sync issue detected. Please refresh the page and try again.";
          }
        }

        ApplicationState.getInstance().setCasesError(errorMsg);
        toast.error(errorMsg, { duration: 5000 });
        throw err;
      }
    },
    [dataManager, selectedCase],
  );

  const handleCancelNoteForm = useCallback(() => {
    closeNoteForm();
  }, [closeNoteForm]);

  return {
    noteForm,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
    handleSaveNote,
    handleCancelNoteForm,
    handleBatchUpdateNote,
    handleBatchCreateNote,
  };
}
