import { useCallback, useState } from "react";
import { addPaperCut } from "@/utils/paperCutStorage";

interface UsePaperCutCaptureResult {
  isOpen: boolean;
  /** Increments on every openModal() call. Use as a `key` prop to reset modal state. */
  openCount: number;
  openModal: () => void;
  closeModal: () => void;
  submitPaperCut: (content: string) => void;
  currentContext: string;
  currentRoute: string;
}

function getCurrentRoute(): string {
  if (typeof window === "undefined") return "";
  return globalThis.location.pathname;
}

function getNearestContext(): string {
  if (typeof document === "undefined") return "";

  // Try from active element first (button click / focused-element scenario)
  const start = document.activeElement;
  if (start instanceof HTMLElement) {
    const el = start.closest<HTMLElement>("[data-papercut-context]");
    if (el) return el.getAttribute("data-papercut-context") ?? "";

    // Fallback: scan the DOM for the first visible [data-papercut-context] element.
    // This handles the global hotkey scenario where focus is on document.body or
    // another element outside any context container.
    const all = Array.from(document.querySelectorAll<HTMLElement>("[data-papercut-context]"));
    const visible = all.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < globalThis.innerHeight &&
        rect.bottom > 0 &&
        rect.left < globalThis.innerWidth &&
        rect.right > 0
      );
    });
    return visible?.getAttribute("data-papercut-context") ?? "";
  }

  return "";
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
  const [openCount, setOpenCount] = useState(0);
  const [currentContext, setCurrentContext] = useState("");
  const [currentRoute, setCurrentRoute] = useState("");

  const openModal = useCallback(() => {
    setCurrentRoute(getCurrentRoute());
    setCurrentContext(getNearestContext());
    setOpenCount((c) => c + 1);
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

  return { isOpen, openCount, openModal, closeModal, submitPaperCut, currentContext, currentRoute };
}
