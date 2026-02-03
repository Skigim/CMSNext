import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDataManagerSafe } from "../contexts/DataManagerContext";
import type { NewNoteData } from "../types/case";
import { createLogger } from "@/utils/logger";
import { extractErrorMessage } from "@/utils/errorUtils";

const logger = createLogger("useBulkNoteFlow");

interface UseBulkNoteFlowParams {
  /** Array of case IDs that are selected for bulk note addition */
  selectedCaseIds: string[];
  /** Callback to clear selection after successful operation */
  onSuccess?: () => void;
}

interface UseBulkNoteFlowResult {
  /** Whether the bulk note modal is open */
  isModalOpen: boolean;
  /** Open the bulk note modal */
  openModal: () => void;
  /** Close the bulk note modal */
  closeModal: () => void;
  /** Whether the bulk note operation is in progress */
  isSubmitting: boolean;
  /** Submit the bulk note to all selected cases */
  submitBulkNote: (noteData: NewNoteData) => Promise<void>;
}

/**
 * Hook for managing bulk note addition workflow
 * 
 * Handles modal state and submission logic for adding an identical note
 * to multiple selected cases.
 * 
 * **Operations:**
 * - `openModal()`: Open the bulk note modal
 * - `closeModal()`: Close the modal without submitting
 * - `submitBulkNote(data)`: Add note to all selected cases
 * 
 * **Error Handling:**
 * - Requires dataManager (shows toast if unavailable)
 * - Shows success toast with count of notes added
 * - Shows error toast on failure
 * 
 * **Usage Example:**
 * ```typescript
 * const bulkNoteFlow = useBulkNoteFlow({
 *   selectedCaseIds: ['case1', 'case2', 'case3'],
 *   onSuccess: () => clearSelection()
 * });
 * 
 * // In toolbar button
 * <Button onClick={bulkNoteFlow.openModal}>Add Note</Button>
 * 
 * // In modal
 * <BulkNoteModal
 *   isOpen={bulkNoteFlow.isModalOpen}
 *   onClose={bulkNoteFlow.closeModal}
 *   onSubmit={bulkNoteFlow.submitBulkNote}
 *   isSubmitting={bulkNoteFlow.isSubmitting}
 *   selectedCount={selectedCaseIds.length}
 * />
 * ```
 * 
 * @param {UseBulkNoteFlowParams} params
 *   - `selectedCaseIds`: IDs of cases to add notes to
 *   - `onSuccess`: Optional callback after successful submission
 * 
 * @returns {UseBulkNoteFlowResult} Modal state and submission handlers
 */
export function useBulkNoteFlow({
  selectedCaseIds,
  onSuccess,
}: UseBulkNoteFlowParams): UseBulkNoteFlowResult {
  const dataManager = useDataManagerSafe();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModal = useCallback(() => {
    if (selectedCaseIds.length === 0) {
      return;
    }
    setIsModalOpen(true);
  }, [selectedCaseIds.length]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const submitBulkNote = useCallback(
    async (noteData: NewNoteData) => {
      if (!dataManager) {
        toast.error("Data storage is not available. Please check your connection.");
        return;
      }

      if (selectedCaseIds.length === 0) {
        toast.error("No cases selected.");
        return;
      }

      if (!noteData.content.trim()) {
        toast.error("Note content cannot be empty.");
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await dataManager.addNoteToCases(selectedCaseIds, noteData);
        
        setIsModalOpen(false);
        toast.success(`Added note to ${result.addedCount} case${result.addedCount === 1 ? '' : 's'}`);
        onSuccess?.();
      } catch (error) {
        logger.error("Failed to add bulk notes", { error: extractErrorMessage(error) });
        toast.error("Failed to add notes. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [dataManager, selectedCaseIds, onSuccess],
  );

  return {
    isModalOpen,
    openModal,
    closeModal,
    isSubmitting,
    submitBulkNote,
  };
}
