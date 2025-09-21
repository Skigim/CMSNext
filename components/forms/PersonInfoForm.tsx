import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { NewPersonData } from "../../types/case";

interface PersonInfoFormProps {
  personData: NewPersonData;
  spouseId: string;
  authorizedReps: string[];
  familyMembers: string[];
  onPersonDataChange: (field: keyof NewPersonData, value: any) => void;
  onAddressChange: (field: keyof NewPersonData['address'], value: string) => void;
  onMailingAddressChange: (field: keyof NewPersonData['mailingAddress'], value: string | boolean) => void;
  onSpouseIdChange: (value: string) => void;
  onAuthorizedRepsChange: {
    add: () => void;
    update: (index: number, value: string) => void;
    remove: (index: number) => void;
  };
  onFamilyMembersChange: {
    add: () => void;
    update: (index: number, value: string) => void;
    remove: (index: number) => void;
  };
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

export function PersonInfoForm({
  personData,
  spouseId,
  authorizedReps,
  familyMembers,
  onPersonDataChange,
  onAddressChange,
  onMailingAddressChange,
  onSpouseIdChange,
  onAuthorizedRepsChange,
  onFamilyMembersChange
}: PersonInfoFormProps) {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={personData.firstName}
              onChange={(e) => onPersonDataChange('firstName', e.target.value)}
              placeholder="Enter first name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={personData.lastName}
              onChange={(e) => onPersonDataChange('lastName', e.target.value)}
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
              onChange={(e) => onPersonDataChange('email', e.target.value)}
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
              onChange={(e) => onPersonDataChange('phone', e.target.value)}
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
              onChange={(e) => onPersonDataChange('dateOfBirth', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ssn">Social Security Number</Label>
            <Input
              id="ssn"
              value={personData.ssn}
              onChange={(e) => onPersonDataChange('ssn', e.target.value)}
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
            onValueChange={(value) => onPersonDataChange('livingArrangement', value)}
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
              onChange={(e) => onAddressChange('street', e.target.value)}
              placeholder="Enter street address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={personData.address.city}
              onChange={(e) => onAddressChange('city', e.target.value)}
              placeholder="Enter city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={personData.address.state}
              onValueChange={(value) => onAddressChange('state', value)}
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
              onChange={(e) => onAddressChange('zip', e.target.value)}
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
              onCheckedChange={(checked) => onMailingAddressChange('sameAsPhysical', checked)}
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
                onChange={(e) => onMailingAddressChange('street', e.target.value)}
                placeholder="Enter mailing street address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mailingCity">City</Label>
              <Input
                id="mailingCity"
                value={personData.mailingAddress.city}
                onChange={(e) => onMailingAddressChange('city', e.target.value)}
                placeholder="Enter mailing city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mailingState">State</Label>
              <Select
                value={personData.mailingAddress.state}
                onValueChange={(value) => onMailingAddressChange('state', value)}
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
                onChange={(e) => onMailingAddressChange('zip', e.target.value)}
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
            onChange={(e) => onSpouseIdChange(e.target.value)}
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
              onClick={onAuthorizedRepsChange.add}
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
                  onChange={(e) => onAuthorizedRepsChange.update(index, e.target.value)}
                  placeholder="Enter authorized representative ID"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAuthorizedRepsChange.remove(index)}
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
              onClick={onFamilyMembersChange.add}
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
                  onChange={(e) => onFamilyMembersChange.update(index, e.target.value)}
                  placeholder="Enter family member ID"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onFamilyMembersChange.remove(index)}
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
    </div>
  );
}