/**
 * IntakeFormView – Step-based Medicaid intake workflow
 *
 * Renders a sidebar with step navigation and a main content area
 * that shows the active step's form fields.
 *
 * Wires to useIntakeWorkflow for all state and persistence.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  ClipboardList,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  ArrowLeft,
  Users,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { INTAKE_STEPS, isStepComplete } from "@/domain/cases/intake-steps";
import type { IntakeFormData } from "@/domain/validation/intake.schema";
import {
  useIntakeWorkflow,
  type UseIntakeWorkflowOptions,
} from "@/hooks/useIntakeWorkflow";
import {
  isoToDateInputValue,
  dateInputValueToISO,
  formatDateForDisplay,
  US_STATES,
  formatPhoneNumberAsTyped,
  getDisplayPhoneNumber,
  normalizePhoneNumber,
} from "@/domain/common";
import { isRelationshipPopulated } from "@/domain/cases/relationships";
import { RelationshipsSection } from "@/components/case/CaseEditSections";
import type { Relationship } from "@/types/case";

const STEP_FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
].join(", ");

// ============================================================================
// Step icons
// ============================================================================

const STEP_ICONS = [User, Phone, FileText, ClipboardList, Users, CheckCircle2];

// ============================================================================
// Props
// ============================================================================

export interface IntakeFormViewProps extends UseIntakeWorkflowOptions {
  /** Optional pre-filled data (e.g. from a previously saved draft) */
  initialData?: Partial<IntakeFormData>;
}

// ============================================================================
// Sidebar
// ============================================================================

interface SidebarProps {
  currentStep: number;
  visitedSteps: ReadonlySet<number>;
  formData: IntakeFormData;
  onGoToStep: (index: number) => void;
}

