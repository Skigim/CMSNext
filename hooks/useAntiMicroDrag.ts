import { useEffect } from "react";

/**
 * Prevents accidental text selection from micro-drags (sloppy clicks).
 * Real text selections and double-click selections are preserved.
 */
export function useAntiMicroDrag(threshold = 5) {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isMouseDown = false;
    let hasMovedEnough = false;
    let clickCount = 0;

    const onMouseDown = (e: MouseEvent) => {
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
      hasMovedEnough = false;
      clickCount = e.detail;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || hasMovedEnough) return;

      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);

      if (deltaX > threshold || deltaY > threshold) {
        hasMovedEnough = true;
      }
    };

    const onSelectionChange = () => {
      // If we are dragging but haven't surpassed the sloppy-click threshold,
      // and it's not a double-click (which legitimately selects text instantly),
      // we immediately empty the selection before it paints.
      if (isMouseDown && !hasMovedEnough && clickCount < 2) {
        const selection = globalThis.getSelection();
        if (selection && !selection.isCollapsed) {
          selection.removeAllRanges();
        }
      }
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    globalThis.addEventListener("mousedown", onMouseDown, { passive: true });
    globalThis.addEventListener("mousemove", onMouseMove, { passive: true });
    globalThis.addEventListener("mouseup", onMouseUp, { passive: true });
    globalThis.addEventListener("dragend", onMouseUp, { passive: true });
    globalThis.addEventListener("blur", onMouseUp, { passive: true });
    globalThis.document.addEventListener("selectionchange", onSelectionChange, { passive: true });

    return () => {
      globalThis.removeEventListener("mousedown", onMouseDown);
      globalThis.removeEventListener("mousemove", onMouseMove);
      globalThis.removeEventListener("mouseup", onMouseUp);
      globalThis.removeEventListener("dragend", onMouseUp);
      globalThis.removeEventListener("blur", onMouseUp);
      globalThis.document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [threshold]);
}
