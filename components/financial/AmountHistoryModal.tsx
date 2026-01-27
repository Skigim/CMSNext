import { useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { History, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { AmountHistoryEntry, FinancialItem, CaseCategory } from "@/types/case";
import { formatCurrency } from "@/domain/common";
import {
  sortHistoryEntries,
  formatHistoryDate,
  getFirstOfMonth,
} from "@/domain/financials";

interface AmountHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: FinancialItem;
  itemType: CaseCategory;
  onAddEntry: (entry: Omit<AmountHistoryEntry, "id" | "createdAt">) => Promise<void>;
  onUpdateEntry: (
    entryId: string,
    updates: Partial<Omit<AmountHistoryEntry, "id" | "createdAt">>
  ) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  /** Delete the entire financial item (with all history) */
  onDeleteItem?: () => Promise<void>;
}

interface EntryFormData {
  amount: string;
  startDate: string;
  endDate: string;
  verificationStatus: string;
  verificationSource: string;
}

const emptyFormData: EntryFormData = {
  amount: "",
  startDate: "",
  endDate: "",
  verificationStatus: "Needs VR",
  verificationSource: "",
};

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // If it's already YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // If it contains a timestamp portion, extract just the date part
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr;
}

function parseDateInput(dateStr: string): string {
  if (!dateStr) return "";
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return "";
  }
  return dateStr;
}

