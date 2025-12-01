import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { NotesSection } from "./NotesSection";
import { StickyNote, ChevronUp, ChevronDown, X } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";

interface NotesDrawerProps {
  caseId: string;
  className?: string;
}

export function NotesDrawer({ caseId, className }: NotesDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previousCaseId, setPreviousCaseId] = useState(caseId);
  const { notes } = useNotes(caseId);

  const noteCount = useMemo(() => notes?.length ?? 0, [notes]);

  // Auto-minimize when case changes
  useEffect(() => {
    if (caseId !== previousCaseId) {
      setIsOpen(false);
      setPreviousCaseId(caseId);
    }
  }, [caseId, previousCaseId]);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out",
        className
      )}
      style={{
        transform: isOpen ? "translateY(0)" : "translateY(calc(100% - 48px))",
      }}
    >
      {/* Drawer Handle / Collapsed State */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2 bg-card border-t border-x rounded-t-lg cursor-pointer shadow-lg",
          "hover:bg-accent/50 transition-colors"
        )}
        onClick={toggleDrawer}
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            Notes{noteCount > 0 && ` (${noteCount})`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              toggleDrawer();
            }}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          {isOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                closeDrawer();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Drawer Content */}
      <div
        className={cn(
          "bg-card border-x border-b shadow-lg",
          "max-h-[50vh] overflow-hidden"
        )}
      >
        <div className="p-4 overflow-y-auto max-h-[calc(50vh-48px)]">
          <NotesSection caseId={caseId} />
        </div>
      </div>
    </div>
  );
}

export default NotesDrawer;
