import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { User, Phone, Mail, MapPin, Calendar, Plus, Minus, Users } from "lucide-react";
import { NewPersonData, Relationship } from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { isoToDateInputValue, dateInputValueToISO, formatDateForDisplay } from "@/domain/common";
import { formatPhoneNumberAsTyped, normalizePhoneNumber, getDisplayPhoneNumber } from "@/domain/common";
import { CopyButton } from "../common/CopyButton";

// US States for address dropdowns
const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

interface PersonColumnProps {
  personData: NewPersonData;
  relationships: Relationship[];
  isEditing: boolean;
  onPersonDataChange: (field: keyof NewPersonData, value: unknown) => void;
  onAddressChange: (field: keyof NewPersonData['address'], value: string) => void;
  onMailingAddressChange: (field: keyof NewPersonData['mailingAddress'], value: string | boolean) => void;
  onRelationshipsChange: {
    add: () => void;
    update: (index: number, field: keyof Relationship, value: string) => void;
    remove: (index: number) => void;
  };
}

// Read-only info display component
function InfoItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />}
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function PersonColumn({
  personData,
  relationships,
  isEditing,
  onPersonDataChange,
  onAddressChange,
  onMailingAddressChange,
  onRelationshipsChange,
}: PersonColumnProps) {
  const { config } = useCategoryConfig();
  const livingArrangements = useMemo(() => config.livingArrangements, [config.livingArrangements]);

  // Use domain formatDateForDisplay - returns "None" for empty values
  const formatDate = (dateString?: string) => {
    const formatted = formatDateForDisplay(dateString);
    return formatted === "None" ? null : formatted;
  };

  // Full address string
  const fullAddress = personData.address.street
    ? `${personData.address.street}, ${personData.address.city}, ${personData.address.state} ${personData.address.zip}`
    : null;

  const fullMailingAddress = !personData.mailingAddress.sameAsPhysical && personData.mailingAddress.street
    ? `${personData.mailingAddress.street}, ${personData.mailingAddress.city}, ${personData.mailingAddress.state} ${personData.mailingAddress.zip}`
    : null;

  if (!isEditing) {
    // Read-only view
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Person Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Basic Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="First Name" value={personData.firstName} icon={User} />
              <InfoItem label="Last Name" value={personData.lastName} />
              <InfoItem label="Date of Birth" value={formatDate(personData.dateOfBirth)} icon={Calendar} />
              <InfoItem label="SSN" value={personData.ssn ? "•••-••-" + personData.ssn.slice(-4) : null} />
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              {personData.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-xs text-muted-foreground">Phone</span>
                    <CopyButton
                      value={getDisplayPhoneNumber(personData.phone)}
                      label="Phone"
                      showLabel={false}
                      successMessage="Phone copied"
                    />
                  </div>
                </div>
              )}
              <InfoItem label="Email" value={personData.email} icon={Mail} />
            </div>
          </div>

          <Separator />

          {/* Living Arrangement */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Living Arrangement</h4>
            <InfoItem label="Arrangement" value={personData.livingArrangement} />
          </div>

          <Separator />

          {/* Addresses */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Addresses</h4>
            <InfoItem label="Physical Address" value={fullAddress} icon={MapPin} />
            {personData.mailingAddress.sameAsPhysical ? (
              <p className="text-xs text-muted-foreground pl-6">Mailing same as physical</p>
            ) : (
              <InfoItem label="Mailing Address" value={fullMailingAddress} icon={Mail} />
            )}
          </div>

          <Separator />

          {/* Relationships */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">Relationships</h4>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {relationships.length}
              </Badge>
            </div>
            {relationships.length > 0 ? (
              <div className="space-y-2">
                {relationships.map((rel, index) => (
                  <div key={index} className="flex flex-col gap-1 p-2 border rounded-md bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{rel.name}</span>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {rel.type}
                      </Badge>
                    </div>
                    {rel.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <CopyButton
                          value={getDisplayPhoneNumber(rel.phone)}
                          label="Phone"
                          showLabel={false}
                          successMessage="Phone copied"
                          textClassName="text-xs"
                          buttonClassName="text-xs px-1 py-0"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No relationships added</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Person Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Basic Information</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-xs">First Name *</Label>
              <Input
                id="firstName"
                value={personData.firstName}
                onChange={(e) => onPersonDataChange('firstName', e.target.value)}
                placeholder="First name"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
              <Input
                id="lastName"
                value={personData.lastName}
                onChange={(e) => onPersonDataChange('lastName', e.target.value)}
                placeholder="Last name"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateOfBirth" className="text-xs">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={isoToDateInputValue(personData.dateOfBirth)}
                onChange={(e) => onPersonDataChange('dateOfBirth', dateInputValueToISO(e.target.value) || '')}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ssn" className="text-xs">SSN</Label>
              <Input
                id="ssn"
                value={personData.ssn}
                onChange={(e) => onPersonDataChange('ssn', e.target.value)}
                placeholder="XXX-XX-XXXX"
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Contact Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={personData.email}
                onChange={(e) => onPersonDataChange('email', e.target.value)}
                placeholder="Email address"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formatPhoneNumberAsTyped(personData.phone)}
                onChange={(e) => onPersonDataChange('phone', normalizePhoneNumber(e.target.value))}
                placeholder="(555) 123-4567"
                className="h-8"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Living Arrangement */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Living Arrangement</h4>
          <Select
            value={personData.livingArrangement}
            onValueChange={(value) => onPersonDataChange('livingArrangement', value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select arrangement" />
            </SelectTrigger>
            <SelectContent>
              {livingArrangements.map((arrangement) => (
                <SelectItem key={arrangement} value={arrangement}>
                  {arrangement}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Physical Address */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Physical Address</h4>
          <div className="space-y-2">
            <Input
              value={personData.address.street}
              onChange={(e) => onAddressChange('street', e.target.value)}
              placeholder="Street address"
              className="h-8"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={personData.address.city}
                onChange={(e) => onAddressChange('city', e.target.value)}
                placeholder="City"
                className="h-8"
              />
              <Select
                value={personData.address.state}
                onValueChange={(value) => onAddressChange('state', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={personData.address.zip}
                onChange={(e) => onAddressChange('zip', e.target.value)}
                placeholder="ZIP"
                className="h-8"
              />
            </div>
          </div>
        </div>

        {/* Mailing Address */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Mailing Address</h4>
            <div className="flex items-center gap-2">
              <Label htmlFor="sameAsPhysical" className="text-xs">Same as physical</Label>
              <Switch
                id="sameAsPhysical"
                checked={personData.mailingAddress.sameAsPhysical}
                onCheckedChange={(checked) => onMailingAddressChange('sameAsPhysical', checked)}
              />
            </div>
          </div>
          {!personData.mailingAddress.sameAsPhysical && (
            <div className="space-y-2">
              <Input
                value={personData.mailingAddress.street}
                onChange={(e) => onMailingAddressChange('street', e.target.value)}
                placeholder="Street address"
                className="h-8"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={personData.mailingAddress.city}
                  onChange={(e) => onMailingAddressChange('city', e.target.value)}
                  placeholder="City"
                  className="h-8"
                />
                <Select
                  value={personData.mailingAddress.state}
                  onValueChange={(value) => onMailingAddressChange('state', value)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={personData.mailingAddress.zip}
                  onChange={(e) => onMailingAddressChange('zip', e.target.value)}
                  placeholder="ZIP"
                  className="h-8"
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Relationships */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Relationships</h4>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRelationshipsChange.add}
              className="h-7 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {relationships.map((rel, index) => (
              <div key={index} className="flex flex-col gap-2 p-2 border rounded-md bg-muted/10 relative group">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRelationshipsChange.remove(index)}
                  className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={rel.type}
                    onValueChange={(value) => onRelationshipsChange.update(index, 'type', value)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                      <SelectItem value="Authorized Representative">Auth Rep</SelectItem>
                      <SelectItem value="Case Manager">Case Manager</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={rel.name}
                    onChange={(e) => onRelationshipsChange.update(index, 'name', e.target.value)}
                    placeholder="Name"
                    className="h-7 text-xs"
                  />
                  <Input
                    value={formatPhoneNumberAsTyped(rel.phone)}
                    onChange={(e) => onRelationshipsChange.update(index, 'phone', normalizePhoneNumber(e.target.value))}
                    placeholder="Phone"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            ))}
            {relationships.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No relationships added</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PersonColumn;
