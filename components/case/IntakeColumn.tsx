import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { ClipboardCheck, Shield, FileSearch, Calendar, Check, X, Copy } from "lucide-react";
import { NewCaseRecordData, ContactMethod, VoterFormStatus } from "../../types/case";
import { isoToDateInputValue, dateInputValueToISO } from "@/domain/common";
import { clickToCopy } from "../../utils/clipboard";

interface IntakeColumnProps {
  caseData: NewCaseRecordData;
  avsConsentDate?: string;
  isEditing: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
}

// Constants
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CONTACT_METHODS: { value: ContactMethod; label: string }[] = [
  { value: "mail", label: "US Mail" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
];

const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  mail: "US Mail",
  text: "Text Message",
  email: "Email",
};

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
      <span className={checked ? "text-foreground text-sm" : "text-muted-foreground text-sm"}>
        {label}
      </span>
    </div>
  );
}

export function IntakeColumn({
  caseData,
  isEditing,
  onCaseDataChange,
}: IntakeColumnProps) {

  // Format dates for display
  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  }, []);

  // Generate AVS Narrative
  const generateAVSNarrative = useCallback(() => {
    const consentDate = formatDate(caseData.avsConsentDate) || "MM/DD/YYYY";
    const today = new Date();
    const submitDate = today.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    const fiveDay = new Date(today);
    fiveDay.setDate(today.getDate() + 5);
    const fiveDayDate = fiveDay.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    const elevenDay = new Date(today);
    elevenDay.setDate(today.getDate() + 11);
    const elevenDayDate = elevenDay.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    return `MLTC: AVS Submitted
Consent Date: ${consentDate}
Submit Date: ${submitDate}
5 Day: ${fiveDayDate}
11 Day: ${elevenDayDate}`;
  }, [caseData.avsConsentDate, formatDate]);

  const handleCopyNarrative = useCallback(() => {
    const narrative = generateAVSNarrative();
    clickToCopy(narrative, {
      successMessage: "AVS narrative copied to clipboard",
      errorMessage: "Failed to copy narrative",
    });
  }, [generateAVSNarrative]);

  // Contact methods display
  const contactMethodsDisplay = useMemo(() => {
    const methods = caseData.contactMethods ?? [];
    if (methods.length === 0) return null;
    return methods.map((m) => CONTACT_METHOD_LABELS[m] || m).join(", ");
  }, [caseData.contactMethods]);

  // Retro months display
  const retroMonthsDisplay = useMemo(() => {
    const months = caseData.retroMonths ?? [];
    if (months.length === 0) return null;
    return months.join(", ");
  }, [caseData.retroMonths]);

  // Calculate completion stats
  const checklistStats = useMemo(() => {
    const items = [
      caseData.appValidated,
      caseData.citizenshipVerified,
      caseData.residencyVerified,
      caseData.agedDisabledVerified,
      caseData.avsSubmitted,
      caseData.interfacesReviewed,
      caseData.reviewVRs,
      caseData.reviewPriorBudgets,
      caseData.reviewPriorNarr,
    ];
    const completed = items.filter(Boolean).length;
    return { completed, total: items.length };
  }, [caseData]);

  // Handlers for edit mode
  const handleContactMethodToggle = (method: ContactMethod, checked: boolean) => {
    const current = caseData.contactMethods ?? [];
    if (checked) {
      onCaseDataChange("contactMethods", [...current, method]);
    } else {
      onCaseDataChange("contactMethods", current.filter((m) => m !== method));
    }
  };

  const handleRetroMonthToggle = (month: string, checked: boolean) => {
    const current = caseData.retroMonths ?? [];
    if (checked) {
      onCaseDataChange("retroMonths", [...current, month]);
    } else {
      onCaseDataChange("retroMonths", current.filter((m) => m !== month));
    }
  };

  if (!isEditing) {
    // Read-only view
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Intake Checklist
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {checklistStats.completed}/{checklistStats.total}
              </Badge>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Initial Checks */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Initial Checks</h4>
            <div className="space-y-2">
              <ChecklistItem label="Application Validated" checked={caseData.appValidated} />
              <ChecklistItem label="Pregnancy" checked={caseData.pregnancy} />
              {retroMonthsDisplay && (
                <div className="pl-6">
                  <span className="text-xs text-muted-foreground">Retro Months: </span>
                  <span className="text-xs font-medium">{retroMonthsDisplay}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Applicant Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Applicant Details</h4>
            <div className="space-y-2">
              <InfoItem label="Marital Status" value={caseData.maritalStatus} />
              <InfoItem label="Contact Methods" value={contactMethodsDisplay} />
            </div>
          </div>

          <Separator />

          {/* Eligibility Verification */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Eligibility</h4>
            </div>
            <div className="space-y-2">
              <ChecklistItem label="Citizenship Verified" checked={caseData.citizenshipVerified} />
              <ChecklistItem label="Residency Verified" checked={caseData.residencyVerified} />
              <ChecklistItem label="Aged/Disabled Verified" checked={caseData.agedDisabledVerified} />
              <InfoItem label="AVS Consent Date" value={formatDate(caseData.avsConsentDate)} icon={Calendar} />
              <InfoItem
                label="Voter Form Status"
                value={caseData.voterFormStatus ? VOTER_STATUS_LABELS[caseData.voterFormStatus] : null}
              />
            </div>
          </div>

          <Separator />

          {/* Verification Reviews */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Reviews</h4>
            </div>
            <div className="space-y-2">
              <ChecklistItem label="VRs Reviewed" checked={caseData.reviewVRs} />
              <ChecklistItem label="Prior Budgets Reviewed" checked={caseData.reviewPriorBudgets} />
              <ChecklistItem label="Prior Narratives Reviewed" checked={caseData.reviewPriorNarr} />
              <ChecklistItem label="Interfaces Reviewed" checked={caseData.interfacesReviewed} />
              <ChecklistItem label="AVS Submitted" checked={caseData.avsSubmitted} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Intake Checklist
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {checklistStats.completed}/{checklistStats.total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Initial Checks */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Initial Checks</h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="appValidated"
                checked={caseData.appValidated ?? false}
                onCheckedChange={(checked) => onCaseDataChange("appValidated", checked)}
              />
              <Label htmlFor="appValidated" className="text-sm">Application Validated</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pregnancy"
                checked={caseData.pregnancy ?? false}
                onCheckedChange={(checked) => onCaseDataChange("pregnancy", checked)}
              />
              <Label htmlFor="pregnancy" className="text-sm">Pregnancy</Label>
            </div>
          </div>

          {/* Retro Months Grid */}
          <div className="space-y-1">
            <Label className="text-xs">Retro Months</Label>
            <div className="grid grid-cols-4 gap-1 p-2 border rounded-md bg-muted/30">
              {MONTHS.map((month) => (
                <div key={month} className="flex items-center space-x-1">
                  <Checkbox
                    id={`retro-${month}`}
                    checked={(caseData.retroMonths ?? []).includes(month)}
                    onCheckedChange={(checked) => handleRetroMonthToggle(month, checked === true)}
                  />
                  <Label htmlFor={`retro-${month}`} className="text-xs">{month}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Applicant Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Applicant Details</h4>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="maritalStatus" className="text-xs">Marital Status</Label>
              <Input
                id="maritalStatus"
                value={caseData.maritalStatus ?? ""}
                onChange={(e) => onCaseDataChange("maritalStatus", e.target.value)}
                placeholder="e.g., Single, Married"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Methods</Label>
              <div className="flex gap-3 p-2 border rounded-md bg-muted/30">
                {CONTACT_METHODS.map(({ value, label }) => (
                  <div key={value} className="flex items-center space-x-1">
                    <Checkbox
                      id={`contact-${value}`}
                      checked={(caseData.contactMethods ?? []).includes(value)}
                      onCheckedChange={(checked) => handleContactMethodToggle(value, checked === true)}
                    />
                    <Label htmlFor={`contact-${value}`} className="text-xs">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Eligibility Verification */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Eligibility</h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="citizenshipVerified"
                checked={caseData.citizenshipVerified ?? false}
                onCheckedChange={(checked) => onCaseDataChange("citizenshipVerified", checked)}
              />
              <Label htmlFor="citizenshipVerified" className="text-sm">Citizenship Verified</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="residencyVerified"
                checked={caseData.residencyVerified ?? false}
                onCheckedChange={(checked) => onCaseDataChange("residencyVerified", checked)}
              />
              <Label htmlFor="residencyVerified" className="text-sm">Residency Verified</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="agedDisabledVerified"
                checked={caseData.agedDisabledVerified ?? false}
                onCheckedChange={(checked) => onCaseDataChange("agedDisabledVerified", checked)}
              />
              <Label htmlFor="agedDisabledVerified" className="text-sm">Aged/Disabled Verified</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
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
        </div>

        <Separator />

        {/* Verification Reviews */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Reviews</h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reviewVRs"
                checked={caseData.reviewVRs ?? false}
                onCheckedChange={(checked) => onCaseDataChange("reviewVRs", checked)}
              />
              <Label htmlFor="reviewVRs" className="text-sm">VRs Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reviewPriorBudgets"
                checked={caseData.reviewPriorBudgets ?? false}
                onCheckedChange={(checked) => onCaseDataChange("reviewPriorBudgets", checked)}
              />
              <Label htmlFor="reviewPriorBudgets" className="text-sm">Prior Budgets Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="reviewPriorNarr"
                checked={caseData.reviewPriorNarr ?? false}
                onCheckedChange={(checked) => onCaseDataChange("reviewPriorNarr", checked)}
              />
              <Label htmlFor="reviewPriorNarr" className="text-sm">Prior Narratives Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="interfacesReviewed"
                checked={caseData.interfacesReviewed ?? false}
                onCheckedChange={(checked) => onCaseDataChange("interfacesReviewed", checked)}
              />
              <Label htmlFor="interfacesReviewed" className="text-sm">Interfaces Reviewed</Label>
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

export default IntakeColumn;
