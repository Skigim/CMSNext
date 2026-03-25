import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  parseMarkdownCaseImport,
  type MarkdownCaseImportResult,
} from "@/domain/markdownImport";
import type { IntakeFormData } from "@/domain/validation/intake.schema";

export interface MarkdownCaseImportState {
  isOpen: boolean;
  rawInput: string;
  review: MarkdownCaseImportResult | null;
}

interface UseMarkdownCaseImportFlowOptions {
  onStartIntake: () => void;
}

interface UseMarkdownCaseImportFlowResult {
  importState: MarkdownCaseImportState;
  importDraft: Partial<IntakeFormData> | null;
  openImportModal: () => void;
  closeImportModal: () => void;
  handleInputChange: (input: string) => void;
  clearInput: () => void;
  confirmImport: () => boolean;
  clearImportDraft: () => void;
  canConfirmImport: boolean;
}

export function useMarkdownCaseImportFlow({
  onStartIntake,
}: UseMarkdownCaseImportFlowOptions): UseMarkdownCaseImportFlowResult {
  const [importState, setImportState] = useState<MarkdownCaseImportState>({
    isOpen: false,
    rawInput: "",
    review: null,
  });
  const [importDraft, setImportDraft] = useState<Partial<IntakeFormData> | null>(null);

  const openImportModal = useCallback(() => {
    setImportState({
      isOpen: true,
      rawInput: "",
      review: null,
    });
  }, []);

  const closeImportModal = useCallback(() => {
    setImportState({
      isOpen: false,
      rawInput: "",
      review: null,
    });
  }, []);

  const handleInputChange = useCallback((input: string) => {
    setImportState({
      isOpen: true,
      rawInput: input,
      review: input.trim().length > 0 ? parseMarkdownCaseImport(input) : null,
    });
  }, []);

  const clearInput = useCallback(() => {
    setImportState((prev) => ({
      ...prev,
      rawInput: "",
      review: null,
    }));
  }, []);

  const clearImportDraft = useCallback(() => {
    setImportDraft(null);
  }, []);

  const confirmImport = useCallback(() => {
    if (!importState.review?.hasImportedData) {
      toast.error("No intake fields could be imported from that markdown.");
      return false;
    }

    setImportDraft(importState.review.initialData);
    setImportState({
      isOpen: false,
      rawInput: "",
      review: null,
    });
    onStartIntake();
    return true;
  }, [importState.review, onStartIntake]);

  return {
    importState,
    importDraft,
    openImportModal,
    closeImportModal,
    handleInputChange,
    clearInput,
    confirmImport,
    clearImportDraft,
    canConfirmImport: importState.review?.hasImportedData ?? false,
  };
}
