import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Pencil, Save, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { StoredCase, NewPersonData, NewCaseRecordData, Relationship, CaseStatus } from "../../types/case";
import { PersonColumn } from "./PersonColumn";
import { CaseColumn } from "./CaseColumn";
import { IntakeColumn } from "./IntakeColumn";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { useNavigationLock } from "@/hooks/useNavigationLock";
import { useFileStorageLifecycleSelectors } from "@/contexts/FileStorageContext";
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

interface CaseIntakeScreenProps {
  caseData: StoredCase;
  onSave: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
}

/**
 * CaseIntakeScreen - 3-column inline editing layout for case intake information
 * 
 * Replaces the previous modal-based CaseForm with an inline editing experience.
 * All case information is visible at a glance across 3 columns:
 * - Person Column: Basic info, contact, addresses, relationships
 * - Case Column: Case identification, details, flags
 * - Intake Column: Eligibility verification, reviews
 * 
 * Features:
 * - Toggle between read-only and edit modes
 * - Unsaved changes protection via navigation lock
 * - Explicit save with field-level validation
 * - Toast notifications for save success/failure
 */
export function CaseIntakeScreen({ caseData, onSave }: CaseIntakeScreenProps) {
  const { config } = useCategoryConfig();
  const connectionState = useFileStorageLifecycleSelectors();
  const { guardCaseInteraction } = useNavigationLock({ connectionState });

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
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

  // Form state - initialized from caseData
  const [personData, setPersonData] = useState<NewPersonData>(() => initPersonData(caseData, defaultLivingArrangement));
  const [caseRecordData, setCaseRecordData] = useState<NewCaseRecordData>(() => initCaseRecordData(caseData, defaultLivingArrangement, defaultCaseStatus));
  const [relationships, setRelationships] = useState<Relationship[]>(caseData.person.relationships || []);
  const [retroRequested, setRetroRequested] = useState<boolean>(!!caseData.caseRecord.retroRequested);

  // Track if form has changes
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form state when caseData changes (e.g., after save)
  useEffect(() => {
    if (!isEditing) {
      setPersonData(initPersonData(caseData, defaultLivingArrangement));
      setCaseRecordData(initCaseRecordData(caseData, defaultLivingArrangement, defaultCaseStatus));
      setRelationships(caseData.person.relationships || []);
      setRetroRequested(!!caseData.caseRecord.retroRequested);
      setHasChanges(false);
    }
  }, [caseData, isEditing, defaultLivingArrangement, defaultCaseStatus]);

  // Sync mailing address when "same as physical" is checked
  useEffect(() => {
    if (personData.mailingAddress.sameAsPhysical) {
      setPersonData(prev => ({
        ...prev,
        mailingAddress: {
          ...prev.address,
          sameAsPhysical: true,
        }
      }));
    }
  }, [personData.address, personData.mailingAddress.sameAsPhysical]);

  // Person data handlers
  const handlePersonDataChange = useCallback((field: keyof NewPersonData, value: unknown) => {
    setPersonData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleAddressChange = useCallback((field: keyof NewPersonData['address'], value: string) => {
    setPersonData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
    setHasChanges(true);
  }, []);

  const handleMailingAddressChange = useCallback((field: keyof NewPersonData['mailingAddress'], value: string | boolean) => {
    setPersonData(prev => ({
      ...prev,
      mailingAddress: { ...prev.mailingAddress, [field]: value }
    }));
    setHasChanges(true);
  }, []);

  // Case data handlers
  const handleCaseDataChange = useCallback((field: keyof NewCaseRecordData, value: unknown) => {
    setCaseRecordData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleRetroRequestedChange = useCallback((value: boolean) => {
    setRetroRequested(value);
    setHasChanges(true);
  }, []);

  // Relationship handlers
  const relationshipsHandlers = useMemo(() => ({
    add: () => {
      setRelationships(prev => [...prev, { type: '', name: '', phone: '' }]);
      setHasChanges(true);
    },
    update: (index: number, field: keyof Relationship, value: string) => {
      setRelationships(prev => prev.map((rel, i) => i === index ? { ...rel, [field]: value } : rel));
      setHasChanges(true);
    },
    remove: (index: number) => {
      setRelationships(prev => prev.filter((_, i) => i !== index));
      setHasChanges(true);
    },
  }), []);

  // Validation
  const isFormValid = useCallback(() => {
    return (
      personData.firstName.trim() !== '' &&
      personData.lastName.trim() !== '' &&
      caseRecordData.mcn.trim() !== '' &&
      caseRecordData.applicationDate !== ''
    );
  }, [personData.firstName, personData.lastName, caseRecordData.mcn, caseRecordData.applicationDate]);

  // Edit mode handlers
  const handleStartEdit = useCallback(() => {
    if (guardCaseInteraction()) return;
    setIsEditing(true);
  }, [guardCaseInteraction]);

  const handleCancelEdit = useCallback(() => {
    if (hasChanges) {
      setShowDiscardDialog(true);
    } else {
      setIsEditing(false);
    }
  }, [hasChanges]);

  const handleDiscardChanges = useCallback(() => {
    // Reset form to original values
    setPersonData(initPersonData(caseData, defaultLivingArrangement));
    setCaseRecordData(initCaseRecordData(caseData, defaultLivingArrangement, defaultCaseStatus));
    setRelationships(caseData.person.relationships || []);
    setRetroRequested(!!caseData.caseRecord.retroRequested);
    setHasChanges(false);
    setIsEditing(false);
    setShowDiscardDialog(false);
  }, [caseData, defaultLivingArrangement, defaultCaseStatus]);

  const handleSave = useCallback(async () => {
    if (!isFormValid()) {
      toast.error("Please fill in all required fields (First Name, Last Name, MCN, Application Date)");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Saving changes...");

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

      toast.success("Case updated successfully", { id: toastId });
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
        { id: toastId }
      );
    } finally {
      setIsSaving(false);
    }
  }, [isFormValid, onSave, personData, relationships, caseRecordData, retroRequested]);

  return (
    <div className="space-y-4">
      {/* Header with Edit Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            {personData.firstName} {personData.lastName}
          </h2>
          {hasChanges && isEditing && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unsaved changes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !isFormValid()}
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PersonColumn
          personData={personData}
          relationships={relationships}
          isEditing={isEditing}
          onPersonDataChange={handlePersonDataChange}
          onAddressChange={handleAddressChange}
          onMailingAddressChange={handleMailingAddressChange}
          onRelationshipsChange={relationshipsHandlers}
        />
        <CaseColumn
          caseData={caseRecordData}
          retroRequested={retroRequested}
          relationships={relationships}
          isEditing={isEditing}
          onCaseDataChange={handleCaseDataChange}
          onRetroRequestedChange={handleRetroRequestedChange}
          onRelationshipsChange={relationshipsHandlers}
        />
        <IntakeColumn
          caseData={caseRecordData}
          isEditing={isEditing}
          onCaseDataChange={handleCaseDataChange}
        />
      </div>

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
    </div>
  );
}

// Helper functions to initialize form state from StoredCase
function initPersonData(caseData: StoredCase, defaultLivingArrangement: string): NewPersonData {
  return {
    firstName: caseData.person.firstName || '',
    lastName: caseData.person.lastName || '',
    email: caseData.person.email || '',
    phone: caseData.person.phone || '',
    dateOfBirth: caseData.person.dateOfBirth || '',
    ssn: caseData.person.ssn || '',
    organizationId: null,
    livingArrangement: caseData.person.livingArrangement || defaultLivingArrangement,
    address: {
      street: caseData.person.address.street || '',
      city: caseData.person.address.city || '',
      state: caseData.person.address.state || 'NE',
      zip: caseData.person.address.zip || '',
    },
    mailingAddress: {
      street: caseData.person.mailingAddress.street || '',
      city: caseData.person.mailingAddress.city || '',
      state: caseData.person.mailingAddress.state || 'NE',
      zip: caseData.person.mailingAddress.zip || '',
      sameAsPhysical: caseData.person.mailingAddress.sameAsPhysical ?? true,
    },
    authorizedRepIds: caseData.person.authorizedRepIds || [],
    familyMembers: caseData.person.familyMembers || [],
    relationships: caseData.person.relationships || [],
    status: caseData.person.status || 'Active',
  };
}

function initCaseRecordData(
  caseData: StoredCase,
  defaultLivingArrangement: string,
  defaultCaseStatus: CaseStatus
): NewCaseRecordData {
  return {
    mcn: caseData.caseRecord.mcn || '',
    applicationDate: caseData.caseRecord.applicationDate || '',
    caseType: caseData.caseRecord.caseType || '',
    personId: caseData.caseRecord.personId || '',
    spouseId: caseData.caseRecord.spouseId || '',
    status: (caseData.caseRecord.status || defaultCaseStatus) as CaseStatus,
    description: caseData.caseRecord.description || '',
    priority: caseData.caseRecord.priority || false,
    livingArrangement: caseData.caseRecord.livingArrangement || defaultLivingArrangement,
    withWaiver: caseData.caseRecord.withWaiver || false,
    admissionDate: caseData.caseRecord.admissionDate || '',
    organizationId: '',
    authorizedReps: caseData.caseRecord.authorizedReps || [],
    retroRequested: caseData.caseRecord.retroRequested || '',
    // Intake checklist fields
    appValidated: caseData.caseRecord.appValidated ?? false,
    retroMonths: caseData.caseRecord.retroMonths ?? [],
    contactMethods: caseData.caseRecord.contactMethods ?? [],
    agedDisabledVerified: caseData.caseRecord.agedDisabledVerified ?? false,
    citizenshipVerified: caseData.caseRecord.citizenshipVerified ?? false,
    residencyVerified: caseData.caseRecord.residencyVerified ?? false,
    avsSubmitted: caseData.caseRecord.avsSubmitted ?? false,
    interfacesReviewed: caseData.caseRecord.interfacesReviewed ?? false,
    reviewVRs: caseData.caseRecord.reviewVRs ?? false,
    reviewPriorBudgets: caseData.caseRecord.reviewPriorBudgets ?? false,
    reviewPriorNarr: caseData.caseRecord.reviewPriorNarr ?? false,
    pregnancy: caseData.caseRecord.pregnancy ?? false,
    avsConsentDate: caseData.caseRecord.avsConsentDate ?? '',
    maritalStatus: caseData.caseRecord.maritalStatus ?? '',
    voterFormStatus: caseData.caseRecord.voterFormStatus ?? '',
  };
}

export default CaseIntakeScreen;
