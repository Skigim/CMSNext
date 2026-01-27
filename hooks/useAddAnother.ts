/**
 * @fileoverview useAddAnother Hook
 * 
 * Provides reusable "Add Another" pattern for modals that create multiple items.
 * Used by QuickCaseModal and FinancialItemStepperModal.
 * 
 * Pattern:
 * - Component manages checkbox state externally
 * - Hook provides handlePostSave utility that either closes modal or resets form
 * - Component resets checkbox to false in its own reset logic
 * 
 * @module hooks/useAddAnother
 */

import { useCallback, RefObject } from "react";
import { toast } from "sonner";

export interface UseAddAnotherOptions {
  /** Current value of the "add another" checkbox (managed by component) */
  addAnother: boolean;
  /** Label for the item type being created (e.g., "item", "case") */
  itemLabel?: string;
  /** Callback to reset form to initial state (should also reset addAnother to false) */
  resetForm: () => void;
  /** Callback to close the modal */
  onClose: () => void;
}

export interface UseAddAnotherResult {
  /** 
   * Call this after a successful save operation.
   * If addAnother is true: resets form, focuses element, shows toast, keeps modal open.
   * If addAnother is false: closes modal.
   * @param focusRef - Optional ref to focus after reset
   */
  handlePostSave: <T extends HTMLElement>(focusRef?: RefObject<T>) => void;
  /** 
   * Returns true if modal should stay open (add another mode), false if it should close.
   */
  shouldKeepOpen: () => boolean;
}

/**
 * Hook for managing "Add Another" pattern in creation modals.
 * 
 * The component is responsible for:
 * - Managing the addAnother checkbox state
 * - Resetting addAnother to false when the form resets
 * 
 * The hook provides:
 * - handlePostSave: Call after save to either reset form or close modal
 * - shouldKeepOpen: Check if modal should stay open
 * 
 * @example
 * ```tsx
 * const [addAnother, setAddAnother] = useState(false);
 * 
 * const resetForm = useCallback(() => {
 *   setFormData(initialData);
 *   setAddAnother(false); // Reset checkbox on form reset
 * }, []);
 * 
 * const { handlePostSave } = useAddAnother({
 *   addAnother,
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
  addAnother,
  itemLabel = "item",
  resetForm,
  onClose,
}: UseAddAnotherOptions): UseAddAnotherResult {
  const shouldKeepOpen = useCallback(() => {
    return addAnother;
  }, [addAnother]);

  const handlePostSave = useCallback(
    <T extends HTMLElement>(focusRef?: RefObject<T>) => {
      if (addAnother) {
        // Reset form for another entry (component should reset addAnother in resetForm)
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
    handlePostSave,
    shouldKeepOpen,
  };
}
