import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { FileText, Calendar, Flag, Check, X, FileSearch, Copy } from "lucide-react";
import { NewCaseRecordData, VoterFormStatus } from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { isoToDateInputValue, dateInputValueToISO, formatDateForDisplay } from "@/domain/common";
import { generateAvsNarrative } from "@/domain/cases";
import { clickToCopy } from "../../utils/clipboard";

const VOTER_STATUSES: { value: string; label: string }[] = [
  { value: "none", label: "Not Set" },
  { value: "requested", label: "Requested" },
  { value: "declined", label: "Declined" },
  { value: "not_answered", label: "Not Answered" },
];

const VOTER_STATUS_LABELS: Record<VoterFormStatus, string> = {
  requested: "Requested",
  declined: "Declined",
  not_answered: "Not Answered",
  "": "Not Set",
};

interface CaseColumnProps {
  caseData: NewCaseRecordData;
  retroRequested: boolean;
  isEditing: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
  onRetroRequestedChange: (value: boolean) => void;
}

// Read-only info display component
function InfoItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />}
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// Checklist item for read-only flags
function ChecklistItem({
  label,
  checked,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50" />
      )}
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

export function CaseColumn({
  caseData,
  retroRequested,
  isEditing,
  onCaseDataChange,
  onRetroRequestedChange,
}: CaseColumnProps) {
  const { config } = useCategoryConfig();

  const { caseTypes, applicationTypes, caseStatuses } = useMemo(() => ({
    caseTypes: config.caseTypes,
    applicationTypes: config.applicationTypes,
    caseStatuses: config.caseStatuses,
  }), [config]);

  // Use domain formatDateForDisplay - returns "None" for empty values
  const formatDate = (dateString?: string) => {
    const formatted = formatDateForDisplay(dateString);
    return formatted === "None" ? null : formatted;
  };

  const handleCopyNarrative = useCallback(() => {
    const narrative = generateAvsNarrative({ avsConsentDate: caseData.avsConsentDate });
    clickToCopy(narrative, {
      successMessage: "AVS narrative copied to clipboard",
      errorMessage: "Failed to copy narrative",
    });
  }, [caseData.avsConsentDate]);

  if (!isEditing) {
    // Read-only view
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Case Information
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyNarrative}
              className="h-7 px-2"
            >
              <Copy className="h-3 w-3 mr-1" />
              AVS
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Application Validated */}
          <div className="space-y-2">
            <ChecklistItem label="Application Validated" checked={caseData.appValidated} />
          </div>

          <Separator />

          {/* Case Identification */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Case Identification</h4>
            <div className="grid grid-cols-3 gap-3">
              <InfoItem label="MCN" value={caseData.mcn} />
              <InfoItem label="Case Type" value={caseData.caseType} />
              <InfoItem label="App Type" value={caseData.applicationType} />
              <InfoItem label="Application Date" value={formatDate(caseData.applicationDate)} icon={Calendar} />
              <div className="flex items-start gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div className="mt-0.5">
                    <Badge variant="outline">{caseData.status}</Badge>
                  </div>
                </div>
              </div>
              <InfoItem label="AVS Consent" value={formatDate(caseData.avsConsentDate)} icon={Calendar} />
              <InfoItem
                label="Voter Form"
                value={caseData.voterFormStatus ? VOTER_STATUS_LABELS[caseData.voterFormStatus] : null}
              />
            </div>
          </div>

          <Separator />

          {/* Case Flags */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Case Flags</h4>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <ChecklistItem label="Priority Case" checked={caseData.priority} />
              <ChecklistItem label="With Waiver" checked={caseData.withWaiver} />
              <ChecklistItem label="Retro Requested" checked={retroRequested} />
            </div>
          </div>

          <Separator />

          {/* Verification Reviews */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Reviews</h4>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ChecklistItem label="VRs" checked={caseData.reviewVRs} />
              <ChecklistItem label="Prior Budgets" checked={caseData.reviewPriorBudgets} />
              <ChecklistItem label="Prior Narratives" checked={caseData.reviewPriorNarr} />
              <ChecklistItem label="Interfaces" checked={caseData.interfacesReviewed} />
              <ChecklistItem label="AVS Submitted" checked={caseData.avsSubmitted} />
            </div>
          </div>

          {/* Retro Months - shown only when retro is requested */}
          {retroRequested && caseData.retroMonths && caseData.retroMonths.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Retro Months</span>
                <p className="text-sm font-medium">{caseData.retroMonths.join(", ")}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Case Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Application Validated */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="appValidated"
              checked={caseData.appValidated ?? false}
              onCheckedChange={(checked) => onCaseDataChange("appValidated", checked)}
            />
            <Label htmlFor="appValidated" className="text-sm">Application Validated</Label>
          </div>
        </div>

        <Separator />

        {/* Case Identification */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Case Identification</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mcn" className="text-xs">MCN *</Label>
              <Input
                id="mcn"
                value={caseData.mcn}
                onChange={(e) => onCaseDataChange('mcn', e.target.value)}
                placeholder="Enter MCN"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caseType" className="text-xs">Case Type</Label>
              <Select
                value={caseData.caseType}
                onValueChange={(value) => onCaseDataChange('caseType', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="applicationType" className="text-xs">App Type</Label>
              <Select
                value={caseData.applicationType || ""}
                onValueChange={(value) => onCaseDataChange('applicationType', value || undefined)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {applicationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="applicationDate" className="text-xs">Application Date *</Label>
              <Input
                id="applicationDate"
                type="date"
                value={isoToDateInputValue(caseData.applicationDate)}
                onChange={(e) => onCaseDataChange('applicationDate', dateInputValueToISO(e.target.value) || '')}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <Select
                value={caseData.status}
                onValueChange={(value) => onCaseDataChange('status', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseStatuses.map((status) => (
                    <SelectItem key={status.name} value={status.name}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="avsConsentDate" className="text-xs">AVS Consent Date</Label>
              <Input
                id="avsConsentDate"
                type="date"
                value={isoToDateInputValue(caseData.avsConsentDate ?? "")}
                onChange={(e) => onCaseDataChange("avsConsentDate", dateInputValueToISO(e.target.value) || "")}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voterFormStatus" className="text-xs">Voter Form</Label>
              <Select
                value={caseData.voterFormStatus || "none"}
                onValueChange={(value) => onCaseDataChange("voterFormStatus", value === "none" ? "" : value as VoterFormStatus)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOTER_STATUSES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Case Flags */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Case Flags</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priority"
                checked={caseData.priority ?? false}
                onCheckedChange={(checked) => onCaseDataChange('priority', checked)}
              />
              <Label htmlFor="priority" className="text-sm">Priority Case</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="withWaiver"
                checked={caseData.withWaiver ?? false}
                onCheckedChange={(checked) => onCaseDataChange('withWaiver', checked)}
              />
              <Label htmlFor="withWaiver" className="text-sm">With Waiver</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="retroRequested"
                checked={retroRequested}
                onCheckedChange={(checked) => onRetroRequestedChange(checked === true)}
              />
              <Label htmlFor="retroRequested" className="text-sm">Retro Requested</Label>
            </div>
            {/* Retro Months Input - shown only when retro is requested */}
            {retroRequested && (
              <div className="space-y-1 mt-2">
                <Label htmlFor="retroMonthsInput" className="text-xs">Retro Months</Label>
                <Input
                  id="retroMonthsInput"
                  value={(caseData.retroMonths ?? []).join(", ")}
                  onChange={(e) => {
                    const value = e.target.value;
                    const months = value.split(",").map(m => m.trim()).filter(m => m.length > 0);
                    onCaseDataChange('retroMonths', months);
                  }}
                  placeholder="e.g., Jan, Feb, Mar"
                  className="h-8"
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Verification Reviews */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Reviews</h4>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reviewVRs"
                checked={caseData.reviewVRs ?? false}
                onCheckedChange={(checked) => onCaseDataChange("reviewVRs", checked)}
              />
              <Label htmlFor="reviewVRs" className="text-sm">VRs</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reviewPriorBudgets"
                checked={caseData.reviewPriorBudgets ?? false}
                onCheckedChange={(checked) => onCaseDataChange("reviewPriorBudgets", checked)}
              />
              <Label htmlFor="reviewPriorBudgets" className="text-sm">Prior Budgets</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reviewPriorNarr"
                checked={caseData.reviewPriorNarr ?? false}
                onCheckedChange={(checked) => onCaseDataChange("reviewPriorNarr", checked)}
              />
              <Label htmlFor="reviewPriorNarr" className="text-sm">Prior Narratives</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="interfacesReviewed"
                checked={caseData.interfacesReviewed ?? false}
                onCheckedChange={(checked) => onCaseDataChange("interfacesReviewed", checked)}
              />
              <Label htmlFor="interfacesReviewed" className="text-sm">Interfaces</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="avsSubmitted"
                checked={caseData.avsSubmitted ?? false}
                onCheckedChange={(checked) => onCaseDataChange("avsSubmitted", checked)}
              />
              <Label htmlFor="avsSubmitted" className="text-sm">AVS Submitted</Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

