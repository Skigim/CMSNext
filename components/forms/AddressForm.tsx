import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { NewPersonData } from "../../types/case";
import { US_STATES } from "@/utils/constants/usStates";

interface AddressFormProps {
  personData: NewPersonData;
  onAddressChange: (field: keyof NewPersonData['address'], value: string) => void;
  onMailingAddressChange: (field: keyof NewPersonData['mailingAddress'], value: string | boolean) => void;
}

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