import { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { StoredCase, NewPersonData, NewCaseRecordData, CaseStatus, CASE_STATUS_VALUES } from "../../types/case";
import { ArrowLeft, User, FileText, Save, X, ClipboardCheck } from "lucide-react";
import { withFormErrorBoundary } from "../error/ErrorBoundaryHOC";
import { PersonInfoForm } from "../forms/PersonInfoForm";
import { CaseInfoForm } from "../forms/CaseInfoForm";
import { IntakeInfoForm } from "../forms/IntakeInfoForm";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";

interface CaseFormProps {
  case?: StoredCase;
  onSave: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => void;
  onCancel: () => void;
}

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export function CaseForm({ case: existingCase, onSave, onCancel }: CaseFormProps) {
  const { config } = useCategoryConfig();

  const defaultCaseType = useMemo(() => config.caseTypes[0] ?? "", [config.caseTypes]);
  const defaultCaseStatus = useMemo(() => (config.caseStatuses[0]?.name ?? "Pending") as CaseStatus, [config.caseStatuses]);
  const defaultLivingArrangement = useMemo(
    () => config.livingArrangements[0] ?? "",
    [config.livingArrangements],
  );

  const [activeTab, setActiveTab] = useState("person");
  const [personData, setPersonData] = useState<NewPersonData>({
    firstName: existingCase?.person.firstName || '',
    lastName: existingCase?.person.lastName || '',
    email: existingCase?.person.email || '',
    phone: existingCase?.person.phone || '',
    dateOfBirth: existingCase?.person.dateOfBirth || '',
    ssn: existingCase?.person.ssn || '',
    organizationId: null,
    livingArrangement: existingCase?.person.livingArrangement || defaultLivingArrangement,
    address: {
      street: existingCase?.person.address.street || '',
      city: existingCase?.person.address.city || '',
      state: existingCase?.person.address.state || 'NE',
      zip: existingCase?.person.address.zip || '',
    },
    mailingAddress: {
      street: existingCase?.person.mailingAddress.street || '',
      city: existingCase?.person.mailingAddress.city || '',
      state: existingCase?.person.mailingAddress.state || 'NE',
      zip: existingCase?.person.mailingAddress.zip || '',
      sameAsPhysical: existingCase?.person.mailingAddress.sameAsPhysical ?? true,
    },
    authorizedRepIds: existingCase?.person.authorizedRepIds || [],
    familyMembers: existingCase?.person.familyMembers || [],
    status: existingCase?.person.status || 'Active',
  });

  const [caseData, setCaseData] = useState<NewCaseRecordData>({
    mcn: existingCase?.caseRecord.mcn || '',
    applicationDate: existingCase?.caseRecord.applicationDate || getTodayDate(),
    caseType: existingCase?.caseRecord.caseType || defaultCaseType,
    personId: existingCase?.caseRecord.personId || '',
    spouseId: existingCase?.caseRecord.spouseId || '',
    status: (existingCase?.caseRecord.status || defaultCaseStatus) as CaseStatus,
    description: existingCase?.caseRecord.description || '',
    priority: existingCase?.caseRecord.priority || false,
    livingArrangement: existingCase?.caseRecord.livingArrangement || defaultLivingArrangement,
    withWaiver: existingCase?.caseRecord.withWaiver || false,
    admissionDate: existingCase?.caseRecord.admissionDate || '',
    organizationId: '',
    authorizedReps: existingCase?.caseRecord.authorizedReps || [],
    retroRequested: existingCase?.caseRecord.retroRequested || '',
    // Intake checklist fields
    appValidated: existingCase?.caseRecord.appValidated ?? false,
    retroMonths: existingCase?.caseRecord.retroMonths ?? [],
    contactMethods: existingCase?.caseRecord.contactMethods ?? [],
    agedDisabledVerified: existingCase?.caseRecord.agedDisabledVerified ?? false,
    citizenshipVerified: existingCase?.caseRecord.citizenshipVerified ?? false,
    residencyVerified: existingCase?.caseRecord.residencyVerified ?? false,
    avsSubmitted: existingCase?.caseRecord.avsSubmitted ?? false,
    interfacesReviewed: existingCase?.caseRecord.interfacesReviewed ?? false,
    reviewVRs: existingCase?.caseRecord.reviewVRs ?? false,
    reviewPriorBudgets: existingCase?.caseRecord.reviewPriorBudgets ?? false,
    reviewPriorNarr: existingCase?.caseRecord.reviewPriorNarr ?? false,
    pregnancy: existingCase?.caseRecord.pregnancy ?? false,
    avsConsentDate: existingCase?.caseRecord.avsConsentDate ?? '',
    maritalStatus: existingCase?.caseRecord.maritalStatus ?? '',
    voterFormStatus: existingCase?.caseRecord.voterFormStatus ?? '',
  });

  // State for household information
  const [spouseId, setSpouseId] = useState(existingCase?.caseRecord.spouseId || '');
  const [authorizedReps, setAuthorizedReps] = useState<string[]>(existingCase?.person.authorizedRepIds || []);
  const [familyMembers, setFamilyMembers] = useState<string[]>(existingCase?.person.familyMembers || []);
  const [retroRequested, setRetroRequested] = useState<boolean>(!!existingCase?.caseRecord.retroRequested);

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

  useEffect(() => {
    setPersonData(prev => {
      if (existingCase?.person.livingArrangement) {
        return prev;
      }

      if (!defaultLivingArrangement || prev.livingArrangement === defaultLivingArrangement) {
        return prev;
      }

      return {
        ...prev,
        livingArrangement: defaultLivingArrangement,
      };
    });
  }, [defaultLivingArrangement, existingCase?.person.livingArrangement]);

  useEffect(() => {
    setCaseData(prev => {
      const next = { ...prev };
      let changed = false;

      if (!existingCase?.caseRecord.caseType && defaultCaseType && !config.caseTypes.includes(prev.caseType)) {
        next.caseType = defaultCaseType;
        changed = true;
      }

      if (!existingCase?.caseRecord.status && defaultCaseStatus && !CASE_STATUS_VALUES.includes(prev.status)) {
        next.status = defaultCaseStatus;
        changed = true;
      }

      if (
        !existingCase?.caseRecord.livingArrangement &&
        defaultLivingArrangement &&
        !config.livingArrangements.includes(prev.livingArrangement)
      ) {
        next.livingArrangement = defaultLivingArrangement;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [
    config.caseStatuses,
    config.caseTypes,
    config.livingArrangements,
    defaultCaseStatus,
    defaultCaseType,
    defaultLivingArrangement,
    existingCase?.caseRecord.caseType,
    existingCase?.caseRecord.livingArrangement,
    existingCase?.caseRecord.status,
  ]);

  const handlePersonDataChange = (field: keyof NewPersonData, value: any) => {
    setPersonData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field: keyof NewPersonData['address'], value: string) => {
    setPersonData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleMailingAddressChange = (field: keyof NewPersonData['mailingAddress'], value: string | boolean) => {
    setPersonData(prev => ({
      ...prev,
      mailingAddress: { ...prev.mailingAddress, [field]: value }
    }));
  };

  const handleCaseDataChange = (field: keyof NewCaseRecordData, value: any) => {
    setCaseData(prev => ({ ...prev, [field]: value }));
  };

  // Household management functions
  const addAuthorizedRep = () => {
    setAuthorizedReps(prev => [...prev, '']);
  };

  const updateAuthorizedRep = (index: number, value: string) => {
    setAuthorizedReps(prev => prev.map((rep, i) => i === index ? value : rep));
  };

  const removeAuthorizedRep = (index: number) => {
    setAuthorizedReps(prev => prev.filter((_, i) => i !== index));
  };

  const addFamilyMember = () => {
    setFamilyMembers(prev => [...prev, '']);
  };

  const updateFamilyMember = (index: number, value: string) => {
    setFamilyMembers(prev => prev.map((member, i) => i === index ? value : member));
  };

  const removeFamilyMember = (index: number) => {
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      person: {
        ...personData,
        authorizedRepIds: authorizedReps.filter(rep => rep.trim() !== ''),
        familyMembers: familyMembers.filter(member => member.trim() !== ''),
      },
      caseRecord: {
        ...caseData,
        spouseId,
        retroRequested: retroRequested ? 'Yes' : '',
      }
    });
  };

  const isFormValid = () => {
    // Basic validation - email and phone are optional
    return (
      personData.firstName.trim() !== '' &&
      personData.lastName.trim() !== '' &&
      caseData.mcn.trim() !== '' &&
      caseData.applicationDate !== ''
    );
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="text-xl">
                {existingCase ? 'Edit Case' : 'New Case'}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {existingCase ? 'Update case information' : 'Create a new case record'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-6 pt-4 shrink-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="person" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Person
                </TabsTrigger>
                <TabsTrigger value="case" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Case
                </TabsTrigger>
                <TabsTrigger value="intake" className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Intake
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-6">
                <form onSubmit={handleSubmit} className="py-4 pb-6">
                  <TabsContent value="person" className="space-y-6 mt-4">
                    <PersonInfoForm
                      personData={personData}
                      spouseId={spouseId}
                      authorizedReps={authorizedReps}
                      familyMembers={familyMembers}
                      onPersonDataChange={handlePersonDataChange}
                      onAddressChange={handleAddressChange}
                      onMailingAddressChange={handleMailingAddressChange}
                      onSpouseIdChange={setSpouseId}
                      onAuthorizedRepsChange={{
                        add: addAuthorizedRep,
                        update: updateAuthorizedRep,
                        remove: removeAuthorizedRep
                      }}
                      onFamilyMembersChange={{
                        add: addFamilyMember,
                        update: updateFamilyMember,
                        remove: removeFamilyMember
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="case" className="space-y-6 mt-4">
                    <CaseInfoForm
                      caseData={caseData}
                      retroRequested={retroRequested}
                      onCaseDataChange={handleCaseDataChange}
                      onRetroRequestedChange={setRetroRequested}
                    />
                  </TabsContent>

                  <TabsContent value="intake" className="space-y-6 mt-4">
                    <IntakeInfoForm
                      caseData={caseData}
                      onCaseDataChange={handleCaseDataChange}
                    />
                  </TabsContent>
                </form>
              </ScrollArea>
            </div>

            {/* Form Actions */}
            <div className="border-t bg-background p-6 shrink-0">
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!isFormValid()}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {existingCase ? 'Update Case' : 'Create Case'}
                </Button>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Export with error boundary for form operations
export default withFormErrorBoundary(CaseForm);