import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2, StickyNote } from "lucide-react";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import type { NewNoteData } from "@/types/case";

interface BulkNoteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Handler to close the modal */
  onClose: () => void;
  /** Handler to submit the bulk note */
  onSubmit: (noteData: NewNoteData) => Promise<void>;
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Number of cases that will receive the note */
  selectedCount: number;
}

/**
 * BulkNoteModal - Modal for adding an identical note to multiple cases
 * 
 * Provides a form with:
 * - Note content (required textarea)
 * - Category selection (required dropdown from user's configured categories)
 * - Confirmation with count of affected cases
 * 
 * @example
 * <BulkNoteModal
 *   isOpen={isModalOpen}
 *   onClose={closeModal}
 *   onSubmit={submitBulkNote}
 *   isSubmitting={isSubmitting}
 *   selectedCount={5}
 * />
 */
export function BulkNoteModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  selectedCount,
}: BulkNoteModalProps) {
  const { config } = useCategoryConfig();
  
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const noteCategories = useMemo(() => {
    return config?.noteCategories ?? ["General", "Important", "Follow Up", "Contact"];
  }, [config]);

  const defaultCategory = useMemo(() => {
    return noteCategories[0] ?? "General";
  }, [noteCategories]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const frameId = globalThis.requestAnimationFrame(() => {
        setContent("");
        setCategory(defaultCategory);
      });
      return () => globalThis.cancelAnimationFrame(frameId);
    }
  }, [isOpen, defaultCategory]);

  const isFormValid = useMemo(() => {
    return content.trim().length > 0 && category.length > 0;
  }, [content, category]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;
    
    await onSubmit({
      content: content.trim(),
      category,
    });
  }, [isFormValid, onSubmit, content, category]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && isFormValid && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isFormValid, isSubmitting]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Add Note to {selectedCount} Case{selectedCount === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            This note will be added to all selected cases with the same content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-note-category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
              <SelectTrigger id="bulk-note-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {noteCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-note-content">Note Content</Label>
            <Textarea
              id="bulk-note-content"
              placeholder="Enter note content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter (Cmd+Enter on Mac) to submit
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                Add Note to {selectedCount} Case{selectedCount === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
