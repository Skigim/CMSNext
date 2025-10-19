import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { NewPersonData } from "../../types/case";

interface AddressFormProps {
  personData: NewPersonData;
  onAddressChange: (field: keyof NewPersonData['address'], value: string) => void;
  onMailingAddressChange: (field: keyof NewPersonData['mailingAddress'], value: string | boolean) => void;
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
  { value: 'WY', label: 'Wyoming' },
];

/**
 * AddressForm component handles both physical and mailing address sections
 * Extracted from PersonInfoForm as part of component refactoring (Phase 2B.1)
 * 
 * @param personData - The complete person data object containing address information
 * @param onAddressChange - Handler for physical address field changes
 * @param onMailingAddressChange - Handler for mailing address field changes (including sameAsPhysical toggle)
 */
export function AddressForm({
  personData,
  onAddressChange,
  onMailingAddressChange,
}: AddressFormProps) {
  return (
    <>
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
    </>
  );
}