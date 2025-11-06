import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { NewPersonData } from "../../types/case";
import { formatPhoneNumberAsTyped, normalizePhoneNumber } from "../../utils/phoneFormatter";
import { useState, useEffect } from "react";

interface ContactInfoFormProps {
  personData: NewPersonData;
  onPersonDataChange: (field: keyof NewPersonData, value: any) => void;
}

/**
 * ContactInfoForm component handles the contact information section of the person form
 * 
 * Features:
 * - Email input with validation
 * - Phone input with format-as-you-type functionality
 * - Automatic phone number formatting (XXX) XXX-XXXX
 * - Stores normalized phone numbers (digits only) in state
 * - Optional contact fields to avoid blocking edits
 * - Accessible form labels and inputs
 * 
 * @param personData - The person data object containing contact information
 * @param onPersonDataChange - Callback function to handle field changes
 */
export function ContactInfoForm({ personData, onPersonDataChange }: ContactInfoFormProps) {
  const [phoneDisplay, setPhoneDisplay] = useState(
    formatPhoneNumberAsTyped(personData.phone)
  );

  // Sync local display state when personData.phone changes externally (e.g., editing existing case)
  useEffect(() => {
    setPhoneDisplay(formatPhoneNumberAsTyped(personData.phone));
  }, [personData.phone]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const formatted = formatPhoneNumberAsTyped(newValue);
    setPhoneDisplay(formatted);
    
    // Store normalized (digits only) version in state
    const normalized = normalizePhoneNumber(newValue);
    onPersonDataChange('phone', normalized);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          value={personData.email}
          onChange={(e) => onPersonDataChange('email', e.target.value)}
          placeholder="Enter email address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input
          id="phone"
          type="tel"
          value={phoneDisplay}
          onChange={handlePhoneChange}
          placeholder="(555) 123-4567"
        />
      </div>
    </div>
  );
}