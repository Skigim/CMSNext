import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { NewPersonData } from "../../types/case";

interface ContactInfoFormProps {
  personData: NewPersonData;
  onPersonDataChange: (field: keyof NewPersonData, value: any) => void;
}

/**
 * ContactInfoForm component handles the contact information section of the person form
 * 
 * Features:
 * - Email input with validation
 * - Phone input with tel type
 * - Optional contact fields to avoid blocking edits
 * - Accessible form labels and inputs
 * 
 * @param personData - The person data object containing contact information
 * @param onPersonDataChange - Callback function to handle field changes
 */
export function ContactInfoForm({ personData, onPersonDataChange }: ContactInfoFormProps) {
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
          value={personData.phone}
          onChange={(e) => onPersonDataChange('phone', e.target.value)}
          placeholder="Enter phone number"
        />
      </div>
    </div>
  );
}