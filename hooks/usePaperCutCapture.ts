import { useCallback, useState } from "react";
import { addPaperCut } from "@/utils/paperCutStorage";

interface UsePaperCutCaptureResult {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  submitPaperCut: (content: string) => void;
  currentContext: string;
  currentRoute: string;
}

function getCurrentRoute(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

function getNearestContext(): string {
  if (typeof document === "undefined") return "";

  const start = document.activeElement;
  if (!start || !(start instanceof HTMLElement)) return "";

  const el = start.closest<HTMLElement>("[data-papercut-context]");
  const ctx = el?.getAttribute("data-papercut-context");
  return ctx ?? "";
}

export function usePaperCutCapture(): UsePaperCutCaptureResult {
  const [isOpen, setIsOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState("");
  const [currentRoute, setCurrentRoute] = useState("");

  const openModal = useCallback(() => {
    setCurrentRoute(getCurrentRoute());
    setCurrentContext(getNearestContext());
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const submitPaperCut = useCallback((content: string) => {
    const route = currentRoute || getCurrentRoute();
    const context = currentContext || getNearestContext();

    addPaperCut(content, route, context);
    setIsOpen(false);
  }, [currentContext, currentRoute]);

  return { isOpen, openModal, closeModal, submitPaperCut, currentContext, currentRoute };
}
