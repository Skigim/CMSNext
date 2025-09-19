import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { CaseDisplay, NewPersonData, NewCaseRecordData } from "../types/case";
import { ArrowLeft, User, FileText, Save, X, Plus, Minus } from "lucide-react";

interface CaseFormProps {
  case?: CaseDisplay;
  onSave: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => void;
  onCancel: () => void;
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

const LIVING_ARRANGEMENTS = [
  'Apartment/House',
  'Assisted Living',
  'Nursing Home',
  'Group Home',
  'Family Home',
  'Independent Living',
  'Other'
];

const CASE_TYPES = [
  'LTC',
  'Medicaid',
  'SNAP',
  'TANF',
  'Emergency',
  'Other'
];

const CASE_STATUSES = [
  'Pending',
  'In Progress', 
  'Priority',
  'Review',
  'Completed'
];

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export function CaseForm({ case: existingCase, onSave, onCancel }: CaseFormProps) {
  const [activeTab, setActiveTab] = useState("person");
  const [personData, setPersonData] = useState<NewPersonData>({
    firstName: existingCase?.person.firstName || '',
    lastName: existingCase?.person.lastName || '',
    email: existingCase?.person.email || '',
    phone: existingCase?.person.phone || '',
    dateOfBirth: existingCase?.person.dateOfBirth || '',
    ssn: existingCase?.person.ssn || '',
    organizationId: null,
    livingArrangement: existingCase?.person.livingArrangement || 'Apartment/House',
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
    caseType: existingCase?.caseRecord.caseType || 'LTC',
    personId: existingCase?.caseRecord.personId || '',
    spouseId: existingCase?.caseRecord.spouseId || '',
    status: existingCase?.caseRecord.status || 'Pending',
    description: existingCase?.caseRecord.description || '',
    priority: existingCase?.caseRecord.priority || false,
    livingArrangement: existingCase?.caseRecord.livingArrangement || '',
    withWaiver: existingCase?.caseRecord.withWaiver || false,
    admissionDate: existingCase?.caseRecord.admissionDate || '',
    organizationId: '',
    authorizedReps: existingCase?.caseRecord.authorizedReps || [],
    retroRequested: existingCase?.caseRecord.retroRequested || '',
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
    // Basic validation
    return (
      personData.firstName.trim() !== '' &&
      personData.lastName.trim() !== '' &&
      personData.email.trim() !== '' &&
      personData.phone.trim() !== '' &&
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="person" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Person Information
                </TabsTrigger>
                <TabsTrigger value="case" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Case Details
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-6">
                <form onSubmit={handleSubmit} className="py-4 pb-6">
                  <TabsContent value="person" className="space-y-6 mt-4">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Basic Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            value={personData.firstName}
                            onChange={(e) => handlePersonDataChange('firstName', e.target.value)}
                            placeholder="Enter first name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            value={personData.lastName}
                            onChange={(e) => handlePersonDataChange('lastName', e.target.value)}
                            placeholder="Enter last name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={personData.email}
                            onChange={(e) => handlePersonDataChange('email', e.target.value)}
                            placeholder="Enter email address"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone *</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={personData.phone}
                            onChange={(e) => handlePersonDataChange('phone', e.target.value)}
                            placeholder="Enter phone number"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dateOfBirth">Date of Birth</Label>
                          <Input
                            id="dateOfBirth"
                            type="date"
                            value={personData.dateOfBirth}
                            onChange={(e) => handlePersonDataChange('dateOfBirth', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ssn">Social Security Number</Label>
                          <Input
                            id="ssn"
                            value={personData.ssn}
                            onChange={(e) => handlePersonDataChange('ssn', e.target.value)}
                            placeholder="XXX-XX-XXXX"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Living Arrangement */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Living Arrangement</h3>
                      <div className="space-y-2">
                        <Label htmlFor="livingArrangement">Living Arrangement</Label>
                        <Select
                          value={personData.livingArrangement}
                          onValueChange={(value) => handlePersonDataChange('livingArrangement', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select living arrangement" />
                          </SelectTrigger>
                          <SelectContent>
                            {LIVING_ARRANGEMENTS.map((arrangement) => (
                              <SelectItem key={arrangement} value={arrangement}>
                                {arrangement}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    {/* Physical Address */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Physical Address</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="street">Street Address</Label>
                          <Input
                            id="street"
                            value={personData.address.street}
                            onChange={(e) => handleAddressChange('street', e.target.value)}
                            placeholder="Enter street address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={personData.address.city}
                            onChange={(e) => handleAddressChange('city', e.target.value)}
                            placeholder="Enter city"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Select
                            value={personData.address.state}
                            onValueChange={(value) => handleAddressChange('state', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            value={personData.address.zip}
                            onChange={(e) => handleAddressChange('zip', e.target.value)}
                            placeholder="Enter ZIP code"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Mailing Address */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-foreground">Mailing Address</h3>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="sameAsPhysical"
                            checked={personData.mailingAddress.sameAsPhysical}
                            onCheckedChange={(checked) => handleMailingAddressChange('sameAsPhysical', checked)}
                          />
                          <Label htmlFor="sameAsPhysical">Same as physical address</Label>
                        </div>
                      </div>
                      
                      {!personData.mailingAddress.sameAsPhysical && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="mailingStreet">Street Address</Label>
                            <Input
                              id="mailingStreet"
                              value={personData.mailingAddress.street}
                              onChange={(e) => handleMailingAddressChange('street', e.target.value)}
                              placeholder="Enter mailing street address"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="mailingCity">City</Label>
                            <Input
                              id="mailingCity"
                              value={personData.mailingAddress.city}
                              onChange={(e) => handleMailingAddressChange('city', e.target.value)}
                              placeholder="Enter mailing city"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="mailingState">State</Label>
                            <Select
                              value={personData.mailingAddress.state}
                              onValueChange={(value) => handleMailingAddressChange('state', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {US_STATES.map((state) => (
                                  <SelectItem key={state.value} value={state.value}>
                                    {state.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="mailingZip">ZIP Code</Label>
                            <Input
                              id="mailingZip"
                              value={personData.mailingAddress.zip}
                              onChange={(e) => handleMailingAddressChange('zip', e.target.value)}
                              placeholder="Enter mailing ZIP code"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Household Information */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Household</h3>
                      
                      {/* Spouse */}
                      <div className="space-y-2">
                        <Label htmlFor="spouseId">Spouse ID</Label>
                        <Input
                          id="spouseId"
                          value={spouseId}
                          onChange={(e) => setSpouseId(e.target.value)}
                          placeholder="Enter spouse ID"
                        />
                      </div>

                      {/* Authorized Representatives */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Authorized Representatives</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAuthorizedRep}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {authorizedReps.map((rep, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={rep}
                                onChange={(e) => updateAuthorizedRep(index, e.target.value)}
                                placeholder="Enter authorized representative ID"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeAuthorizedRep(index)}
                                className="h-10 w-10 p-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {authorizedReps.length === 0 && (
                            <p className="text-sm text-muted-foreground">No authorized representatives added</p>
                          )}
                        </div>
                      </div>

                      {/* Family Members */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Family Members</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addFamilyMember}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {familyMembers.map((member, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={member}
                                onChange={(e) => updateFamilyMember(index, e.target.value)}
                                placeholder="Enter family member ID"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeFamilyMember(index)}
                                className="h-10 w-10 p-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {familyMembers.length === 0 && (
                            <p className="text-sm text-muted-foreground">No family members added</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="case" className="space-y-6 mt-4">
                    {/* Case Identification */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Case Identification</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="mcn">MCN *</Label>
                          <Input
                            id="mcn"
                            value={caseData.mcn}
                            onChange={(e) => handleCaseDataChange('mcn', e.target.value)}
                            placeholder="Enter MCN"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="caseType">Case Type</Label>
                          <Select
                            value={caseData.caseType}
                            onValueChange={(value) => handleCaseDataChange('caseType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CASE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="applicationDate">Application Date *</Label>
                          <Input
                            id="applicationDate"
                            type="date"
                            value={caseData.applicationDate}
                            onChange={(e) => handleCaseDataChange('applicationDate', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select
                            value={caseData.status}
                            onValueChange={(value) => handleCaseDataChange('status', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CASE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Case Details */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Case Details</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={caseData.description}
                            onChange={(e) => handleCaseDataChange('description', e.target.value)}
                            placeholder="Enter case description"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="caseLivingArrangement">Living Arrangement</Label>
                            <Select
                              value={caseData.livingArrangement}
                              onValueChange={(value) => handleCaseDataChange('livingArrangement', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select living arrangement" />
                              </SelectTrigger>
                              <SelectContent>
                                {LIVING_ARRANGEMENTS.map((arrangement) => (
                                  <SelectItem key={arrangement} value={arrangement}>
                                    {arrangement}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="admissionDate">Admission Date</Label>
                            <Input
                              id="admissionDate"
                              type="date"
                              value={caseData.admissionDate}
                              onChange={(e) => handleCaseDataChange('admissionDate', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Case Flags */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Case Flags</h3>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="priority"
                            checked={caseData.priority}
                            onCheckedChange={(checked) => handleCaseDataChange('priority', checked)}
                          />
                          <Label htmlFor="priority">Priority Case</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="withWaiver"
                            checked={caseData.withWaiver}
                            onCheckedChange={(checked) => handleCaseDataChange('withWaiver', checked)}
                          />
                          <Label htmlFor="withWaiver">With Waiver</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="retroRequested"
                            checked={retroRequested}
                            onCheckedChange={(checked) => setRetroRequested(checked)}
                          />
                          <Label htmlFor="retroRequested">Retro Requested</Label>
                        </div>
                      </div>
                    </div>
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