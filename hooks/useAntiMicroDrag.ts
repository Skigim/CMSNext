import { useEffect } from "react";

/**
 * Prevents accidental text selection from micro-drags.
 * When the mouse is pressed, selection is temporarily disabled.
 * If the user moves the mouse beyond a small threshold, it is treated
 * as an intentional drag/selection and selection is re-enabled.
 */
export function useAntiMicroDrag(threshold = 5) {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isMouseDown = false;
    let isSelectionDisabled = false;

    // A style element to inject our disabling CSS
    const styleId = "anti-micro-drag-style";

    const disableSelection = () => {
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        // Apply strictly to body, but allow inputs/textareas
        style.innerHTML = `
          body {
            -webkit-user-select: none !important;
            user-select: none !important;
          }
          input, textarea, [contenteditable="true"] {
            -webkit-user-select: auto !important;
            user-select: auto !important;
          }
        `;
        document.head.appendChild(style);
        isSelectionDisabled = true;
      }
    };

    const enableSelection = () => {
      if (isSelectionDisabled) {
        const style = document.getElementById(styleId);
        if (style) {
          style.remove();
        }
        isSelectionDisabled = false;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      // Ignore right clicks or if the target is an input/textarea
      if (e.button !== 0) return;
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      startX = e.clientX;
      startY = e.clientY;
      isMouseDown = true;
      disableSelection();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || !isSelectionDisabled) return;

      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);

      if (deltaX > threshold || deltaY > threshold) {
        // User has dragged sufficiently, re-enable selection
        enableSelection();
      }
    };

    const onMouseUp = () => {
      isMouseDown = false;
      enableSelection();
    };

    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    window.addEventListener("dragend", onMouseUp, { passive: true });
    window.addEventListener("blur", onMouseUp, { passive: true });

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("dragend", onMouseUp);
      window.removeEventListener("blur", onMouseUp);
      enableSelection();
    };
  }, [threshold]);
}
