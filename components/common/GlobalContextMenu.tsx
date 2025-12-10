"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Copy, ClipboardPaste, Scissors, RotateCcw, RotateCw } from "lucide-react";

interface GlobalContextMenuProps {
  children: ReactNode;
}

/**
 * Global context menu that provides standard browser-like actions.
 * Wrap around any content to enable right-click menu with Cut, Copy, Paste, etc.
 * 
 * Can be extended later to accept additional menu items for specific contexts.
 * 
 * @example
 * ```tsx
 * <GlobalContextMenu>
 *   <div>Right-click anywhere in here</div>
 * </GlobalContextMenu>
 * ```
 */
export function GlobalContextMenu({ children }: GlobalContextMenuProps) {
  const [hasSelection, setHasSelection] = useState(false);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Check if there's selected text when menu opens
      const selection = window.getSelection();
      setHasSelection(Boolean(selection && selection.toString().trim().length > 0));
    }
  }, []);

  const handleCut = useCallback(async () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      await navigator.clipboard.writeText(selection.toString());
      // Note: We can't actually delete the selection in non-editable content
      // This would work in contenteditable or input fields
      document.execCommand("cut");
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      await navigator.clipboard.writeText(selection.toString());
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Paste only works in editable contexts
      document.execCommand("insertText", false, text);
    } catch {
      // Clipboard read may be blocked by browser permissions
      console.warn("Clipboard read not available");
    }
  }, []);

  const handleUndo = useCallback(() => {
    document.execCommand("undo");
  }, []);

  const handleRedo = useCallback(() => {
    document.execCommand("redo");
  }, []);

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleUndo}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Undo
          <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRedo}>
          <RotateCw className="mr-2 h-4 w-4" />
          Redo
          <ContextMenuShortcut>⇧⌘Z</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCut} disabled={!hasSelection}>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy} disabled={!hasSelection}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste}>
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
