import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { Plus, Minus } from "lucide-react";
import { NewPersonData } from "../../types/case";
import { AddressForm } from "./AddressForm";
import { ContactInfoForm } from "./ContactInfoForm";

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
        </div>

        {/* Contact Information */}
        <ContactInfoForm
          personData={personData}
          onPersonDataChange={onPersonDataChange}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Address Section */}
      <AddressForm
        personData={personData}
        onAddressChange={onAddressChange}
        onMailingAddressChange={onMailingAddressChange}
      />

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