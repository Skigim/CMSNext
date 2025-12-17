import { useCallback, useEffect, useMemo, useState } from "react";
import { addPaperCut } from "@/utils/paperCutStorage";

interface UsePaperCutCaptureResult {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  submitPaperCut: (content: string) => void;
  currentContext: string;
  currentRoute: string;
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as any).platform ?? "";
  const userAgent = navigator.userAgent ?? "";
  return /Mac|iPhone|iPad|iPod/i.test(String(platform)) || /Mac|iPhone|iPad|iPod/i.test(userAgent);
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

  const isMac = useMemo(() => isMacPlatform(), []);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat) return;

      const key = event.key?.toLowerCase();
      if (key !== "b") return;

      const isHotkey = isMac ? event.metaKey : event.ctrlKey;
      if (!isHotkey) return;
      if (event.altKey) return;

      event.preventDefault();
      openModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMac, openModal]);

  return { isOpen, openModal, closeModal, submitPaperCut, currentContext, currentRoute };
}
