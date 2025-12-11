import { FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Check, X, History } from "lucide-react";
import type { CaseCategory } from "../../types/case";
import { parseNumericInput } from "../../utils/financialFormatters";
import type { NormalizedFinancialFormData } from "./useFinancialItemCardState";

interface FinancialItemCardFormProps {
  itemId: string;
  itemType: CaseCategory;
  formData: NormalizedFinancialFormData;
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
  onFieldChange,
  onCancel,
  onSubmit,
  hasAmountHistory = false,
  onOpenHistoryModal,
}: FinancialItemCardFormProps) {
  const frequencyFieldId = `frequency-${itemId}`;
  const descriptionFieldId = `description-${itemId}`;
  const amountFieldId = `amount-${itemId}`;
  const locationFieldId = `location-${itemId}`;
  const accountFieldId = `accountNumber-${itemId}`;
  const notesFieldId = `notes-${itemId}`;
  const verificationStatusFieldId = `verificationStatus-${itemId}`;
  const verificationSourceFieldId = `verificationSource-${itemId}`;

  const isVerified = formData.verificationStatus === 'Verified';

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
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor={amountFieldId} className="text-sm font-medium text-foreground">
              Amount
            </Label>
            {onOpenHistoryModal && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenHistoryModal}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="mr-1 h-3 w-3" />
                {hasAmountHistory ? "View History" : "Add History"}
              </Button>
            )}
          </div>
          <Input
            type="number"
            id={amountFieldId}
            value={formData.amount ?? 0}
            onChange={event => onFieldChange("amount", parseNumericInput(event.target.value))}
            step="0.01"
            className="w-full"
          />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={verificationStatusFieldId} className="mb-1 block text-sm font-medium text-foreground">
            Verification Status
          </Label>
          <Select
            value={formData.verificationStatus ?? "Needs VR"}
            onValueChange={value => onFieldChange("verificationStatus", value)}
          >
            <SelectTrigger>
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

        <div>
          <Label htmlFor={verificationSourceFieldId} className="mb-1 block text-sm font-medium text-foreground">
            Verification Source
          </Label>
          <Input
            type="text"
            id={verificationSourceFieldId}
            value={formData.verificationSource ?? ""}
            onChange={event => onFieldChange("verificationSource", event.target.value)}
            className="w-full"
            placeholder={isVerified ? "e.g., Bank Statement, Paystub" : "Set status to Verified to enable"}
            disabled={!isVerified}
          />
        </div>
      </div>

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
