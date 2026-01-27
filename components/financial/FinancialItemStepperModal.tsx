import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import type { AmountHistoryEntry, FinancialItem, CaseCategory } from "@/types/case";
import { formatCurrency, isoToDateInputValue } from "@/domain/common";
import {
  sortHistoryEntries,
  formatHistoryDate,
  getFirstOfMonth,
  createHistoryEntry,
} from "@/domain/financials";
import { cn } from "../ui/utils";

// ============================================================================
// Types
// ============================================================================

interface FinancialItemStepperModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: CaseCategory;
  /** Existing item for editing, undefined for creating new */
  item?: FinancialItem;
  /** For LTC cases that need owner field */
  showOwnerField?: boolean;
  // Callbacks
  onSave: (itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate?: (itemId: string, updates: Partial<FinancialItem>) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
}

interface ItemFormData {
  description: string;
  location: string;
  accountNumber: string;
  frequency: string;
  owner: string;
  notes: string;
}

interface EntryFormData {
  amount: string;
  startDate: string;
  endDate: string;
  verificationStatus: string;
  verificationSource: string;
}

interface FormErrors {
  description?: string;
  amount?: string;
  startDate?: string;
}

type Step = "details" | "amounts";

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: "details", label: "Item Details", description: "Basic information" },
  { id: "amounts", label: "Amount & Verification", description: "Financial data" },
];

// ============================================================================
// Helper Functions
// ============================================================================

const emptyItemFormData: ItemFormData = {
  description: "",
  location: "",
  accountNumber: "",
  frequency: "monthly",
  owner: "applicant",
  notes: "",
};

const emptyEntryFormData: EntryFormData = {
  amount: "",
  startDate: "",
  endDate: "",
  verificationStatus: "Needs VR",
  verificationSource: "",
};

function getPlaceholders(itemType: CaseCategory) {
  const placeholders = {
    resources: {
      description: "e.g., Checking Account, Savings Account, CD",
      location: "e.g., Bank of America, Wells Fargo",
    },
    income: {
      description: "e.g., Social Security, Pension, Employment",
      location: "e.g., SSA, ABC Company, State Retirement",
    },
    expenses: {
      description: "e.g., Medicare Part B, Rent, Utilities",
      location: "e.g., Medicare, Landlord Name, Electric Company",
    },
  };
  return placeholders[itemType] || placeholders.resources;
}

// ============================================================================
// Sub-Components
// ============================================================================

