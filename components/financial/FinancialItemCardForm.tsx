import { FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Check, X, History } from "lucide-react";
import type { CaseCategory } from "../../types/case";
import type { NormalizedFinancialFormData, FormErrors } from "./useFinancialItemCardState";

interface FinancialItemCardFormProps {
  itemId: string;
  itemType: CaseCategory;
  formData: NormalizedFinancialFormData;
  formErrors?: FormErrors;
  onFieldChange: (field: string, value: string | number) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  hasAmountHistory?: boolean;
  onOpenHistoryModal?: () => void;
}

export function FinancialItemCardForm({
  itemId,
  itemType,
  formData,
  formErrors = {},
  onFieldChange,
  onCancel,
  onSubmit,
  hasAmountHistory = false,
  onOpenHistoryModal,
}: FinancialItemCardFormProps) {
  const frequencyFieldId = `frequency-${itemId}`;
  const descriptionFieldId = `description-${itemId}`;
  const locationFieldId = `location-${itemId}`;
  const accountFieldId = `accountNumber-${itemId}`;
  const notesFieldId = `notes-${itemId}`;

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t bg-muted/20 p-4">
      <div>
        <Label htmlFor={descriptionFieldId} className="mb-1 block text-sm font-medium text-foreground">
          Description
        </Label>
        <Input
          type="text"
          id={descriptionFieldId}
          value={formData.description ?? ""}
          onChange={event => onFieldChange("description", event.target.value)}
          className={`w-full ${formErrors.description ? "border-destructive" : ""}`}
        />
        {formErrors.description && (
          <p className="mt-1 text-sm text-destructive">{formErrors.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={locationFieldId} className="mb-1 block text-sm font-medium text-foreground">
            Institution/Location
          </Label>
          <Input
            type="text"
            id={locationFieldId}
            value={formData.location ?? ""}
            onChange={event => onFieldChange("location", event.target.value)}
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor={accountFieldId} className="mb-1 block text-sm font-medium text-foreground">
            Account Number
          </Label>
          <Input
            type="text"
            id={accountFieldId}
            value={formData.accountNumber ?? ""}
            onChange={event => onFieldChange("accountNumber", event.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {itemType !== "resources" && (
        <div>
          <Label htmlFor={frequencyFieldId} className="mb-1 block text-sm font-medium text-foreground">
            Frequency
          </Label>
          <Select
            value={formData.frequency}
            onValueChange={value => onFieldChange("frequency", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time">One-time</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor={notesFieldId} className="mb-1 block text-sm font-medium text-foreground">
          Notes
        </Label>
        <Textarea
          id={notesFieldId}
          value={formData.notes ?? ""}
          onChange={event => onFieldChange("notes", event.target.value)}
          className="min-h-[60px] w-full resize-y"
          placeholder="Add any relevant notes..."
        />
      </div>

      {/* Amount & Verification managed via History Modal */}
      {onOpenHistoryModal && (
        <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Amount & Verification</span>
              <p className="text-xs">Manage amounts and verification status per time period</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenHistoryModal}
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              {hasAmountHistory ? "Manage History" : "Add Entry"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex items-center gap-2">
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" className="flex items-center gap-2">
          <Check className="h-4 w-4" />
          Save
        </Button>
      </div>
    </form>
  );
}