export function AmountHistoryModal({
  isOpen,
  onClose,
  item,
  itemType,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteItem,
}: AmountHistoryModalProps) {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState<EntryFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isConfirmingItemDelete, setIsConfirmingItemDelete] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const history = item.amountHistory ?? [];
  const sortedHistory = sortHistoryEntries(history);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setEditingEntryId(null);
    setIsAddingNew(false);
    setDeleteConfirmId(null);
    setIsConfirmingItemDelete(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleStartAdd = useCallback(() => {
    // Pre-fill with first of current month and item's current verification status
    const firstOfMonth = getFirstOfMonth();
    setFormData({
      amount: "",
      startDate: formatDateForInput(firstOfMonth),
      endDate: "",
      verificationStatus: item.verificationStatus ?? "Needs VR",
      verificationSource: "",
    });
    setIsAddingNew(true);
    setEditingEntryId(null);
  }, [item.verificationStatus]);

  const handleStartEdit = useCallback((entry: AmountHistoryEntry) => {
    setFormData({
      amount: entry.amount.toString(),
      startDate: formatDateForInput(entry.startDate),
      endDate: formatDateForInput(entry.endDate),
      verificationStatus: entry.verificationStatus ?? item.verificationStatus ?? "Needs VR",
      verificationSource: entry.verificationSource ?? "",
    });
    setEditingEntryId(entry.id);
    setIsAddingNew(false);
  }, [item.verificationStatus]);

  const handleCancelEdit = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleFieldChange = useCallback(
    (field: keyof EntryFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmitEntry = useCallback(async () => {
    const amount = parseFloat(formData.amount);
    if (Number.isNaN(amount)) {
      return; // TODO: show validation error
    }

    const startDate = parseDateInput(formData.startDate);
    if (!startDate) {
      return; // TODO: show validation error
    }

    const endDate = formData.endDate ? parseDateInput(formData.endDate) : null;

    setIsSubmitting(true);
    try {
      if (isAddingNew) {
        await onAddEntry({
          amount,
          startDate,
          endDate,
          verificationStatus: formData.verificationStatus || undefined,
          verificationSource: formData.verificationSource || undefined,
        });
      } else if (editingEntryId) {
        await onUpdateEntry(editingEntryId, {
          amount,
          startDate,
          endDate,
          verificationStatus: formData.verificationStatus || undefined,
          verificationSource: formData.verificationSource || undefined,
        });
      }
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    isAddingNew,
    editingEntryId,
    onAddEntry,
    onUpdateEntry,
    resetForm,
  ]);

  const handleDeleteClick = useCallback((entryId: string) => {
    setDeleteConfirmId(entryId);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    
    setIsSubmitting(true);
    try {
      await onDeleteEntry(deleteConfirmId);
      setDeleteConfirmId(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteConfirmId, onDeleteEntry]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleDeleteItemClick = useCallback(() => {
    setIsConfirmingItemDelete(true);
  }, []);

  const handleCancelItemDelete = useCallback(() => {
    setIsConfirmingItemDelete(false);
  }, []);

  const handleConfirmItemDelete = useCallback(async () => {
    if (!onDeleteItem) return;
    setIsDeletingItem(true);
    try {
      await onDeleteItem();
      handleClose();
    } finally {
      setIsDeletingItem(false);
    }
  }, [onDeleteItem, handleClose]);

  const isEditing = isAddingNew || editingEntryId !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent data-papercut-context="AmountHistory" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Amount History
          </DialogTitle>
          <DialogDescription>
            Track historical amounts for &quot;{item.description}&quot; with date ranges and
            verification sources.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Entry Button */}
          {!isEditing && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStartAdd}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Entry
              </Button>
            </div>
          )}

          {/* Add/Edit Form */}
          {isEditing && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <h4 className="font-medium text-sm">
                {isAddingNew ? "New Entry" : "Edit Entry"}
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="history-amount" className="text-sm">
                    Amount *
                  </Label>
                  <Input
                    id="history-amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleFieldChange("amount", e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="history-status" className="text-sm">
                    Verification Status
                  </Label>
                  <Select
                    value={formData.verificationStatus}
                    onValueChange={(value) => handleFieldChange("verificationStatus", value)}
                  >
                    <SelectTrigger id="history-status" className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Needs VR">Needs VR</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Verified">Verified</SelectItem>
                      <SelectItem value="Unable to Verify">Unable to Verify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="history-verification" className="text-sm">
                    Verification Source
                  </Label>
                  <Input
                    id="history-verification"
                    type="text"
                    value={formData.verificationSource}
                    onChange={(e) =>
                      handleFieldChange("verificationSource", e.target.value)
                    }
                    placeholder="e.g., Bank Statement 05/2025"
                    className="mt-1"
                  />
                </div>

                <div />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="history-start" className="text-sm">
                    Start Date *
                  </Label>
                  <Input
                    id="history-start"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleFieldChange("startDate", e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="history-end" className="text-sm">
                    End Date
                  </Label>
                  <Input
                    id="history-end"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleFieldChange("endDate", e.target.value)}
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
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmitEntry}
                  disabled={isSubmitting || !formData.amount || !formData.startDate}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isAddingNew ? "Add" : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* History Table */}
          {sortedHistory.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
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
                            <span className="text-muted-foreground italic"> – Ongoing</span>
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
                              onClick={handleConfirmDelete}
                              disabled={isSubmitting}
                              aria-label="Confirm delete"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={handleCancelDelete}
                              disabled={isSubmitting}
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
                              onClick={() => handleStartEdit(entry)}
                              disabled={isEditing}
                              aria-label="Edit entry"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(entry.id)}
                              disabled={isEditing}
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
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No amount history recorded yet.</p>
              <p className="text-sm">
                Add entries to track how this {itemType.slice(0, -1)}&apos;s value has
                changed over time.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-4 pt-4 border-t sm:flex-row sm:justify-between">
          {onDeleteItem && (
            <div className="flex items-center gap-3">
              {isConfirmingItemDelete ? (
                <>
                  <span className="text-sm text-destructive font-medium">Delete this item and all history?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleConfirmItemDelete}
                    disabled={isDeletingItem}
                  >
                    {isDeletingItem ? "Deleting..." : "Yes, Delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelItemDelete}
                    disabled={isDeletingItem}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteItemClick}
                  disabled={isEditing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </Button>
              )}
            </div>
          )}
          <Button type="button" variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
