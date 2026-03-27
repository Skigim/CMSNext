import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { FinancialsGridView } from "./FinancialsGridView";
import { NotesPopover } from "./NotesPopover";
import { AlertsPopover } from "./AlertsPopover";
import { IntakeFormView } from "./IntakeFormView";
import type { StoredCase } from "../../types/case";
import { ArrowLeft, Trash2, Star, StarOff, Phone, Mail, FileSignature, Pencil, FileText, Archive, ChevronDown } from "lucide-react";
import { withDataErrorBoundary } from "../error/ErrorBoundaryHOC";
import { CaseStatusMenu } from "./CaseStatusMenu";
import { cn, interactiveHoverClasses } from "../ui/utils";
import type { AlertWithMatch } from "../../utils/alertsData";
import { CopyButton } from "@/components/common/CopyButton";
import { PinButton } from "@/components/common/PinButton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CaseSummaryModal } from "./CaseSummaryModal";
import { VRGeneratorModal } from "./VRGeneratorModal";
import { NarrativeGeneratorModal } from "./NarrativeGeneratorModal";
import { useFinancialItems } from "../../hooks/useFinancialItems";
import { useNotes } from "../../hooks/useNotes";
import { useTemplates } from "@/contexts/TemplateContext";
import {
  formatCasePersonDisplayName,
  getLinkedCasePersonRoleLabel,
  getPrimaryCasePersonForDisplay,
  getPrimaryCasePersonRef,
} from "@/domain/cases";
import { formatUSPhone, formatDateForDisplay, parseLocalDate } from "@/domain/common";
import { clickToCopy } from "@/utils/clipboard";

/**
 * Calculate 90 days from a date and format as tooltip text
 */
function get90DayTooltip(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  if (!date) return "";
  date.setDate(date.getDate() + 90);
  return `90 Days = ${formatDateForDisplay(date.toISOString())}`;
}

function getLinkedPersonChipContent(
  caseData: StoredCase,
  person: NonNullable<StoredCase["linkedPeople"]>[number]["person"],
  role: NonNullable<StoredCase["linkedPeople"]>[number]["ref"]["role"],
): { name: string; roleLabel: string } {
  return {
    name: formatCasePersonDisplayName(person),
    roleLabel: getLinkedCasePersonRoleLabel(caseData, person, role),
  };
}

interface CaseDetailsProps {
  case: StoredCase;
  onBack: () => void;
  onDelete: () => void;
  onArchive?: () => Promise<void>;
  isArchiving?: boolean;
  alerts?: AlertWithMatch[];
  onUpdateStatus?: (
    caseId: string,
    status: StoredCase["status"],
  ) => Promise<StoredCase | null> | StoredCase | null | void;
  onResolveAlert?: (alert: AlertWithMatch) => Promise<void> | void;
  onUpdatePriority?: (caseIds: string[], priority: boolean) => Promise<number>;
}

