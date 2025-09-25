import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { CaseDisplay } from "../../types/case";
import { Button } from "../ui/button";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedCases: CaseDisplay[]) => void;
}

export function ImportModal({ isOpen, onClose }: Omit<ImportModalProps, 'onImportComplete'>) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Legacy Data</DialogTitle>
          <DialogDescription>
            Import functionality needs to be implemented with DataManager.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            JSON import functionality will be reimplemented to use the DataManager architecture.
          </p>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}