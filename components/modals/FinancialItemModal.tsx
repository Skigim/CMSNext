import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { CaseCategory, StoredCase } from "../../types/case";
import { AlertCircle } from "lucide-react";
import type { FinancialFormData, FinancialFormErrors } from "../../hooks/useFinancialItemFlow";



interface FinancialItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<boolean>;
  caseData: StoredCase;
  itemType: CaseCategory;
  isEditing: boolean;
  // Form state from hook
  formData: FinancialFormData;
  formErrors: FinancialFormErrors;
  addAnother: boolean;
  onFormFieldChange: <K extends keyof FinancialFormData>(field: K, value: FinancialFormData[K]) => void;
  onAddAnotherChange: (value: boolean) => void;
}

export function FinancialItemModal({
  isOpen,
  onClose,
  onSave,
  caseData,
  itemType,
  isEditing,
  formData,
  formErrors,
  addAnother,
  onFormFieldChange,
  onAddAnotherChange,
}: FinancialItemModalProps) {
  const isSimpCase = caseData.caseRecord.caseType === 'LTC'; // LTC cases need owner field

  const getPlaceholders = () => {
    const placeholders = {
      resources: {
        description: 'e.g., Checking Account, Savings Account, CD',
        location: 'e.g., Bank of America, Wells Fargo',
      },
      income: {
        description: 'e.g., Social Security, Pension, Employment',
        location: 'e.g., SSA, ABC Company, State Retirement',
      },
      expenses: {
        description: 'e.g., Medicare Part B, Rent, Utilities',
        location: 'e.g., Medicare, Landlord Name, Electric Company',
      },
    };
    return placeholders[itemType] || placeholders.resources;
  };

  const placeholders = getPlaceholders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Only call onClose when dialog is being closed
      // This ensures we don't interfere with the parent's view state
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit' : 'Add'} {itemType.charAt(0).toUpperCase() + itemType.slice(1)} Item
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Update the details for this ${itemType.slice(0, -1)} item.`
              : `Enter the details for a new ${itemType.slice(0, -1)} item. All fields marked with * are required.`
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {formErrors.general && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {formErrors.general}
            </div>
          )}
          
          {/* Row 1: Description and Location/Institution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Item Name *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => onFormFieldChange('description', e.target.value)}
                placeholder={placeholders.description}
                className={formErrors.description ? 'border-destructive' : ''}
              />
              {formErrors.description && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.description}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location/Institution</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => onFormFieldChange('location', e.target.value)}
                placeholder={placeholders.location}
              />
            </div>
          </div>

          {/* Row 2: Account Number, Amount, and Frequency (conditional) */}
          <div className={`grid gap-4 ${
            itemType === 'income' || itemType === 'expenses' 
              ? 'grid-cols-1 md:grid-cols-3' 
              : 'grid-cols-1 md:grid-cols-2'
          }`}>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={formData.accountNumber}
                onChange={(e) => onFormFieldChange('accountNumber', e.target.value)}
                placeholder="Last 4 digits: 1234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => onFormFieldChange('amount', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className={formErrors.amount ? 'border-destructive' : ''}
              />
              {formErrors.amount && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.amount}
                </div>
              )}
            </div>

            {(itemType === 'income' || itemType === 'expenses') && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => onFormFieldChange('frequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">/mo</SelectItem>
                    <SelectItem value="yearly">/yr</SelectItem>
                    <SelectItem value="weekly">/wk</SelectItem>
                    <SelectItem value="daily">/day</SelectItem>
                    <SelectItem value="one-time">1x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Row 3: Verification Status and Verification Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="verificationStatus">Verification Status</Label>
              <Select
                value={formData.verificationStatus}
                onValueChange={(value) => onFormFieldChange('verificationStatus', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Needs VR">Needs VR</SelectItem>
                  <SelectItem value="VR Pending">VR Pending</SelectItem>
                  <SelectItem value="AVS Pending">AVS Pending</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verificationSource">Verification Source</Label>
              <Input
                id="verificationSource"
                value={formData.verificationSource}
                onChange={(e) => onFormFieldChange('verificationSource', e.target.value)}
                placeholder="e.g., Bank Statement 05/2025, Award Letter"
                disabled={formData.verificationStatus !== 'Verified'}
                className={`${
                  formData.verificationStatus !== 'Verified' 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                } ${formErrors.verificationSource ? 'border-destructive' : ''}`}
              />
              {formErrors.verificationSource && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.verificationSource}
                </div>
              )}
            </div>
          </div>

          {/* Owner field for SIMP cases */}
          {isSimpCase && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Select
                  value={formData.owner}
                  onValueChange={(value) => onFormFieldChange('owner', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="applicant">Applicant</SelectItem>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="joint">Joint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div></div> {/* Empty div to maintain grid */}
            </div>
          )}

          {/* Notes (full width) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Item Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => onFormFieldChange('notes', e.target.value)}
              placeholder="Additional notes about this item..."
              rows={3}
            />
          </div>

          {/* Add Another (for new items only) */}
          {!isEditing && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="addAnother"
                checked={addAnother}
                onCheckedChange={(checked) => onAddAnotherChange(checked === true)}
              />
              <Label htmlFor="addAnother">
                Add another item after saving
              </Label>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={onSave}>
            {isEditing ? 'Update Item' : 'Save Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FinancialItemModal;