export function CaseDetails(props: Readonly<CaseDetailsProps>) {
  const {
    case: initialCase,
    onBack,
    onDelete,
    onArchive,
    isArchiving = false,
    alerts = [],
    onUpdateStatus,
    onResolveAlert,
    onUpdatePriority,
  } = props;
  const [mostRecentlySavedCase, setMostRecentlySavedCase] = useState<StoredCase | null>(null);
  const caseData = useMemo(() => {
    if (!mostRecentlySavedCase || mostRecentlySavedCase.id !== initialCase.id) {
      return initialCase;
    }

    // Treat the later updatedAt timestamp as the freshest copy so locally saved
    // intake edits win until the parent prop catches up with the same or newer data.
    return mostRecentlySavedCase.updatedAt > initialCase.updatedAt
      ? mostRecentlySavedCase
      : initialCase;
  }, [initialCase, mostRecentlySavedCase]);
  
  // Fetch financials and notes for case summary generation
  const { groupedItems: financials, items: financialItemsList } = useFinancialItems(caseData.id);
  const { notes } = useNotes(caseData.id);
  
  // Get VR templates from unified template system
  const { getTemplatesByCategory } = useTemplates();
  const vrTemplates = useMemo(() => getTemplatesByCategory('vr'), [getTemplatesByCategory]);
  const primaryPerson = getPrimaryCasePersonForDisplay(caseData);
  const primaryPersonRef = getPrimaryCasePersonRef(caseData);
  const resolvedPrimaryPersonId = primaryPersonRef?.personId ?? primaryPerson?.id;
  const additionalLinkedPeople =
    caseData.linkedPeople?.filter(({ ref }) => ref.personId !== resolvedPrimaryPersonId) ?? [];

  const handleResolveAlert = (alert: AlertWithMatch) => {
    onResolveAlert?.(alert);
  };

  const handleTogglePriority = async () => {
    if (!onUpdatePriority) return;
    await onUpdatePriority([caseData.id], !caseData.priority);
  };

  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [vrModalOpen, setVrModalOpen] = useState(false);
  const [narrativeModalOpen, setNarrativeModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  if (editModalOpen) {
    return (
      <IntakeFormView
        existingCase={caseData}
        onSuccess={(savedCase) => {
          setMostRecentlySavedCase(savedCase);
          setEditModalOpen(false);
        }}
        onCancel={() => setEditModalOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-6" data-papercut-context="CaseDetails">
      {/* Enhanced Header with Better Visual Hierarchy */}
      <div className="bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
              className={cn(interactiveHoverClasses, "mt-0.5")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">
                  {caseData.name || 'Unnamed Case'}
                </h1>
                <CaseStatusMenu
                  caseId={caseData.id}
                  status={caseData.status}
                  onUpdateStatus={onUpdateStatus}
                />
                {onUpdatePriority && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTogglePriority}
                    className={cn(
                      "h-7 px-2",
                      caseData.priority 
                        ? "text-amber-600 hover:text-amber-700" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={caseData.priority ? "Remove priority" : "Mark as priority"}
                  >
                    {caseData.priority ? (
                      <Star className="h-4 w-4 fill-current" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                )}
                {/* Pin button */}
                <PinButton
                  caseId={caseData.id}
                  caseName={caseData.name}
                  size="default"
                  className="h-7 w-auto px-2"
                />
                {/* Retro/Waiver indicators */}
                {caseData.caseRecord?.withWaiver && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    Waiver
                  </span>
                )}
                {caseData.caseRecord?.retroRequested && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    Retro
                  </span>
                )}
              </div>
              
              {/* Key case identifiers */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <CopyButton
                  value={caseData.mcn}
                  label="MCN"
                  mono
                  className="text-muted-foreground"
                  labelClassName="text-sm font-medium"
                  buttonClassName={cn(interactiveHoverClasses, "text-foreground")}
                  textClassName="text-sm"
                  variant="muted"
                />
                {caseData.caseRecord?.applicationDate && (
                  <CopyButton
                    value={formatDateForDisplay(caseData.caseRecord.applicationDate)}
                    label="App Date"
                    tooltip={get90DayTooltip(caseData.caseRecord.applicationDate)}
                    tooltipSide="bottom"
                    className="text-muted-foreground"
                    labelClassName="text-sm font-medium"
                    buttonClassName={cn(interactiveHoverClasses, "text-foreground")}
                    textClassName="text-sm"
                    variant="muted"
                  />
                )}
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {primaryPerson?.phone && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    <CopyButton
                      value={primaryPerson.phone}
                      displayText={formatUSPhone(primaryPerson.phone)}
                      label="Phone"
                      showLabel={false}
                      buttonClassName={interactiveHoverClasses}
                      variant="plain"
                    />
                  </span>
                )}
                {primaryPerson?.email && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    <CopyButton
                      value={primaryPerson.email}
                      label="Email"
                      showLabel={false}
                      buttonClassName={interactiveHoverClasses}
                      variant="plain"
                    />
                  </span>
                )}
              </div>
              {additionalLinkedPeople.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {additionalLinkedPeople.map(({ ref, person }) => {
                    const phone = person.phone?.trim() || null;
                    const email = person.email?.trim() || null;
                    const { name, roleLabel } = getLinkedPersonChipContent(caseData, person, ref.role);
                    const accessibleLabel = `${roleLabel}: ${name}`;
                    const formattedPhone = phone ? formatUSPhone(phone) : null;

                    return (
                      <Tooltip key={`${ref.personId}-${ref.role}`}>
                        <TooltipTrigger asChild>
                          {phone ? (
                            <button
                              type="button"
                              className={cn(
                                "inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground transition-colors",
                                interactiveHoverClasses,
                              )}
                              aria-label={`Copy ${formatCasePersonDisplayName(person)} phone ${formattedPhone}`}
                              onClick={() =>
                                clickToCopy(phone, {
                                  successMessage: "Phone number copied",
                                })
                              }
                            >
                              <span className="font-medium text-foreground">{name}</span>
                              <span className="ml-1 text-muted-foreground">{roleLabel}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-disabled="true"
                              className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              aria-label={accessibleLabel}
                            >
                              <span className="font-medium text-foreground">{name}</span>
                              <span className="ml-1 text-muted-foreground">{roleLabel}</span>
                            </button>
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <dl className="space-y-1">
                            <div className="flex gap-1">
                              <dt className="font-medium">Phone:</dt>
                              <dd>{formattedPhone || "Not provided"}</dd>
                            </div>
                            <div className="flex gap-1">
                              <dt className="font-medium">Email:</dt>
                              <dd>{email || "Not provided"}</dd>
                            </div>
                          </dl>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            {/* Notes popover */}
            <NotesPopover caseId={caseData.id} className={interactiveHoverClasses} />
            
            {/* Alerts popover */}
            <AlertsPopover
              alerts={alerts}
              className={interactiveHoverClasses}
              onResolveAlert={onResolveAlert ? handleResolveAlert : undefined}
            />
            <div className="w-px h-9 bg-border" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className={interactiveHoverClasses}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNarrativeModalOpen(true)}
              className={interactiveHoverClasses}
            >
              <FileText className="w-4 h-4 mr-2" />
              Narratives
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSummaryModalOpen(true)}
              className={interactiveHoverClasses}
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate Summary
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setVrModalOpen(true)}
              className={interactiveHoverClasses}
            >
              <FileSignature className="w-4 h-4 mr-2" />
              Generate VRs
            </Button>
            
            {/* Archive/Delete split button */}
            <div className="flex items-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isArchiving}
                    className={cn(
                      interactiveHoverClasses,
                      "rounded-r-none border-r-0",
                    )}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {isArchiving ? "Archiving..." : "Archive"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive Case</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to archive this case for {caseData.name}? 
                      The case and its data will be moved to the archive and can be restored later if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onArchive}
                      disabled={isArchiving || !onArchive}
                    >
                      Archive Case
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    aria-label="Open case actions menu"
                    className={cn(
                      interactiveHoverClasses,
                      "rounded-l-none px-2",
                    )}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        variant="destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete permanently
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Case</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to permanently delete this case for {caseData.name}? 
                          This action cannot be undone. This will permanently delete the case and all 
                          associated data including financial items and notes.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={onDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Case
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Financials Grid View */}
      <div className="rounded-xl border bg-card/30 shadow-lg pb-16">
        <div className="p-4">
          <FinancialsGridView caseId={caseData.id} selectedCase={caseData} />
        </div>
      </div>

      <CaseSummaryModal
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        caseData={caseData}
        financials={financials}
        notes={notes}
      />

      <VRGeneratorModal
        open={vrModalOpen}
        onOpenChange={setVrModalOpen}
        storedCase={caseData}
        financialItems={financialItemsList}
        vrTemplates={vrTemplates}
      />

      <NarrativeGeneratorModal
        open={narrativeModalOpen}
        onOpenChange={setNarrativeModalOpen}
        storedCase={caseData}
      />
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);
