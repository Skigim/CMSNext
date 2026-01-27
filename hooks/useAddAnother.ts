/**
 * @fileoverview useAddAnother Hook
 * 
 * Provides reusable "Add Another" pattern for modals that create multiple items.
 * Used by QuickCaseModal and FinancialItemStepperModal.
 * 
 * Pattern:
 * - Checkbox state to indicate user wants to add another after saving
 * - Reset callback on modal open
 * - Post-save handler that either closes modal or resets form for next entry
 * 
 * @module hooks/useAddAnother
 */

import { useState, useCallback, useEffect, RefObject } from "react";
import { toast } from "sonner";

export interface UseAddAnotherOptions {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Label for the item type being created (e.g., "item", "case") */
  itemLabel?: string;
  /** Callback to reset form to initial state */
  resetForm: () => void;
  /** Callback to close the modal */
  onClose: () => void;
}

export interface UseAddAnotherResult {
  /** Current state of the "add another" checkbox */
  addAnother: boolean;
  /** Toggle handler for the checkbox */
  setAddAnother: (checked: boolean) => void;
  /** 
   * Call this after a successful save operation.
   * If addAnother is true: resets form, focuses element, shows toast, keeps modal open.
   * If addAnother is false: closes modal.
   * @param focusRef - Optional ref to focus after reset
   */
  handlePostSave: <T extends HTMLElement>(focusRef?: RefObject<T>) => void;
  /** 
   * Wrapper that handles the post-save logic with optional focus.
   * Returns true if modal should stay open (add another mode), false if it should close.
   */
  shouldKeepOpen: () => boolean;
}

/**
 * Hook for managing "Add Another" pattern in creation modals.
 * 
 * @example
 * ```tsx
 * const { addAnother, setAddAnother, handlePostSave } = useAddAnother({
 *   isOpen,
 *   itemLabel: "item",
 *   resetForm,
 *   onClose,
 * });
 * 
 * // In form submit handler:
 * await saveItem();
 * handlePostSave(inputRef);
 * ```
 */
export function useAddAnother({
  isOpen,
  itemLabel = "item",
  resetForm,
  onClose,
}: UseAddAnotherOptions): UseAddAnotherResult {
  const [addAnother, setAddAnother] = useState(false);

  // Reset addAnother when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddAnother(false);
    }
  }, [isOpen]);

  const shouldKeepOpen = useCallback(() => {
    return addAnother;
  }, [addAnother]);

  const handlePostSave = useCallback(
    <T extends HTMLElement>(focusRef?: RefObject<T>) => {
      if (addAnother) {
        // Reset form for another entry
        resetForm();
        // Show feedback toast
        toast.info(`Ready to add another ${itemLabel}`);
        // Focus input for faster data entry
        if (focusRef?.current) {
          setTimeout(() => focusRef.current?.focus(), 0);
        }
      } else {
        // Close modal
        onClose();
      }
    },
    [addAnother, resetForm, onClose, itemLabel]
  );

  return {
    addAnother,
    setAddAnother,
    handlePostSave,
    shouldKeepOpen,
  };
}
