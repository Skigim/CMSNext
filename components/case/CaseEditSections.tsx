/**
 * CaseEditSections - Individual section cards for the case edit modal
 * 
 * Each section is its own Card component, allowing flexible 2-column layout.
 * All sections support both read-only and edit modes.
 */
import { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  Check,
  X,
  Users,
  Plus,
  Minus,
  FileText,
  Flag,
  Copy,
} from "lucide-react";
import {
  NewPersonData,
  NewCaseRecordData,
  ContactMethod,
  Relationship,
  Address,
  MailingAddress,
  VoterFormStatus,
} from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import {
  isoToDateInputValue,
  dateInputValueToISO,
  formatDateForDisplay,
  US_STATES,
} from "@/domain/common";
import {
  formatPhoneNumberAsTyped,
  normalizePhoneNumber,
  getDisplayPhoneNumber,
} from "@/domain/common";
import { CopyButton } from "../common/CopyButton";
import { generateAvsNarrative } from "@/domain/cases";
import { clickToCopy } from "../../utils/clipboard";

// ============================================================================
// Shared Components
// ============================================================================

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

function ChecklistItem({ label, checked }: { label: string; checked?: boolean }) {
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

// ============================================================================
// Section Card Components
// ============================================================================

// --- Basic Information Section ---
interface BasicInfoSectionProps {
  personData: NewPersonData;
  isEditing: boolean;
  onPersonDataChange: (field: keyof NewPersonData, value: unknown) => void;
}

export function BasicInfoSection({
  personData,
  isEditing,
  onPersonDataChange,
}: BasicInfoSectionProps) {
  const formatDate = (dateString?: string) => {
    const formatted = formatDateForDisplay(dateString);
    return formatted === "None" ? null : formatted;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Basic Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-xs">First Name *</Label>
              <Input
                id="firstName"
                value={personData.firstName}
                onChange={(e) => onPersonDataChange("firstName", e.target.value)}
                placeholder="First name"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
              <Input
                id="lastName"
                value={personData.lastName}
                onChange={(e) => onPersonDataChange("lastName", e.target.value)}
                placeholder="Last name"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateOfBirth" className="text-xs">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={isoToDateInputValue(personData.dateOfBirth)}
                onChange={(e) =>
                  onPersonDataChange("dateOfBirth", dateInputValueToISO(e.target.value) || "")
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ssn" className="text-xs">SSN</Label>
              <Input
                id="ssn"
                value={personData.ssn}
                onChange={(e) => onPersonDataChange("ssn", e.target.value)}
                placeholder="XXX-XX-XXXX"
                className="h-8"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="First Name" value={personData.firstName} icon={User} />
            <InfoItem label="Last Name" value={personData.lastName} />
            <InfoItem label="Date of Birth" value={formatDate(personData.dateOfBirth)} icon={Calendar} />
            <InfoItem label="SSN" value={personData.ssn ? "•••-••-" + personData.ssn.slice(-4) : null} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Contact Section ---
interface ContactSectionProps {
  personData: NewPersonData;
  caseData: NewCaseRecordData;
  isEditing: boolean;
  onPersonDataChange: (field: keyof NewPersonData, value: unknown) => void;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
}

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

export function ContactSection({
  personData,
  caseData,
  isEditing,
  onPersonDataChange,
  onCaseDataChange,
}: ContactSectionProps) {
  const contactMethodsDisplay = useMemo(() => {
    const methods = caseData.contactMethods ?? [];
    if (methods.length === 0) return null;
    return methods.map((m) => CONTACT_METHOD_LABELS[m] || m).join(", ");
  }, [caseData.contactMethods]);

  const handleContactMethodToggle = (method: ContactMethod, checked: boolean) => {
    const current = caseData.contactMethods ?? [];
    if (checked) {
      onCaseDataChange("contactMethods", [...current, method]);
    } else {
      onCaseDataChange("contactMethods", current.filter((m) => m !== method));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Contact
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={personData.email}
                onChange={(e) => onPersonDataChange("email", e.target.value)}
                placeholder="Email address"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formatPhoneNumberAsTyped(personData.phone)}
                onChange={(e) => onPersonDataChange("phone", normalizePhoneNumber(e.target.value))}
                placeholder="(555) 123-4567"
                className="h-8"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Contact Methods</Label>
              <div className="flex gap-4 p-2 border rounded-md bg-muted/30">
                {CONTACT_METHODS.map(({ value, label }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`contact-${value}`}
                      checked={(caseData.contactMethods ?? []).includes(value)}
                      onCheckedChange={(checked) => handleContactMethodToggle(value, checked === true)}
                    />
                    <Label htmlFor={`contact-${value}`} className="text-sm cursor-pointer">{label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {personData.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <CopyButton
                    value={getDisplayPhoneNumber(personData.phone)}
                    label="Phone"
                    showLabel={false}
                    successMessage="Phone copied"
                  />
                </div>
              </div>
            )}
            <InfoItem label="Email" value={personData.email} icon={Mail} />
            <InfoItem label="Contact Methods" value={contactMethodsDisplay} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Addresses Section ---
interface AddressesSectionProps {
  address: Address;
  mailingAddress: MailingAddress;
  isEditing: boolean;
  onAddressChange: (field: keyof Address, value: string) => void;
  onMailingAddressChange: (field: keyof MailingAddress, value: string | boolean) => void;
}

export function AddressesSection({
  address,
  mailingAddress,
  isEditing,
  onAddressChange,
  onMailingAddressChange,
}: AddressesSectionProps) {
  const fullAddress = address.street
    ? `${address.street}, ${address.city}, ${address.state} ${address.zip}`
    : null;

  const fullMailingAddress =
    !mailingAddress.sameAsPhysical && mailingAddress.street
      ? `${mailingAddress.street}, ${mailingAddress.city}, ${mailingAddress.state} ${mailingAddress.zip}`
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Addresses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            {/* Physical Address */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Physical Address</h4>
              <Input
                value={address.street}
                onChange={(e) => onAddressChange("street", e.target.value)}
                placeholder="Street address"
                className="h-8"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={address.city}
                  onChange={(e) => onAddressChange("city", e.target.value)}
                  placeholder="City"
                  className="h-8"
                />
                <Select value={address.state} onValueChange={(value) => onAddressChange("state", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={address.zip}
                  onChange={(e) => onAddressChange("zip", e.target.value)}
                  placeholder="ZIP"
                  className="h-8"
                />
              </div>
            </div>

            {/* Mailing Address */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Mailing Address</h4>
                <div className="flex items-center gap-2">
                  <Label htmlFor="sameAsPhysical" className="text-xs">Same as physical</Label>
                  <Switch
                    id="sameAsPhysical"
                    checked={mailingAddress.sameAsPhysical}
                    onCheckedChange={(checked) => onMailingAddressChange("sameAsPhysical", checked)}
                  />
                </div>
              </div>
              {!mailingAddress.sameAsPhysical && (
                <>
                  <Input
                    value={mailingAddress.street}
                    onChange={(e) => onMailingAddressChange("street", e.target.value)}
                    placeholder="Street address"
                    className="h-8"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      value={mailingAddress.city}
                      onChange={(e) => onMailingAddressChange("city", e.target.value)}
                      placeholder="City"
                      className="h-8"
                    />
                    <Select
                      value={mailingAddress.state}
                      onValueChange={(value) => onMailingAddressChange("state", value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={mailingAddress.zip}
                      onChange={(e) => onMailingAddressChange("zip", e.target.value)}
                      placeholder="ZIP"
                      className="h-8"
                    />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <InfoItem label="Physical Address" value={fullAddress} icon={MapPin} />
            {mailingAddress.sameAsPhysical ? (
              <p className="text-xs text-muted-foreground pl-6">Mailing same as physical</p>
            ) : (
              <InfoItem label="Mailing Address" value={fullMailingAddress} icon={Mail} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Case Identification Section ---
interface CaseIdentificationSectionProps {
  caseData: NewCaseRecordData;
  isEditing: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
}

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

export function CaseIdentificationSection({
  caseData,
  isEditing,
  onCaseDataChange,
}: CaseIdentificationSectionProps) {
  const { config } = useCategoryConfig();
  const { caseTypes, applicationTypes, caseStatuses } = useMemo(
    () => ({
      caseTypes: config.caseTypes,
      applicationTypes: config.applicationTypes,
      caseStatuses: config.caseStatuses,
    }),
    [config]
  );

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Case Identification
          </CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={handleCopyNarrative} className="h-7 px-2">
              <Copy className="h-3 w-3 mr-1" />
              AVS
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mcn" className="text-xs">MCN *</Label>
              <Input
                id="mcn"
                value={caseData.mcn}
                onChange={(e) => onCaseDataChange("mcn", e.target.value)}
                placeholder="Enter MCN"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caseType" className="text-xs">Case Type</Label>
              <Select value={caseData.caseType} onValueChange={(value) => onCaseDataChange("caseType", value)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="applicationType" className="text-xs">App Type</Label>
              <Select
                value={caseData.applicationType || ""}
                onValueChange={(value) => onCaseDataChange("applicationType", value || undefined)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {applicationTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
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
                onChange={(e) => onCaseDataChange("applicationDate", dateInputValueToISO(e.target.value) || "")}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <Select value={caseData.status} onValueChange={(value) => onCaseDataChange("status", value)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseStatuses.map((status) => (
                    <SelectItem key={status.name} value={status.name}>{status.name}</SelectItem>
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
              <Label htmlFor="avsSubmitDate" className="text-xs">AVS Submit Date</Label>
              <Input
                id="avsSubmitDate"
                type="date"
                value={isoToDateInputValue(caseData.avsSubmitDate ?? "")}
                onChange={(e) => onCaseDataChange("avsSubmitDate", dateInputValueToISO(e.target.value) || "")}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voterFormStatus" className="text-xs">Voter Form</Label>
              <Select
                value={caseData.voterFormStatus || "none"}
                onValueChange={(value) =>
                  onCaseDataChange("voterFormStatus", value === "none" ? "" : (value as VoterFormStatus))
                }
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
        ) : (
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
            <InfoItem label="AVS Submit" value={formatDate(caseData.avsSubmitDate)} icon={Calendar} />
            <InfoItem
              label="Voter Form"
              value={caseData.voterFormStatus ? VOTER_STATUS_LABELS[caseData.voterFormStatus] : null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Eligibility & Details Section ---
interface EligibilityDetailsSectionProps {
  personData: NewPersonData;
  caseData: NewCaseRecordData;
  isEditing: boolean;
  onPersonDataChange: (field: keyof NewPersonData, value: unknown) => void;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
}

export function EligibilityDetailsSection({
  personData,
  caseData,
  isEditing,
  onPersonDataChange,
  onCaseDataChange,
}: EligibilityDetailsSectionProps) {
  const { config } = useCategoryConfig();
  const livingArrangements = useMemo(() => config.livingArrangements, [config.livingArrangements]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Eligibility & Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            {/* Eligibility */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Eligibility Verification</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="citizenshipVerified"
                    checked={caseData.citizenshipVerified ?? false}
                    onCheckedChange={(checked) => onCaseDataChange("citizenshipVerified", checked)}
                  />
                  <Label htmlFor="citizenshipVerified" className="text-sm">Citizenship</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="residencyVerified"
                    checked={caseData.residencyVerified ?? false}
                    onCheckedChange={(checked) => onCaseDataChange("residencyVerified", checked)}
                  />
                  <Label htmlFor="residencyVerified" className="text-sm">Residency</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="agedDisabledVerified"
                    checked={caseData.agedDisabledVerified ?? false}
                    onCheckedChange={(checked) => onCaseDataChange("agedDisabledVerified", checked)}
                  />
                  <Label htmlFor="agedDisabledVerified" className="text-sm">Aged/Disabled</Label>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Additional Details</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="pregnancy"
                    checked={caseData.pregnancy ?? false}
                    onCheckedChange={(checked) => onCaseDataChange("pregnancy", checked)}
                  />
                  <Label htmlFor="pregnancy" className="text-sm">Pregnancy</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="appValidated"
                    checked={caseData.appValidated ?? false}
                    onCheckedChange={(checked) => onCaseDataChange("appValidated", checked)}
                  />
                  <Label htmlFor="appValidated" className="text-sm">App Validated</Label>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="maritalStatus" className="text-xs">Marital Status</Label>
                  <Input
                    id="maritalStatus"
                    value={caseData.maritalStatus ?? ""}
                    onChange={(e) => onCaseDataChange("maritalStatus", e.target.value)}
                    placeholder="e.g., Single"
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            {/* Living Arrangement */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Living Arrangement</h4>
              <Select
                value={personData.livingArrangement}
                onValueChange={(value) => onPersonDataChange("livingArrangement", value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select arrangement" />
                </SelectTrigger>
                <SelectContent>
                  {livingArrangements.map((arrangement) => (
                    <SelectItem key={arrangement} value={arrangement}>{arrangement}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            {/* Eligibility */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Eligibility Verification</h4>
              <div className="grid grid-cols-3 gap-2">
                <ChecklistItem label="Citizenship" checked={caseData.citizenshipVerified} />
                <ChecklistItem label="Residency" checked={caseData.residencyVerified} />
                <ChecklistItem label="Aged/Disabled" checked={caseData.agedDisabledVerified} />
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Additional Details</h4>
              <div className="grid grid-cols-3 gap-2">
                <ChecklistItem label="Pregnancy" checked={caseData.pregnancy} />
                <ChecklistItem label="App Validated" checked={caseData.appValidated} />
                <InfoItem label="Marital Status" value={caseData.maritalStatus} />
              </div>
            </div>

            {/* Living Arrangement */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Living Arrangement</h4>
              <InfoItem label="Arrangement" value={personData.livingArrangement} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Case Flags Section ---
interface CaseFlagsSectionProps {
  caseData: NewCaseRecordData;
  retroRequested: boolean;
  isEditing: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
  onRetroRequestedChange: (value: boolean) => void;
}

export function CaseFlagsSection({
  caseData,
  retroRequested,
  isEditing,
  onCaseDataChange,
  onRetroRequestedChange,
}: CaseFlagsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="h-4 w-4" />
          Case Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing ? (
          <>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="priority"
                  checked={caseData.priority ?? false}
                  onCheckedChange={(checked) => onCaseDataChange("priority", checked)}
                />
                <Label htmlFor="priority" className="text-sm">Priority Case</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="withWaiver"
                  checked={caseData.withWaiver ?? false}
                  onCheckedChange={(checked) => onCaseDataChange("withWaiver", checked)}
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
              {retroRequested && (
                <div className="space-y-1 mt-2 pl-6">
                  <Label htmlFor="retroMonthsInput" className="text-xs">Retro Months</Label>
                  <Input
                    id="retroMonthsInput"
                    value={(caseData.retroMonths ?? []).join(", ")}
                    onChange={(e) => {
                      const value = e.target.value;
                      const months = value.split(",").map((m) => m.trim()).filter((m) => m.length > 0);
                      onCaseDataChange("retroMonths", months);
                    }}
                    placeholder="e.g., Jan, Feb, Mar"
                    className="h-8"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2">
              <ChecklistItem label="Priority Case" checked={caseData.priority} />
              <ChecklistItem label="With Waiver" checked={caseData.withWaiver} />
              <ChecklistItem label="Retro Requested" checked={retroRequested} />
            </div>
            {retroRequested && caseData.retroMonths && caseData.retroMonths.length > 0 && (
              <div className="space-y-1 pt-2">
                <span className="text-xs text-muted-foreground">Retro Months</span>
                <p className="text-sm font-medium">{caseData.retroMonths.join(", ")}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Relationships Section ---
interface RelationshipsSectionProps {
  relationships: Relationship[];
  isEditing: boolean;
  onRelationshipsChange: {
    add: () => void;
    update: (index: number, field: keyof Relationship, value: string) => void;
    remove: (index: number) => void;
  };
}

export function RelationshipsSection({
  relationships,
  isEditing,
  onRelationshipsChange,
}: RelationshipsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Relationships
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {relationships.length}
            </Badge>
          </CardTitle>
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRelationshipsChange.add}
              className="h-7 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            {relationships.map((rel, index) => (
              <div key={index} className="flex flex-col gap-2 p-2 border rounded-md bg-muted/10 relative group">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRelationshipsChange.remove(index)}
                  className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={rel.type}
                    onValueChange={(value) => onRelationshipsChange.update(index, "type", value)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                      <SelectItem value="Authorized Representative">Auth Rep</SelectItem>
                      <SelectItem value="Case Manager">Case Manager</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={rel.name}
                    onChange={(e) => onRelationshipsChange.update(index, "name", e.target.value)}
                    placeholder="Name"
                    className="h-7 text-xs"
                  />
                  <Input
                    value={formatPhoneNumberAsTyped(rel.phone)}
                    onChange={(e) =>
                      onRelationshipsChange.update(index, "phone", normalizePhoneNumber(e.target.value))
                    }
                    placeholder="Phone"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            ))}
            {relationships.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No relationships added</p>
            )}
          </div>
        ) : (
          <>
            {relationships.length > 0 ? (
              <div className="space-y-2">
                {relationships.map((rel, index) => (
                  <div key={index} className="flex flex-col gap-1 p-2 border rounded-md bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{rel.name}</span>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {rel.type}
                      </Badge>
                    </div>
                    {rel.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <CopyButton
                          value={getDisplayPhoneNumber(rel.phone)}
                          label="Phone"
                          showLabel={false}
                          successMessage="Phone copied"
                          textClassName="text-xs"
                          buttonClassName="text-xs px-1 py-0"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No relationships added</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