function IntakeSidebar({
  currentStep,
  visitedSteps,
  formData,
  onGoToStep,
}: Readonly<SidebarProps>) {
  return (
    <nav
      className="w-56 shrink-0 border-r bg-muted/30 flex flex-col gap-1 py-4 px-3"
      aria-label="Intake steps"
    >
      {INTAKE_STEPS.map((step, index) => {
        const Icon = STEP_ICONS[index];
        const isActive = index === currentStep;
        const isVisited = visitedSteps.has(index);
        const isDone =
          isVisited && isStepComplete(index, formData) && !isActive;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onGoToStep(index)}
            className={cn(
              "flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
              isActive
                ? "bg-background border shadow-sm"
                : "hover:bg-muted cursor-pointer",
              !isVisited && index !== 0 && "opacity-50 pointer-events-none",
            )}
            aria-current={isActive ? "step" : undefined}
            disabled={!isVisited && index !== 0}
          >
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isActive && "border-primary text-primary",
                isDone &&
                  "border-green-500 bg-green-500 text-white",
                !isActive && !isDone && "text-muted-foreground",
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {step.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ============================================================================
// Summary row (Review step)
// ============================================================================

function SummaryRow({
  label,
  value,
}: Readonly<{ label: string; value: string | undefined | null }>) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ============================================================================
// Step form panels
// ============================================================================

// --- Step 0: Applicant ---
interface ApplicantStepProps {
  formData: IntakeFormData;
  onChange: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K],
  ) => void;
}

function ApplicantStep({
  formData,
  onChange,
}: Readonly<ApplicantStepProps>) {
  const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Separated"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="intake-firstName">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="intake-firstName"
            value={formData.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            placeholder="First name"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-lastName">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="intake-lastName"
            value={formData.lastName}
            onChange={(e) => onChange("lastName", e.target.value)}
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="intake-dob">Date of Birth</Label>
          <Input
            id="intake-dob"
            type="date"
            value={isoToDateInputValue(formData.dateOfBirth)}
            onChange={(e) =>
              onChange("dateOfBirth", dateInputValueToISO(e.target.value) ?? "")
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-ssn">SSN</Label>
          <Input
            id="intake-ssn"
            value={formData.ssn}
            onChange={(e) => onChange("ssn", e.target.value)}
            placeholder="XXX-XX-XXXX"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="intake-maritalStatus">Marital Status</Label>
        <Select
          value={formData.maritalStatus ?? ""}
          onValueChange={(v) => onChange("maritalStatus", v)}
        >
          <SelectTrigger id="intake-maritalStatus">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {MARITAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// --- Step 1: Contact & Address ---
interface ContactStepProps {
  formData: IntakeFormData;
  onChange: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K],
  ) => void;
}

function ContactStep({ formData, onChange }: Readonly<ContactStepProps>) {
  const handleAddressChange = useCallback(
    (field: string, value: string) => {
      onChange("address", { ...formData.address, [field]: value });
    },
    [formData.address, onChange],
  );

  const handleMailingChange = useCallback(
    (field: string, value: unknown) => {
      onChange("mailingAddress", { ...formData.mailingAddress, [field]: value });
    },
    [formData.mailingAddress, onChange],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="intake-phone">Phone</Label>
          <Input
            id="intake-phone"
            value={formatPhoneNumberAsTyped(formData.phone)}
            onChange={(e) => onChange("phone", normalizePhoneNumber(e.target.value))}
            onBlur={(e) => onChange("phone", normalizePhoneNumber(e.target.value))}
            placeholder="(XXX) XXX-XXXX"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-email">Email</Label>
          <Input
            id="intake-email"
            type="email"
            value={formData.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Physical Address</h3>
        <div className="space-y-1.5">
          <Label htmlFor="intake-street">Street</Label>
          <Input
            id="intake-street"
            value={formData.address.street ?? ""}
            onChange={(e) => handleAddressChange("street", e.target.value)}
            placeholder="123 Main St"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1 space-y-1.5">
            <Label htmlFor="intake-city">City</Label>
            <Input
              id="intake-city"
              value={formData.address.city ?? ""}
              onChange={(e) => handleAddressChange("city", e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-state">State</Label>
            <Select
              value={formData.address.state ?? "NE"}
              onValueChange={(v) => handleAddressChange("state", v)}
            >
              <SelectTrigger id="intake-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intake-zip">ZIP</Label>
            <Input
              id="intake-zip"
              value={formData.address.zip ?? ""}
              onChange={(e) => handleAddressChange("zip", e.target.value)}
              placeholder="XXXXX"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Mailing Address</h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="intake-sameAsPhysical"
              checked={formData.mailingAddress.sameAsPhysical}
              onCheckedChange={(v) =>
                handleMailingChange("sameAsPhysical", v === true)
              }
            />
            <Label
              htmlFor="intake-sameAsPhysical"
              className="text-sm font-normal cursor-pointer"
            >
              Same as physical
            </Label>
          </div>
        </div>

        {!formData.mailingAddress.sameAsPhysical && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="intake-mailStreet">Street</Label>
              <Input
                id="intake-mailStreet"
                value={formData.mailingAddress.street ?? ""}
                onChange={(e) => handleMailingChange("street", e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="intake-mailCity">City</Label>
                <Input
                  id="intake-mailCity"
                  value={formData.mailingAddress.city ?? ""}
                  onChange={(e) => handleMailingChange("city", e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intake-mailState">State</Label>
                <Select
                  value={formData.mailingAddress.state ?? "NE"}
                  onValueChange={(v) => handleMailingChange("state", v)}
                >
                  <SelectTrigger id="intake-mailState">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intake-mailZip">ZIP</Label>
                <Input
                  id="intake-mailZip"
                  value={formData.mailingAddress.zip ?? ""}
                  onChange={(e) => handleMailingChange("zip", e.target.value)}
                  placeholder="XXXXX"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Step 2: Case Details ---
interface CaseDetailsStepProps {
  formData: IntakeFormData;
  onChange: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K],
  ) => void;
}

function CaseDetailsStep({
  formData,
  onChange,
}: Readonly<CaseDetailsStepProps>) {
  const { config } = useCategoryConfig();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="intake-mcn">
            MCN <span className="text-destructive">*</span>
          </Label>
          <Input
            id="intake-mcn"
            value={formData.mcn}
            onChange={(e) => onChange("mcn", e.target.value)}
            placeholder="Medicaid case number"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-applicationDate">
            Application Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="intake-applicationDate"
            type="date"
            value={isoToDateInputValue(formData.applicationDate)}
            onChange={(e) =>
              onChange(
                "applicationDate",
                dateInputValueToISO(e.target.value) ?? "",
              )
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="intake-caseType">Case Type</Label>
          <Select
            value={formData.caseType ?? ""}
            onValueChange={(v) => onChange("caseType", v)}
          >
            <SelectTrigger id="intake-caseType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {config.caseTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-applicationType">Application Type</Label>
          <Select
            value={formData.applicationType ?? ""}
            onValueChange={(v) => onChange("applicationType", v)}
          >
            <SelectTrigger id="intake-applicationType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {config.applicationTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="intake-livingArrangement">Living Arrangement</Label>
        <Select
          value={formData.livingArrangement ?? ""}
          onValueChange={(v) => onChange("livingArrangement", v)}
        >
          <SelectTrigger id="intake-livingArrangement">
            <SelectValue placeholder="Select arrangement" />
          </SelectTrigger>
          <SelectContent>
            {config.livingArrangements.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="intake-admissionDate">Admission Date</Label>
          <Input
            id="intake-admissionDate"
            type="date"
            value={isoToDateInputValue(formData.admissionDate)}
            onChange={(e) =>
              onChange(
                "admissionDate",
                dateInputValueToISO(e.target.value) ?? "",
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="intake-retroRequested">Retro Requested</Label>
          <Input
            id="intake-retroRequested"
            value={formData.retroRequested ?? ""}
            onChange={(e) => onChange("retroRequested", e.target.value)}
            placeholder="Month(s) requested"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="intake-withWaiver"
          checked={formData.withWaiver ?? false}
          onCheckedChange={(v) => onChange("withWaiver", v === true)}
        />
        <Label htmlFor="intake-withWaiver" className="cursor-pointer">
          With Waiver
        </Label>
      </div>
    </div>
  );
}

// --- Step 3: Checklist ---
interface ChecklistStepProps {
  formData: IntakeFormData;
  onChange: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K],
  ) => void;
}

type ContactMethodOption = "mail" | "text" | "email";
type VoterFormStatusOption = "requested" | "declined" | "not_answered" | "";

const CONTACT_METHOD_OPTIONS: { value: ContactMethodOption; label: string }[] =
  [
    { value: "mail", label: "US Mail" },
    { value: "text", label: "Text Message" },
    { value: "email", label: "Email" },
  ];

const VOTER_STATUS_OPTIONS: { value: VoterFormStatusOption; label: string }[] =
  [
    { value: "", label: "Not Set" },
    { value: "requested", label: "Requested" },
    { value: "declined", label: "Declined" },
    { value: "not_answered", label: "Not Answered" },
  ];

function ChecklistStep({
  formData,
  onChange,
}: Readonly<ChecklistStepProps>) {
  const toggleContactMethod = useCallback(
    (method: ContactMethodOption, checked: boolean) => {
      const current = (formData.contactMethods ?? []) as ContactMethodOption[];
      if (checked) {
        if (!current.includes(method)) {
          onChange("contactMethods", [...current, method] as IntakeFormData["contactMethods"]);
        }
      } else {
        onChange(
          "contactMethods",
          current.filter((m) => m !== method) as IntakeFormData["contactMethods"],
        );
      }
    },
    [formData.contactMethods, onChange],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Verifications</h3>
        {(
          [
            ["appValidated", "Application validated"],
            ["agedDisabledVerified", "Aged/disabled verified"],
            ["citizenshipVerified", "Citizenship verified"],
            ["residencyVerified", "Residency verified"],
          ] as [keyof IntakeFormData, string][]
        ).map(([field, label]) => (
          <div key={field} className="flex items-center gap-2">
            <Checkbox
              id={`intake-${field}`}
              checked={(formData[field] as boolean | undefined) ?? false}
              onCheckedChange={(v) =>
                onChange(field, (v === true) as IntakeFormData[typeof field])
              }
            />
            <Label htmlFor={`intake-${field}`} className="cursor-pointer">
              {label}
            </Label>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Checkbox
            id="intake-pregnancy"
            checked={formData.pregnancy ?? false}
            onCheckedChange={(v) => onChange("pregnancy", v === true)}
          />
          <Label htmlFor="intake-pregnancy" className="cursor-pointer">
            Pregnancy
          </Label>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Contact Methods</h3>
        {CONTACT_METHOD_OPTIONS.map(({ value, label }) => (
          <div key={value} className="flex items-center gap-2">
            <Checkbox
              id={`intake-contact-${value}`}
              checked={
                (formData.contactMethods as ContactMethodOption[] | undefined)?.includes(
                  value,
                ) ?? false
              }
              onCheckedChange={(v) => toggleContactMethod(value, v === true)}
            />
            <Label htmlFor={`intake-contact-${value}`} className="cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 id="voter-form-status-label" className="text-sm font-medium">Voter Registration Form</h3>
        <RadioGroup
          aria-labelledby="voter-form-status-label"
          value={(formData.voterFormStatus as VoterFormStatusOption) ?? ""}
          onValueChange={(v) =>
            onChange("voterFormStatus", v as VoterFormStatusOption)
          }
        >
          {VOTER_STATUS_OPTIONS.map(({ value, label }) => (
            <div key={value || "empty"} className="flex items-center gap-2">
              <RadioGroupItem
                id={`intake-voter-${value || "empty"}`}
                value={value}
              />
              <Label
                htmlFor={`intake-voter-${value || "empty"}`}
                className="cursor-pointer"
              >
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="intake-avsConsentDate">AVS Consent Date</Label>
        <Input
          id="intake-avsConsentDate"
          type="date"
          value={isoToDateInputValue(formData.avsConsentDate)}
          onChange={(e) =>
            onChange(
              "avsConsentDate",
              dateInputValueToISO(e.target.value) ?? "",
            )
          }
        />
      </div>
    </div>
  );
}

// --- Step 4: Household ---
interface HouseholdStepProps {
  formData: IntakeFormData;
  onChange: <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K],
  ) => void;
}

function HouseholdStep({ formData, onChange }: Readonly<HouseholdStepProps>) {
  const relationships = useMemo(
    () => (formData.relationships ?? []) as Relationship[],
    [formData.relationships],
  );
  const handleAdd = useCallback(() => {
    const newRel: Relationship = {
      id: crypto.randomUUID(),
      type: "",
      name: "",
      phone: "",
    };
    onChange("relationships", [...relationships, newRel]);
  }, [relationships, onChange]);

  const handleUpdate = useCallback(
    (index: number, field: "type" | "name" | "phone", value: string) => {
      onChange(
        "relationships",
        relationships.map((rel, i) => (i === index ? { ...rel, [field]: value } : rel)),
      );
    },
    [relationships, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(
        "relationships",
        relationships.filter((_, i) => i !== index),
      );
    },
    [relationships, onChange],
  );

  const handlers = useMemo(
    () => ({ add: handleAdd, update: handleUpdate, remove: handleRemove }),
    [handleAdd, handleUpdate, handleRemove],
  );

  return (
    <div className="space-y-4">
      <RelationshipsSection
        relationships={relationships}
        isEditing={true}
        onRelationshipsChange={handlers}
      />
    </div>
  );
}

// --- Step 5: Review ---
interface ReviewStepProps {
  formData: IntakeFormData;
  onGoToStep: (index: number) => void;
}

function ReviewStep({ formData, onGoToStep }: Readonly<ReviewStepProps>) {
  const populatedRelationships = useMemo(
    () => ((formData.relationships ?? []) as Relationship[]).filter(isRelationshipPopulated),
    [formData.relationships],
  );
  const sections: {
    title: string;
    stepIndex: number;
    rows: { label: string; value: string | undefined | null }[];
  }[] = [
    {
      title: "Applicant",
      stepIndex: 0,
      rows: [
        { label: "First Name", value: formData.firstName },
        { label: "Last Name", value: formData.lastName },
        {
          label: "Date of Birth",
          value: formatDateForDisplay(formData.dateOfBirth) === "None"
            ? undefined
            : formatDateForDisplay(formData.dateOfBirth),
        },
        {
          label: "SSN",
          value: formData.ssn
            ? `•••-••-${formData.ssn.slice(-4)}`
            : undefined,
        },
        { label: "Marital Status", value: formData.maritalStatus },
      ],
    },
    {
      title: "Contact",
      stepIndex: 1,
      rows: [
        { label: "Phone", value: getDisplayPhoneNumber(formData.phone) },
        { label: "Email", value: formData.email },
        {
          label: "Address",
          value: formData.address.street
            ? [
                formData.address.street,
                formData.address.apt,
                formData.address.city,
                formData.address.state,
                formData.address.zip,
              ]
                .filter(Boolean)
                .join(", ")
            : undefined,
        },
      ],
    },
    {
      title: "Case Details",
      stepIndex: 2,
      rows: [
        { label: "MCN", value: formData.mcn },
        {
          label: "Application Date",
          value: formatDateForDisplay(formData.applicationDate) === "None"
            ? undefined
            : formatDateForDisplay(formData.applicationDate),
        },
        { label: "Case Type", value: formData.caseType },
        { label: "Application Type", value: formData.applicationType },
        { label: "Living Arrangement", value: formData.livingArrangement },
        { label: "With Waiver", value: formData.withWaiver ? "Yes" : "No" },
        { label: "Retro Requested", value: formData.retroRequested },
      ],
    },
    {
      title: "Checklist",
      stepIndex: 3,
      rows: [
        {
          label: "App Validated",
          value: formData.appValidated ? "Yes" : "No",
        },
        {
          label: "Contact Methods",
          value:
            (formData.contactMethods ?? []).length > 0
              ? (formData.contactMethods as string[]).join(", ")
              : undefined,
        },
        {
          label: "Voter Form",
          value: formData.voterFormStatus || undefined,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {section.title}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onGoToStep(section.stepIndex)}
            >
              Edit
            </Button>
          </div>
          <div className="rounded-md border bg-muted/20 px-4 py-3 space-y-2">
            {section.rows
              .filter((r) => r.value)
              .map((row) => (
                <SummaryRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                />
              ))}
            {section.rows.filter((r) => r.value).length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No information provided
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Household / Relationships */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Household</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onGoToStep(4)}
          >
            Edit
          </Button>
        </div>
        <div className="rounded-md border bg-muted/20 px-4 py-3 space-y-2">
          {populatedRelationships.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No relationships added
            </p>
          ) : (
            populatedRelationships.map((rel, i) => (
              <SummaryRow
                key={rel.id ?? `review-rel-${i}`}
                label={rel.type || "Relationship"}
                value={[rel.name, getDisplayPhoneNumber(rel.phone)]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

/**
 * IntakeFormView – Full-screen step-based intake workflow.
 *
 * Renders a sidebar navigation + main content area with per-step forms.
 * Submits via DataManager on the final step.
 *
 * @param initialData - Optional pre-filled form data (e.g. from a previous draft).
 *   When provided the form is seeded with these values on first mount.
 */
export function IntakeFormView({
  existingCase,
  initialData,
  onSuccess,
  onCancel,
}: Readonly<IntakeFormViewProps>) {
  const hasSeededInitialData = useRef(false);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const {
    currentStep,
    visitedSteps,
    formData,
    isEditing,
    isSubmitting,
    error,
    updateField,
    setFormData,
    goNext,
    goPrev,
    goToStep,
    cancel,
    submit,
    isCurrentStepComplete,
    canSubmit,
  } = useIntakeWorkflow({ existingCase, onSuccess, onCancel });

  // Pre-fill form when initialData is provided (e.g. loading a draft)
  useEffect(() => {
    if (!initialData || hasSeededInitialData.current) return;

    hasSeededInitialData.current = true;
    setFormData((prev) => ({ ...prev, ...initialData }));
  }, [initialData, setFormData]);

  useEffect(() => {
    const focusStepContent = () => {
      const stepContent = stepContentRef.current;
      if (!stepContent) {
        return;
      }

      const firstField =
        stepContent.querySelector<HTMLElement>(
          STEP_FOCUSABLE_SELECTOR,
        ) ?? stepContent;

      firstField?.focus();
    };

    if (
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      focusStepContent();
      return undefined;
    }

    const focusFrame = globalThis.requestAnimationFrame(focusStepContent);

    return () => {
      globalThis.cancelAnimationFrame(focusFrame);
    };
  }, [currentStep]);

  const isLastStep = currentStep === INTAKE_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b bg-background">
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {isEditing ? "Edit Case" : "New Case Intake"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {INTAKE_STEPS.length} –{" "}
            {INTAKE_STEPS[currentStep].label}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {INTAKE_STEPS[currentStep].description}
        </Badge>
      </div>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        <IntakeSidebar
          currentStep={currentStep}
          visitedSteps={visitedSteps}
          formData={formData}
          onGoToStep={goToStep}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Step title */}
            <div>
              <h2 className="text-base font-semibold">
                {INTAKE_STEPS[currentStep].label}
              </h2>
              <p className="text-sm text-muted-foreground">
                {INTAKE_STEPS[currentStep].description}
              </p>
            </div>

            {/* Step form */}
            <div
              ref={stepContentRef}
              tabIndex={-1}
              data-testid="intake-step-content"
            >
              {currentStep === 0 && (
                <ApplicantStep formData={formData} onChange={updateField} />
              )}
              {currentStep === 1 && (
                <ContactStep formData={formData} onChange={updateField} />
              )}
              {currentStep === 2 && (
                <CaseDetailsStep formData={formData} onChange={updateField} />
              )}
              {currentStep === 3 && (
                <ChecklistStep formData={formData} onChange={updateField} />
              )}
              {currentStep === 4 && (
                <HouseholdStep formData={formData} onChange={updateField} />
              )}
              {currentStep === 5 && (
                <ReviewStep formData={formData} onGoToStep={goToStep} />
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-2">
                {error}
              </p>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={isFirstStep || isSubmitting}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              {isLastStep ? (
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={isSubmitting || !canSubmit}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isEditing ? "Saving…" : "Creating…"}
                    </>
                  ) : (
                    (isEditing ? "Save Changes" : "Submit Case")
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={!isCurrentStepComplete}
                  className="flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
