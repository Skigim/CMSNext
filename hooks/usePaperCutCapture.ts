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

/**
 * Hook for capturing and storing \"paper cuts\" (small UX pain points)
 * 
 * Collects user feedback about UI/UX friction through modal form.
 * Captures: user input, current route, and HTML data-attribute context.
 * Persists to localStorage for later analysis.
 * 
 * **Features:**
 * - Modal form for structured feedback
 * - Automatic route detection (location.pathname)
 * - Automatic context detection (data-papercut-context attribute)
 * - Session persistence to localStorage
 * - User-friendly submission with modal close on success
 * 
 * **Context Detection:**
 * Searches DOM for nearest ancestor element with `data-papercut-context` attribute:
 * ```html
 * <section data-papercut-context=\"case-form\">\n *   <!-- Paper cut captured from form context -->
 * </section>\n * ```
 * 
 * **Data Storage:**
 * Stored in localStorage under internal structure managed by addPaperCut().
 * Example captured data:
 * ```json\n * {\n *   \"content\": \"Save button takes too long\",\n *   \"route\": \"/cases/123\",\n *   \"context\": \"case-form\",\n *   \"timestamp\": \"2024-01-15T10:30:00Z\"\n * }\n * ```
 * 
 * **Usage Example:**
 * ```typescript
 * const papercut = usePaperCutCapture();\n * 
 * <button onClick={papercut.openModal}>Report Issue</button>\n * 
 * {papercut.isOpen && (\n *   <PaperCutModal\n *     isOpen={papercut.isOpen}\n *     onClose={papercut.closeModal}\n *     onSubmit={papercut.submitPaperCut}\n *     context={papercut.currentContext}\n *     route={papercut.currentRoute}\n *   />\n * )}\n * ```
 * 
 * **Special Attributes:**
 * Wrap interactive components with data-papercut-context:
 * ```html
 * <div data-papercut-context=\"form-validation\">\n *   <form>...</form>\n * </div>\n * ```
 * 
 * @returns {UsePaperCutCaptureResult} Modal state and submission handlers
 */
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
