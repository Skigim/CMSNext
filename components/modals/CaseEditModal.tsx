import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Save, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { StoredCase, NewPersonData, NewCaseRecordData, Relationship, CaseStatus } from "../../types/case";
import { PersonColumn } from "../case/PersonColumn";
import { CaseColumn } from "../case/CaseColumn";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { createCaseRecordData, createPersonData } from "@/domain/cases";
import { ScrollArea } from "../ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface CaseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: StoredCase;
  onSave: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
}

/**
 * CaseEditModal - Modal dialog for editing case details with 2-column grid layout
 * 
 * Features:
 * - Clean 2-column responsive grid (PersonColumn | CaseColumn)
 * - Modal-based editing flow (open → edit → save/cancel → close)
 * - Unsaved changes protection with confirmation dialog
 * - Field-level validation
 * - Toast notifications for save success/failure
 */
export function CaseEditModal({ isOpen, onClose, caseData, onSave }: CaseEditModalProps) {
  const { config } = useCategoryConfig();

  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Defaults from config
  const defaultLivingArrangement = useMemo(
    () => config.livingArrangements[0] ?? "",
    [config.livingArrangements],
  );
  const defaultCaseStatus = useMemo(
    () => (config.caseStatuses[0]?.name ?? "Pending") as CaseStatus,
    [config.caseStatuses],
  );

  // Form state - initialized from caseData using centralized factories
  const [personData, setPersonData] = useState<NewPersonData>(() => 
    createPersonData(caseData, { livingArrangement: defaultLivingArrangement })
  );
  const [caseRecordData, setCaseRecordData] = useState<NewCaseRecordData>(() => 
    createCaseRecordData(caseData, { 
      livingArrangement: defaultLivingArrangement, 
      caseStatus: defaultCaseStatus 
    })
  );
  const [relationships, setRelationships] = useState<Relationship[]>(caseData.person.relationships || []);
  const [retroRequested, setRetroRequested] = useState<boolean>(!!caseData.caseRecord.retroRequested);

  // Track if form has changes
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form state when modal opens with new caseData
  useEffect(() => {
    if (isOpen) {
      setPersonData(createPersonData(caseData, { livingArrangement: defaultLivingArrangement }));
      setCaseRecordData(createCaseRecordData(caseData, { 
        livingArrangement: defaultLivingArrangement, 
        caseStatus: defaultCaseStatus 
      }));
      setRelationships(caseData.person.relationships || []);
      setRetroRequested(!!caseData.caseRecord.retroRequested);
      setHasChanges(false);
    }
  }, [isOpen, caseData, defaultLivingArrangement, defaultCaseStatus]);

  // Sync mailing address when "same as physical" is checked
  useEffect(() => {
    if (personData.mailingAddress.sameAsPhysical) {
      setPersonData(prev => ({
        ...prev,
        mailingAddress: {
          ...prev.address,
          sameAsPhysical: true,
        },
      }));
    }
  }, [personData.address, personData.mailingAddress.sameAsPhysical]);

  const handlePersonDataChange = useCallback((field: keyof NewPersonData, value: unknown) => {
    setPersonData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleAddressChange = useCallback((field: keyof NewPersonData['address'], value: string) => {
    setPersonData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
    setHasChanges(true);
  }, []);

  const handleMailingAddressChange = useCallback(
    (field: keyof NewPersonData['mailingAddress'], value: string | boolean) => {
      setPersonData(prev => ({
        ...prev,
        mailingAddress: { ...prev.mailingAddress, [field]: value },
      }));
      setHasChanges(true);
    },
    [],
  );

  const handleCaseDataChange = useCallback((field: keyof NewCaseRecordData, value: unknown) => {
    setCaseRecordData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleRetroRequestedChange = useCallback((value: boolean) => {
    setRetroRequested(value);
    setHasChanges(true);
  }, []);

  const relationshipsHandlers = useMemo(
    () => ({
      add: () => {
        setRelationships(prev => [...prev, { type: '', name: '', phone: '' }]);
        setHasChanges(true);
      },
      update: (index: number, field: keyof Relationship, value: string) => {
        setRelationships(prev =>
          prev.map((rel, i) => (i === index ? { ...rel, [field]: value } : rel)),
        );
        setHasChanges(true);
      },
      remove: (index: number) => {
        setRelationships(prev => prev.filter((_, i) => i !== index));
        setHasChanges(true);
      },
    }),
    [],
  );

  const isFormValid = useCallback((): boolean => {
    if (!personData.firstName?.trim() || !personData.lastName?.trim()) {
      toast.error("First name and last name are required");
      return false;
    }
    return true;
  }, [personData.firstName, personData.lastName]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const handleDiscardChanges = useCallback(() => {
    setShowDiscardDialog(false);
    setHasChanges(false);
    onClose();
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!isFormValid()) return;

    setIsSaving(true);

    try {
      await onSave({
        person: {
          ...personData,
          relationships: relationships.filter(rel => rel.name.trim() !== ''),
        },
        caseRecord: {
          ...caseRecordData,
          retroRequested: retroRequested ? 'Yes' : '',
        }
      });

      setHasChanges(false);
      toast.success("Case updated successfully");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes"
      );
    } finally {
      setIsSaving(false);
    }
  }, [isFormValid, onSave, personData, relationships, caseRecordData, retroRequested, onClose]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-7xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl">
                  Edit Case: {personData.firstName} {personData.lastName}
                </DialogTitle>
                {hasChanges && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Unsaved changes
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="py-4">
              {/* 2-Column Responsive Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PersonColumn
                  personData={personData}
                  caseData={caseRecordData}
                  relationships={relationships}
                  isEditing={true}
                  onPersonDataChange={handlePersonDataChange}
                  onCaseDataChange={handleCaseDataChange}
                  onRelationshipsChange={relationshipsHandlers}
                />
                <CaseColumn
                  caseData={caseRecordData}
                  retroRequested={retroRequested}
                  isEditing={true}
                  onCaseDataChange={handleCaseDataChange}
                  onRetroRequestedChange={handleRetroRequestedChange}
                  address={personData.address}
                  mailingAddress={personData.mailingAddress}
                  onAddressChange={handleAddressChange}
                  onMailingAddressChange={handleMailingAddressChange}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !isFormValid()}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard Changes Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
