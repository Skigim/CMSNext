import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { JsonUploader } from "./JsonUploader";
import { CaseDisplay } from "../types/case";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedCases: CaseDisplay[]) => void;
}

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const handleImportComplete = (importedCases: CaseDisplay[]) => {
    onImportComplete(importedCases);
    // Keep modal open to show results - user can close manually
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Legacy Data</DialogTitle>
          <DialogDescription>
            Upload JSON files to import existing case data into the system. Supports both single cases and arrays of cases with flexible field mapping.
          </DialogDescription>
        </DialogHeader>
        <JsonUploader 
          onImportComplete={handleImportComplete}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}