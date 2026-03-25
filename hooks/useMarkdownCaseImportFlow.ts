import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  parseMarkdownCaseImport,
  type MarkdownCaseImportResult,
} from "@/domain/markdownImport";
import type { IntakeFormData } from "@/domain/validation/intake.schema";

const MARKDOWN_IMPORT_PARSE_DEBOUNCE_MS = 250;

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
  const [isOpen, setIsOpen] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [review, setReview] = useState<MarkdownCaseImportResult | null>(null);
  const [importDraft, setImportDraft] = useState<Partial<IntakeFormData> | null>(null);

  const openImportModal = useCallback(() => {
    setIsOpen(true);
    setRawInput("");
    setReview(null);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsOpen(false);
    setRawInput("");
    setReview(null);
  }, []);

  const handleInputChange = useCallback((input: string) => {
    setIsOpen(true);
    setRawInput(input);
    if (input.trim().length === 0) {
      setReview(null);
    }
  }, []);

  const clearInput = useCallback(() => {
    setRawInput("");
    setReview(null);
  }, []);

  const clearImportDraft = useCallback(() => {
    setImportDraft(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (rawInput.trim().length === 0) {
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setReview(parseMarkdownCaseImport(rawInput));
    }, MARKDOWN_IMPORT_PARSE_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [isOpen, rawInput]);

  const confirmImport = useCallback(() => {
    if (!review?.hasImportedData) {
      toast.error("No intake fields could be imported from that markdown.");
      return false;
    }

    setImportDraft(review.initialData);
    setIsOpen(false);
    setRawInput("");
    setReview(null);
    onStartIntake();
    return true;
  }, [onStartIntake, review]);

  const importState: MarkdownCaseImportState = {
    isOpen,
    rawInput,
    review,
  };

  return {
    importState,
    importDraft,
    openImportModal,
    closeImportModal,
    handleInputChange,
    clearInput,
    confirmImport,
    clearImportDraft,
    canConfirmImport: review?.hasImportedData ?? false,
  };
}
