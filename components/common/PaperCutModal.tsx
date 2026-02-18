import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Kbd } from "@/components/ui/kbd";

interface PaperCutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: string;
  context: string;
  onSubmit: (content: string) => void;
}

export function PaperCutModal({
  open,
  onOpenChange,
  route,
  context,
  onSubmit,
}: PaperCutModalProps) {
  const [content, setContent] = useState("");

  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? navigator.userAgent ?? "");
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setContent("");
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report a Paper Cut</DialogTitle>
          <DialogDescription>
            Describe the friction or annoyance you just experienced.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Route:</span>
              <span className="font-mono">{route || "/"}</span>
            </div>
            {context && (
              <div className="flex justify-between">
                <span>Context:</span>
                <span className="font-mono">{context}</span>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feedback" className="sr-only">
              Feedback
            </Label>
            <Textarea
              id="feedback"
              placeholder="What's annoying you?"
              className="min-h-[100px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-right">
              Press <Kbd><span className="text-xs">{isMac ? "⌘" : "Ctrl"}</span>+Enter</Kbd> to submit
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!content.trim()}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
