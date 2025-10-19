import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { CaseDisplay, FinancialItem, CaseCategory } from "../../types/case";
import { useDataManagerSafe } from "../../contexts/DataManagerContext";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";



interface FinancialItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: CaseDisplay;
  onUpdateCase: (updatedCase: CaseDisplay) => void;
  itemType: CaseCategory;
  editingItem?: FinancialItem | null;
}

interface FormData {
  id: string | null;
  description: string;
  location: string;
  accountNumber: string;
  amount: number;
  frequency: string;
  owner: string;
  verificationStatus: string;
  verificationSource: string;
  notes: string;
  dateAdded: string;
}

interface FormErrors {
  [key: string]: string | null;
}

export function FinancialItemModal({
  isOpen,
  onClose,
  caseData,
  onUpdateCase,
  itemType,
  editingItem = null
}: FinancialItemModalProps) {
  // Hook must be called at top level, not inside async functions
  const dataManager = useDataManagerSafe();
  
  const [formData, setFormData] = useState<FormData>({
    id: null,
    description: '',
    location: '',
    accountNumber: '',
    amount: 0,
    frequency: 'monthly',
    owner: 'applicant',
    verificationStatus: 'Needs VR',
    verificationSource: '',
    notes: '',
    dateAdded: new Date().toISOString(),
  });

  const [addAnother, setAddAnother] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const isSimpCase = caseData.caseRecord.caseType === 'LTC'; // Assuming LTC cases need owner field
  const isEditing = !!editingItem;

  // Reset form when modal opens/closes or editing item changes
  useEffect(() => {
    if (isOpen && editingItem) {
      setFormData({
        id: editingItem.id,
        description: editingItem.description || editingItem.name || '',
        location: editingItem.location || '',
        accountNumber: editingItem.accountNumber || '',
        amount: editingItem.amount || 0,
        frequency: editingItem.frequency || 'monthly',
        owner: editingItem.owner || 'applicant',
        verificationStatus: editingItem.verificationStatus || 'Needs VR',
        verificationSource: editingItem.verificationSource || '',
        notes: editingItem.notes || '',
        dateAdded: editingItem.dateAdded || new Date().toISOString(),
      });
    } else if (isOpen && !editingItem) {
      setFormData({
        id: null,
        description: '',
        location: '',
        accountNumber: '',
        amount: 0,
        frequency: 'monthly',
        owner: 'applicant',
        verificationStatus: 'Needs VR',
        verificationSource: '',
        notes: '',
        dateAdded: new Date().toISOString(),
      });
    }
    setErrors({});
    setAddAnother(false);
  }, [isOpen, editingItem]);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.amount < 0) {
      newErrors.amount = 'Amount cannot be negative';
    }

    if (formData.verificationStatus === 'Verified' && !formData.verificationSource.trim()) {
      newErrors.verificationSource = 'Verification source is required when status is Verified';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    // Check if data manager is available (use the hook value from component top level)
    if (!dataManager) {
      setErrors({ general: 'Data storage is not available. Please check your connection.' });
      return;
    }

    // Debug logging to help identify case mismatch issues
    if (isEditing && formData.id) {
      console.log('🔍 Updating financial item:', {
        caseId: caseData.id,
        itemType,
        itemId: formData.id,
        dataManagerType: 'DataManager'
      });
      
      // Check if the case exists in the data manager
      try {
        const allCases = await dataManager.getAllCases();
        const caseExists = allCases.find((c: CaseDisplay) => c.id === caseData.id);
        
        if (!caseExists) {
          console.error('❌ Case not found in data manager:', {
            requestedCaseId: caseData.id,
            availableCaseIds: allCases.map((c: CaseDisplay) => c.id),
            totalCases: allCases.length
          });
          setErrors({ general: `Case not found in data storage. Case ID: ${caseData.id}` });
          return;
        }
        
        console.log('✅ Case found in data manager:', caseExists.name);
      } catch (checkError) {
        console.error('❌ Error checking case existence:', checkError);
        setErrors({ general: 'Error verifying case data. Please try again.' });
        return;
      }
    }

    const itemData = {
      description: formData.description,
      name: formData.description, // For backward compatibility
      location: formData.location,
      accountNumber: formData.accountNumber,
      amount: parseFloat(formData.amount.toString()) || 0,
      frequency: formData.frequency,
      owner: formData.owner,
      verificationStatus: formData.verificationStatus as "Needs VR" | "VR Pending" | "AVS Pending" | "Verified",
      verificationSource: formData.verificationSource,
      notes: formData.notes,
      dateAdded: formData.dateAdded,
    };

    try {
      let updatedCase: CaseDisplay;
      
      if (isEditing && formData.id) {
        // Update existing item
        updatedCase = await dataManager.updateItem(caseData.id, itemType, formData.id, itemData);
        toast.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} item updated successfully`);
      } else {
        // Add new item
        console.log('🔍 Adding financial item:', {
          caseId: caseData.id,
          itemType,
          dataManagerType: 'DataManager'
        });
        
        updatedCase = await dataManager.addItem(caseData.id, itemType, itemData);
        toast.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} item added successfully`);
      }

      onUpdateCase(updatedCase);

      // DataManager handles file system persistence automatically

      if (addAnother && !isEditing) {
        // Reset form for another item
        setFormData({
          id: null,
          description: '',
          location: '',
          accountNumber: '',
          amount: 0,
          frequency: 'monthly',
          owner: 'applicant',
          verificationStatus: 'Needs VR',
          verificationSource: '',
          notes: '',
          dateAdded: new Date().toISOString(),
        });
        setErrors({});
        toast.info("Ready to add another item");
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to save financial item:', error);
      const errorMsg = `Failed to ${isEditing ? 'update' : 'save'} item. Please try again.`;
      setErrors({ general: errorMsg });
      toast.error(errorMsg);
    }
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
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
          {errors.general && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {errors.general}
            </div>
          )}
          
          {/* Row 1: Description and Location/Institution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Item Name *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder={placeholders.description}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.description}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location/Institution</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => updateFormData('location', e.target.value)}
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
                onChange={(e) => updateFormData('accountNumber', e.target.value)}
                placeholder="Last 4 digits: 1234"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => updateFormData('amount', e.target.value)}
                min="0"
                step="0.01"
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.amount}
                </div>
              )}
            </div>

            {(itemType === 'income' || itemType === 'expenses') && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => updateFormData('frequency', value)}
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
                onValueChange={(value) => updateFormData('verificationStatus', value)}
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
                onChange={(e) => updateFormData('verificationSource', e.target.value)}
                placeholder="e.g., Bank Statement 05/2025, Award Letter"
                disabled={formData.verificationStatus !== 'Verified'}
                className={`${
                  formData.verificationStatus !== 'Verified' 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                } ${errors.verificationSource ? 'border-destructive' : ''}`}
              />
              {errors.verificationSource && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errors.verificationSource}
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
                  onValueChange={(value) => updateFormData('owner', value)}
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
              onChange={(e) => updateFormData('notes', e.target.value)}
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
                onCheckedChange={(checked) => setAddAnother(checked === true)}
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
          <Button type="submit" onClick={handleSave}>
            {isEditing ? 'Update Item' : 'Save Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FinancialItemModal;