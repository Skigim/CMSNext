import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { NewPersonData, NewCaseRecordData, CaseStatus } from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { isoToDateInputValue, dateInputValueToISO, toLocalDateString } from "@/domain/common";

interface QuickCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
}

// Helper function to get today's date in YYYY-MM-DD format (timezone-safe)
const getTodayDate = () => toLocalDateString();

/**
 * QuickCaseModal - Minimal dialog for quick case creation
 * 
 * Only 4 essential fields:
 * - First Name (required)
 * - Last Name (required)
 * - MCN (required)
 * - Application Date (required, defaults to today)
 * 
 * All other fields use defaults and can be edited later via CaseIntakeScreen.
 */
export function QuickCaseModal({ isOpen, onClose, onSave }: QuickCaseModalProps) {
  const { config } = useCategoryConfig();

  // Defaults from config
  const defaultCaseType = useMemo(() => config.caseTypes[0] ?? "", [config.caseTypes]);
  const defaultCaseStatus = useMemo(
    () => "Intake" as CaseStatus,
    [],
  );
  const defaultLivingArrangement = useMemo(
    () => config.livingArrangements[0] ?? "",
    [config.livingArrangements],
  );

  // Form state - minimal fields only
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mcn, setMcn] = useState("");
  const [applicationDate, setApplicationDate] = useState(getTodayDate());
  const [isSaving, setIsSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);

  // Ref for first name input to focus after reset
  const firstNameRef = useRef<HTMLInputElement>(null);

  // Reset addAnother when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddAnother(false);
    }
  }, [isOpen]);

  // Reset form fields to initial state
  const resetForm = useCallback(() => {
    setFirstName("");
    setLastName("");
    setMcn("");
    setApplicationDate(getTodayDate());
  }, []);

  // Reset form and close modal
  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // Validation
  const isFormValid = useCallback(() => {
    return (
      firstName.trim() !== '' &&
      lastName.trim() !== '' &&
      mcn.trim() !== '' &&
      applicationDate !== ''
    );
  }, [firstName, lastName, mcn, applicationDate]);

  // Submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Creating case...");

    try {
      // Build full case data with defaults
      const personData: NewPersonData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: '',
        phone: '',
        dateOfBirth: '',
        ssn: '',
        organizationId: null,
        livingArrangement: defaultLivingArrangement,
        address: {
          street: '',
          city: '',
          state: 'NE',
          zip: '',
        },
        mailingAddress: {
          street: '',
          city: '',
          state: 'NE',
          zip: '',
          sameAsPhysical: true,
        },
        authorizedRepIds: [],
        familyMembers: [],
        relationships: [],
        status: 'Active',
      };

      const caseRecordData: NewCaseRecordData = {
        mcn: mcn.trim(),
        applicationDate: applicationDate,
        caseType: defaultCaseType,
        personId: '',
        spouseId: '',
        status: defaultCaseStatus,
        description: '',
        priority: false,
        livingArrangement: defaultLivingArrangement,
        withWaiver: false,
        admissionDate: '',
        organizationId: '',
        authorizedReps: [],
        retroRequested: '',
        // Intake checklist defaults
        appValidated: false,
        retroMonths: [],
        contactMethods: [],
        agedDisabledVerified: false,
        citizenshipVerified: false,
        residencyVerified: false,
        avsSubmitted: false,
        interfacesReviewed: false,
        reviewVRs: false,
        reviewPriorBudgets: false,
        reviewPriorNarr: false,
        pregnancy: false,
        avsConsentDate: '',
        maritalStatus: '',
        voterFormStatus: '',
      };

      await onSave({ person: personData, caseRecord: caseRecordData });

      toast.success(`Case created for ${firstName} ${lastName}`, { id: toastId });

      if (addAnother) {
        // Reset form for another case entry
        resetForm();
        // Focus first name input for faster data entry
        setTimeout(() => firstNameRef.current?.focus(), 0);
      } else {
        handleClose();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create case",
        { id: toastId }
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    isFormValid,
    firstName,
    lastName,
    mcn,
    applicationDate,
    defaultCaseType,
    defaultCaseStatus,
    defaultLivingArrangement,
    onSave,
    handleClose,
    addAnother,
    resetForm,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              New Case
            </DialogTitle>
            <DialogDescription>
              Enter the basic information to create a new case. You can add more details after.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quickFirstName">First Name *</Label>
                <Input
                  ref={firstNameRef}
                  id="quickFirstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  autoFocus
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quickLastName">Last Name *</Label>
                <Input
                  id="quickLastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quickMcn">MCN *</Label>
                <Input
                  id="quickMcn"
                  value={mcn}
                  onChange={(e) => setMcn(e.target.value)}
                  placeholder="Enter MCN"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quickApplicationDate">Application Date *</Label>
                <Input
                  id="quickApplicationDate"
                  type="date"
                  value={isoToDateInputValue(applicationDate)}
                  onChange={(e) => setApplicationDate(dateInputValueToISO(e.target.value) || '')}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2 mr-auto">
              <Checkbox
                id="addAnother"
                checked={addAnother}
                onCheckedChange={(checked) => setAddAnother(checked === true)}
                disabled={isSaving}
              />
              <Label htmlFor="addAnother" className="text-sm font-normal cursor-pointer">
                Add another case after saving
              </Label>
            </div>
            <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !isFormValid()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Case
                </>
              )}
            </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default QuickCaseModal;
