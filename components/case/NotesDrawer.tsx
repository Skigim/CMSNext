import { useEffect, useState, useMemo } from "react";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { NotesSection } from "./NotesSection";
import { StickyNote } from "lucide-react";
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

  // Auto-close when case changes
  useEffect(() => {
    if (caseId !== previousCaseId) {
      setIsOpen(false);
      setPreviousCaseId(caseId);
    }
  }, [caseId, previousCaseId]);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      {/* Fixed trigger button at bottom of screen */}
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          className={`fixed bottom-4 right-4 z-40 gap-2 shadow-lg ${className ?? ""}`}
        >
          <StickyNote className="h-4 w-4" />
          <span>Notes{noteCount > 0 ? ` (${noteCount})` : ""}</span>
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes {noteCount > 0 && `(${noteCount})`}
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto flex-1 p-4">
          <NotesSection caseId={caseId} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default NotesDrawer;
