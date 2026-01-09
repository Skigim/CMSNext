import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { NewCaseRecordData, ContactMethod, VoterFormStatus } from "../../types/case";
import { isoToDateInputValue, dateInputValueToISO } from "@/domain/common";

interface IntakeInfoFormProps {
  caseData: NewCaseRecordData;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const CONTACT_METHODS: { value: ContactMethod; label: string }[] = [
  { value: "mail", label: "US Mail" },
  { value: "text", label: "Text Message" },
  { value: "email", label: "Email" },
];

const VOTER_STATUSES: { value: string; label: string }[] = [
  { value: "none", label: "Not Set" },
  { value: "requested", label: "Requested" },
  { value: "declined", label: "Declined" },
  { value: "not_answered", label: "Not Answered" },
];

export function IntakeInfoForm({ caseData, onCaseDataChange }: IntakeInfoFormProps) {
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

  return (
    <div className="space-y-6">
      {/* Initial Checks */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Initial Checks</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="appValidated"
              checked={caseData.appValidated ?? false}
              onCheckedChange={(checked) => onCaseDataChange("appValidated", checked)}
            />
            <Label htmlFor="appValidated">
              Application Validated (Name, Address, Signature provided)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="pregnancy"
              checked={caseData.pregnancy ?? false}
              onCheckedChange={(checked) => onCaseDataChange("pregnancy", checked)}
            />
            <Label htmlFor="pregnancy">Pregnancy</Label>
          </div>

          {/* Retro Months */}
          <div className="space-y-2">
            <Label>Retroactive Months (if applicable)</Label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-3 border rounded-md bg-muted/30">
              {MONTHS.map((month) => (
                <div key={month} className="flex items-center space-x-2">
                  <Checkbox
                    id={`retro-${month}`}
                    checked={(caseData.retroMonths ?? []).includes(month)}
                    onCheckedChange={(checked) => handleRetroMonthToggle(month, checked === true)}
                  />
                  <Label htmlFor={`retro-${month}`} className="text-sm">
                    {month}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Applicant Details */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Applicant Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maritalStatus">Marital Status</Label>
            <Input
              id="maritalStatus"
              value={caseData.maritalStatus ?? ""}
              onChange={(e) => onCaseDataChange("maritalStatus", e.target.value)}
              placeholder="e.g., Single, Married, Widowed"
            />
          </div>
        </div>

        {/* Contact Methods */}
        <div className="space-y-2">
          <Label>Preferred Contact Methods</Label>
          <div className="flex flex-wrap gap-4 p-3 border rounded-md bg-muted/30">
            {CONTACT_METHODS.map(({ value, label }) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  id={`contact-${value}`}
                  checked={(caseData.contactMethods ?? []).includes(value)}
                  onCheckedChange={(checked) => handleContactMethodToggle(value, checked === true)}
                />
                <Label htmlFor={`contact-${value}`}>{label}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Eligibility Verification */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Eligibility Verification</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="citizenshipVerified"
                checked={caseData.citizenshipVerified ?? false}
                onCheckedChange={(checked) => onCaseDataChange("citizenshipVerified", checked)}
              />
              <Label htmlFor="citizenshipVerified">Citizenship Verified</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="residencyVerified"
                checked={caseData.residencyVerified ?? false}
                onCheckedChange={(checked) => onCaseDataChange("residencyVerified", checked)}
              />
              <Label htmlFor="residencyVerified">Residency Verified</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="agedDisabledVerified"
                checked={caseData.agedDisabledVerified ?? false}
                onCheckedChange={(checked) => onCaseDataChange("agedDisabledVerified", checked)}
              />
              <Label htmlFor="agedDisabledVerified">Aged/Disabled Status Verified</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="avsConsentDate">AVS Consent Date</Label>
              <Input
                id="avsConsentDate"
                type="date"
                value={isoToDateInputValue(caseData.avsConsentDate ?? "")}
                onChange={(e) =>
                  onCaseDataChange("avsConsentDate", dateInputValueToISO(e.target.value) || "")
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voterFormStatus">Voter Form Status</Label>
              <Select
                value={caseData.voterFormStatus || "none"}
                onValueChange={(value) => onCaseDataChange("voterFormStatus", value === "none" ? "" : value as VoterFormStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {VOTER_STATUSES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Verification Reviews */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Verification Reviews</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="reviewVRs"
              checked={caseData.reviewVRs ?? false}
              onCheckedChange={(checked) => onCaseDataChange("reviewVRs", checked)}
            />
            <Label htmlFor="reviewVRs">VRs Reviewed</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reviewPriorBudgets"
              checked={caseData.reviewPriorBudgets ?? false}
              onCheckedChange={(checked) => onCaseDataChange("reviewPriorBudgets", checked)}
            />
            <Label htmlFor="reviewPriorBudgets">Prior Budgets Reviewed</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reviewPriorNarr"
              checked={caseData.reviewPriorNarr ?? false}
              onCheckedChange={(checked) => onCaseDataChange("reviewPriorNarr", checked)}
            />
            <Label htmlFor="reviewPriorNarr">Prior Narratives Reviewed</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="interfacesReviewed"
              checked={caseData.interfacesReviewed ?? false}
              onCheckedChange={(checked) => onCaseDataChange("interfacesReviewed", checked)}
            />
            <Label htmlFor="interfacesReviewed">Interfaces Reviewed (SDX, BDE, SSA, etc.)</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="avsSubmitted"
              checked={caseData.avsSubmitted ?? false}
              onCheckedChange={(checked) => onCaseDataChange("avsSubmitted", checked)}
            />
            <Label htmlFor="avsSubmitted">AVS Submitted</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntakeInfoForm;
