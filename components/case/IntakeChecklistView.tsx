import { useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { StoredCase, ContactMethod, VoterFormStatus } from "../../types/case";
import {
  Check,
  X,
  Copy,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Heart,
  Shield,
  ClipboardCheck,
  FileSearch,
  Users,
} from "lucide-react";
import { clickToCopy } from "../../utils/clipboard";
import { getDisplayPhoneNumber } from "../../utils/phoneFormatter";
import { CopyableText } from "../common/CopyableText";

interface IntakeChecklistViewProps {
  caseData: StoredCase;
  onEdit?: () => void;
}

// Helper component for checklist items
function ChecklistItem({
  label,
  checked,
  className,
}: {
  label: string;
  checked?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
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

// Helper component for info items
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

const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  mail: "US Mail",
  text: "Text Message",
  email: "Email",
};

const VOTER_STATUS_LABELS: Record<VoterFormStatus, string> = {
  requested: "Requested",
  declined: "Declined",
  not_answered: "Not Answered",
  "": "Not Set",
};

export function IntakeChecklistView({ caseData, onEdit }: IntakeChecklistViewProps) {
  const { person, caseRecord } = caseData;

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
    const consentDate = formatDate(caseRecord.avsConsentDate) || "MM/DD/YYYY";
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
  }, [caseRecord.avsConsentDate, formatDate]);

  const handleCopyNarrative = useCallback(() => {
    const narrative = generateAVSNarrative();
    clickToCopy(narrative, {
      successMessage: "AVS narrative copied to clipboard",
      errorMessage: "Failed to copy narrative",
    });
  }, [generateAVSNarrative]);

  // Contact methods display
  const contactMethodsDisplay = useMemo(() => {
    const methods = caseRecord.contactMethods ?? [];
    if (methods.length === 0) return null;
    return methods.map((m) => CONTACT_METHOD_LABELS[m] || m).join(", ");
  }, [caseRecord.contactMethods]);

  // Retro months display
  const retroMonthsDisplay = useMemo(() => {
    const months = caseRecord.retroMonths ?? [];
    if (months.length === 0) return null;
    return months.join(", ");
  }, [caseRecord.retroMonths]);

  // Calculate completion stats
  const checklistStats = useMemo(() => {
    const items = [
      caseRecord.appValidated,
      caseRecord.citizenshipVerified,
      caseRecord.residencyVerified,
      caseRecord.agedDisabledVerified,
      caseRecord.avsSubmitted,
      caseRecord.interfacesReviewed,
      caseRecord.reviewVRs,
      caseRecord.reviewPriorBudgets,
      caseRecord.reviewPriorNarr,
    ];
    const completed = items.filter(Boolean).length;
    return { completed, total: items.length };
  }, [caseRecord]);

  return (
    <div className="space-y-6">
      {/* Header with Edit button and completion stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Case Intake Checklist</h2>
          <Badge variant="outline" className="text-xs">
            {checklistStats.completed}/{checklistStats.total} complete
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyNarrative}
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy AVS Narrative
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Person Information Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Applicant Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
          <InfoItem
            label="Name"
            value={`${person.firstName} ${person.lastName}`.trim() || null}
            icon={User}
          />
          <InfoItem label="Date of Birth" value={formatDate(person.dateOfBirth)} icon={Calendar} />
          {person.phone && (
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Phone</span>
                <CopyableText
                  text={getDisplayPhoneNumber(person.phone)}
                  label="Phone"
                  showLabel={false}
                  successMessage="Phone number copied"
                />
              </div>
            </div>
          )}
          <InfoItem label="Email" value={person.email} icon={Mail} />
          <InfoItem
            label="Address"
            value={
              person.address.street
                ? `${person.address.street}, ${person.address.city}, ${person.address.state} ${person.address.zip}`
                : null
            }
            icon={MapPin}
          />
          <InfoItem label="Living Arrangement" value={caseRecord.livingArrangement} />
          <InfoItem label="Marital Status" value={caseRecord.maritalStatus} icon={Heart} />
          <InfoItem label="Contact Methods" value={contactMethodsDisplay} />
        </div>
      </div>

      <Separator />

      {/* Relationships Section - Always shown for debugging */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Relationships</h3>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {person.relationships?.length ?? 0}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
          {person.relationships && person.relationships.length > 0 ? (
            person.relationships.map((rel, index) => (
              <div key={index} className="flex flex-col gap-1 p-3 border rounded-md bg-muted/10">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{rel.name}</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                    {rel.type}
                  </Badge>
                </div>
                {rel.phone && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <CopyableText
                      text={getDisplayPhoneNumber(rel.phone)}
                      label="Phone"
                      showLabel={false}
                      successMessage="Phone number copied"
                      textClassName="text-xs"
                      buttonClassName="text-xs px-1 py-0"
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground italic">No relationships added</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Initial Checks Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Initial Checks</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
          <ChecklistItem label="Application Validated" checked={caseRecord.appValidated} />
          <ChecklistItem label="With Waiver" checked={caseRecord.withWaiver} />
          <ChecklistItem label="Pregnancy" checked={caseRecord.pregnancy} />
          {retroMonthsDisplay && (
            <div className="col-span-full">
              <span className="text-sm text-muted-foreground">Retro Months: </span>
              <span className="text-sm font-medium">{retroMonthsDisplay}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Eligibility Verification Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Eligibility Verification</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
          <ChecklistItem label="Citizenship Verified" checked={caseRecord.citizenshipVerified} />
          <ChecklistItem label="Residency Verified" checked={caseRecord.residencyVerified} />
          <ChecklistItem
            label="Aged/Disabled Status Verified"
            checked={caseRecord.agedDisabledVerified}
          />
          <InfoItem
            label="AVS Consent Date"
            value={formatDate(caseRecord.avsConsentDate)}
            icon={Calendar}
          />
          <InfoItem
            label="Voter Form Status"
            value={
              caseRecord.voterFormStatus
                ? VOTER_STATUS_LABELS[caseRecord.voterFormStatus]
                : null
            }
          />
        </div>
      </div>

      <Separator />

      {/* Verification Reviews Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Verification Reviews</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
          <ChecklistItem label="VRs Reviewed" checked={caseRecord.reviewVRs} />
          <ChecklistItem label="Prior Budgets Reviewed" checked={caseRecord.reviewPriorBudgets} />
          <ChecklistItem label="Prior Narratives Reviewed" checked={caseRecord.reviewPriorNarr} />
          <ChecklistItem label="Interfaces Reviewed" checked={caseRecord.interfacesReviewed} />
          <ChecklistItem label="AVS Submitted" checked={caseRecord.avsSubmitted} />
        </div>
      </div>
    </div>
  );
}

export default IntakeChecklistView;