function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: typeof STEPS;
  currentStep: Step;
  onStepClick?: (step: Step) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = index < currentIndex;
        const isClickable = onStepClick && (isCompleted || index === currentIndex);

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive && "bg-primary text-primary-foreground",
                isCompleted && "bg-primary/20 text-primary hover:bg-primary/30",
                !isActive && !isCompleted && "bg-muted text-muted-foreground",
                isClickable && "cursor-pointer",
                !isClickable && "cursor-default"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  isActive && "bg-primary-foreground text-primary",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "bg-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FinancialItemStepperModal({
  isOpen,
  onClose,
  itemType,
  item,
  showOwnerField = false,
  onSave,
  onUpdate,
  onDelete,
}: FinancialItemStepperModalProps) {
  const isEditing = Boolean(item);

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>("details");

  // Form data
  const [itemFormData, setItemFormData] = useState<ItemFormData>(() =>
    item
      ? {
          description: item.description || item.name || "",
          location: item.location || "",
          accountNumber: item.accountNumber || "",
          frequency: item.frequency || "monthly",
          owner: item.owner || "applicant",
          notes: item.notes || "",
        }
      : emptyItemFormData
  );

  // History entries (local state for new items, derived from item for editing)
  const [localHistoryEntries, setLocalHistoryEntries] = useState<AmountHistoryEntry[]>(
    () => item?.amountHistory ?? []
  );

  // Entry form state
  const [entryFormData, setEntryFormData] = useState<EntryFormData>(emptyEntryFormData);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Errors and submission state
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const placeholders = getPlaceholders(itemType);
  const sortedHistory = useMemo(
    () => sortHistoryEntries(localHistoryEntries),
    [localHistoryEntries]
  );

  // ============================================================================
  // Sync State When Item Prop Changes (prevents stale data)
  // ============================================================================

  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens or item changes
      setCurrentStep("details");
      setItemFormData(
        item
          ? {
              description: item.description || item.name || "",
              location: item.location || "",
              accountNumber: item.accountNumber || "",
              frequency: item.frequency || "monthly",
              owner: item.owner || "applicant",
              notes: item.notes || "",
            }
          : emptyItemFormData
      );
      setLocalHistoryEntries(item?.amountHistory ?? []);
      setEntryFormData(emptyEntryFormData);
      setEditingEntryId(null);
      setIsAddingEntry(false);
      setFormErrors({});
      setIsConfirmingDelete(false);
      setDeleteConfirmId(null);
    }
  }, [isOpen, item]);

  // ============================================================================
  // Handlers - Item Form
  // ============================================================================

  const handleItemFieldChange = useCallback(
    (field: keyof ItemFormData, value: string) => {
      setItemFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error when field changes
      if (formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  const validateDetailsStep = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (!itemFormData.description.trim()) {
      errors.description = "Description is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [itemFormData.description]);

  // ============================================================================
  // Handlers - Entry Form
  // ============================================================================

  const handleEntryFieldChange = useCallback(
    (field: keyof EntryFormData, value: string) => {
      setEntryFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleStartAddEntry = useCallback(() => {
    setEntryFormData({
      amount: "",
      startDate: isoToDateInputValue(getFirstOfMonth()),
      endDate: "",
      verificationStatus: "Needs VR",
      verificationSource: "",
    });
    setIsAddingEntry(true);
    setEditingEntryId(null);
  }, []);

  const handleStartEditEntry = useCallback((entry: AmountHistoryEntry) => {
    setEntryFormData({
      amount: entry.amount.toString(),
      startDate: isoToDateInputValue(entry.startDate),
      endDate: isoToDateInputValue(entry.endDate),
      verificationStatus: entry.verificationStatus ?? "Needs VR",
      verificationSource: entry.verificationSource ?? "",
    });
    setEditingEntryId(entry.id);
    setIsAddingEntry(false);
  }, []);

  const handleCancelEntryEdit = useCallback(() => {
    setEntryFormData(emptyEntryFormData);
    setEditingEntryId(null);
    setIsAddingEntry(false);
  }, []);

  const handleSaveEntry = useCallback(() => {
    const amount = parseFloat(entryFormData.amount);
    if (Number.isNaN(amount) || !entryFormData.startDate) {
      return;
    }

    if (isAddingEntry) {
      // Use domain function for proper UUID generation
      const newEntry = createHistoryEntry(amount, entryFormData.startDate, {
        endDate: entryFormData.endDate || null,
        verificationStatus: entryFormData.verificationStatus || undefined,
        verificationSource: entryFormData.verificationSource || undefined,
      });
      setLocalHistoryEntries((prev) => [...prev, newEntry]);
    } else if (editingEntryId) {
      // For edits, preserve the existing ID
      const updatedEntry: AmountHistoryEntry = {
        id: editingEntryId,
        amount,
        startDate: entryFormData.startDate,
        endDate: entryFormData.endDate || null,
        verificationStatus: entryFormData.verificationStatus || undefined,
        verificationSource: entryFormData.verificationSource || undefined,
        createdAt: new Date().toISOString(),
      };
      setLocalHistoryEntries((prev) =>
        prev.map((e) => (e.id === editingEntryId ? updatedEntry : e))
      );
    }

    handleCancelEntryEdit();
  }, [entryFormData, editingEntryId, isAddingEntry, handleCancelEntryEdit]);

  const handleDeleteEntry = useCallback((entryId: string) => {
    setLocalHistoryEntries((prev) => prev.filter((e) => e.id !== entryId));
    setDeleteConfirmId(null);
  }, []);

  // ============================================================================
  // Navigation
  // ============================================================================

  const handleNext = useCallback(() => {
    if (currentStep === "details") {
      if (validateDetailsStep()) {
        setCurrentStep("amounts");
      }
    }
  }, [currentStep, validateDetailsStep]);

  const handleBack = useCallback(() => {
    if (currentStep === "amounts") {
      setCurrentStep("details");
    }
  }, [currentStep]);

  const handleStepClick = useCallback(
    (step: Step) => {
      if (step === "amounts" && currentStep === "details") {
        if (validateDetailsStep()) {
          setCurrentStep(step);
        }
      } else if (step === "details") {
        setCurrentStep(step);
      }
    },
    [currentStep, validateDetailsStep]
  );

  // ============================================================================
  // Save & Close
  // ============================================================================

  const handleSave = useCallback(async () => {
    if (!validateDetailsStep()) {
      setCurrentStep("details");
      return;
    }

    // Must have at least one history entry
    if (localHistoryEntries.length === 0) {
      setFormErrors({ amount: "Add at least one amount entry" });
      return;
    }

    setIsSubmitting(true);
    try {
      const itemData: Omit<FinancialItem, "id" | "createdAt" | "updatedAt"> = {
        description: itemFormData.description.trim(),
        location: itemFormData.location.trim() || undefined,
        accountNumber: itemFormData.accountNumber.trim() || undefined,
        frequency: itemFormData.frequency,
        owner: showOwnerField ? itemFormData.owner : undefined,
        notes: itemFormData.notes.trim() || undefined,
        // Dynamic data stored in entries, item-level is deprecated
        amount: 0,
        verificationStatus: "Needs VR",
        amountHistory: localHistoryEntries,
        dateAdded: item?.dateAdded || new Date().toISOString(),
      };

      if (isEditing && item && onUpdate) {
        await onUpdate(item.id, itemData);
      } else {
        await onSave(itemData);
      }

      // Reset and close
      setCurrentStep("details");
      setItemFormData(emptyItemFormData);
      setLocalHistoryEntries([]);
      setEntryFormData(emptyEntryFormData);
      setEditingEntryId(null);
      setIsAddingEntry(false);
      setFormErrors({});
      setIsConfirmingDelete(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateDetailsStep,
    localHistoryEntries,
    itemFormData,
    showOwnerField,
    isEditing,
    item,
    onUpdate,
    onSave,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    // Reset state
    setCurrentStep("details");
    setItemFormData(emptyItemFormData);
    setLocalHistoryEntries([]);
    setEntryFormData(emptyEntryFormData);
    setEditingEntryId(null);
    setIsAddingEntry(false);
    setFormErrors({});
    setIsConfirmingDelete(false);
    onClose();
  }, [onClose]);

  const handleDeleteItem = useCallback(async () => {
    if (!item || !onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(item.id);
      // Reset and close
      setCurrentStep("details");
      setItemFormData(emptyItemFormData);
      setLocalHistoryEntries([]);
      setEntryFormData(emptyEntryFormData);
      setEditingEntryId(null);
      setIsAddingEntry(false);
      setFormErrors({});
      setIsConfirmingDelete(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [item, onDelete, onClose]);

  const isEntryEditing = isAddingEntry || editingEntryId !== null;
  const canSave = itemFormData.description.trim() && localHistoryEntries.length > 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Add"}{" "}
            {itemType.charAt(0).toUpperCase() + itemType.slice(1, -1)} Item
          </DialogTitle>
          <DialogDescription>
            {currentStep === "details"
              ? "Enter the basic details for this financial item."
              : "Add amount entries with date ranges and verification."}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* Step 1: Item Details */}
        {currentStep === "details" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Input
                  id="description"
                  value={itemFormData.description}
                  onChange={(e) => handleItemFieldChange("description", e.target.value)}
                  placeholder={placeholders.description}
                  className={formErrors.description ? "border-destructive" : ""}
                />
                {formErrors.description && (
                  <div className="flex items-center gap-1 text-sm text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.description}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location/Institution</Label>
                <Input
                  id="location"
                  value={itemFormData.location}
                  onChange={(e) => handleItemFieldChange("location", e.target.value)}
                  placeholder={placeholders.location}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={itemFormData.accountNumber}
                  onChange={(e) => handleItemFieldChange("accountNumber", e.target.value)}
                  placeholder="Last 4 digits: 1234"
                />
              </div>

              {(itemType === "income" || itemType === "expenses") && (
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={itemFormData.frequency}
                    onValueChange={(value) => handleItemFieldChange("frequency", value)}
                  >
                    <SelectTrigger id="frequency">
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

              {showOwnerField && (
                <div className="space-y-2">
                  <Label htmlFor="owner">Owner</Label>
                  <Select
                    value={itemFormData.owner}
                    onValueChange={(value) => handleItemFieldChange("owner", value)}
                  >
                    <SelectTrigger id="owner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="applicant">Applicant</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="joint">Joint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={itemFormData.notes}
                onChange={(e) => handleItemFieldChange("notes", e.target.value)}
                placeholder="Additional notes about this item..."
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 2: Amount & Verification */}
        {currentStep === "amounts" && (
          <div className="space-y-4">
            {/* Add Entry Button */}
            {!isEntryEditing && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {localHistoryEntries.length === 0
                    ? "Add at least one amount entry to continue."
                    : `${localHistoryEntries.length} entry${localHistoryEntries.length !== 1 ? "ies" : ""}`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartAddEntry}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Entry
                </Button>
              </div>
            )}

            {/* Entry Form */}
            {isEntryEditing && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <h4 className="font-medium text-sm">
                  {isAddingEntry ? "New Entry" : "Edit Entry"}
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entry-amount" className="text-sm">
                      Amount *
                    </Label>
                    <Input
                      id="entry-amount"
                      type="number"
                      step="0.01"
                      value={entryFormData.amount}
                      onChange={(e) => handleEntryFieldChange("amount", e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="entry-status" className="text-sm">
                      Verification Status
                    </Label>
                    <Select
                      value={entryFormData.verificationStatus}
                      onValueChange={(value) =>
                        handleEntryFieldChange("verificationStatus", value)
                      }
                    >
                      <SelectTrigger id="entry-status" className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Needs VR">Needs VR</SelectItem>
                        <SelectItem value="VR Pending">VR Pending</SelectItem>
                        <SelectItem value="AVS Pending">AVS Pending</SelectItem>
                        <SelectItem value="Verified">Verified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entry-source" className="text-sm">
                      Verification Source
                    </Label>
                    <Input
                      id="entry-source"
                      value={entryFormData.verificationSource}
                      onChange={(e) =>
                        handleEntryFieldChange("verificationSource", e.target.value)
                      }
                      placeholder="e.g., Bank Statement 05/2025"
                      className="mt-1"
                      disabled={entryFormData.verificationStatus !== "Verified"}
                    />
                  </div>
                  <div />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entry-start" className="text-sm">
                      Effective From *
                    </Label>
                    <Input
                      id="entry-start"
                      type="date"
                      value={entryFormData.startDate}
                      onChange={(e) => handleEntryFieldChange("startDate", e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="entry-end" className="text-sm">
                      Until (optional)
                    </Label>
                    <Input
                      id="entry-end"
                      type="date"
                      value={entryFormData.endDate}
                      onChange={(e) => handleEntryFieldChange("endDate", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for ongoing
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEntryEdit}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveEntry}
                    disabled={!entryFormData.amount || !entryFormData.startDate}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {isAddingEntry ? "Add" : "Save"}
                  </Button>
                </div>
              </div>
            )}

            {/* Entry amount error */}
            {formErrors.amount && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                {formErrors.amount}
              </div>
            )}

            {/* History Table */}
            {sortedHistory.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatHistoryDate(entry.startDate)}
                            {entry.endDate ? (
                              <> – {formatHistoryDate(entry.endDate)}</>
                            ) : (
                              <span className="text-muted-foreground italic">
                                {" "}
                                – Ongoing
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.verificationStatus || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.verificationSource || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deleteConfirmId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDeleteEntry(entry.id)}
                                aria-label="Confirm delete"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setDeleteConfirmId(null)}
                                aria-label="Cancel delete"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleStartEditEntry(entry)}
                                disabled={isEntryEditing}
                                aria-label="Edit entry"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmId(entry.id)}
                                disabled={isEntryEditing}
                                aria-label="Delete entry"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {isEditing && onDelete && (
              <>
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive">Delete this item?</span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteItem}
                      disabled={isSubmitting}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isSubmitting}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep === "details" ? (
              <>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting || !canSave}
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEditing
                      ? "Update Item"
                      : "Save Item"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
