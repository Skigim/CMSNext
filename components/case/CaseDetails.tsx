import { useState, useMemo } from "react";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { FinancialsGridView } from "./FinancialsGridView";
import { NotesPopover } from "./NotesPopover";
import { AlertsPopover } from "./AlertsPopover";
import { CaseIntakeScreen } from "./CaseIntakeScreen";
import type { StoredCase, NewPersonData, NewCaseRecordData } from "../../types/case";
import { ArrowLeft, Trash2, Wallet, FileText, ClipboardCheck, Star, StarOff, Phone, Mail, FileSignature, Pin, PinOff } from "lucide-react";
import { withDataErrorBoundary } from "../error/ErrorBoundaryHOC";
import { CaseStatusMenu } from "./CaseStatusMenu";
import { cn, interactiveHoverClasses } from "../ui/utils";
import type { AlertWithMatch } from "../../utils/alertsData";
import { CopyButton } from "@/components/common/CopyButton";
import { CaseSummaryModal } from "./CaseSummaryModal";
import { VRGeneratorModal } from "./VRGeneratorModal";
import { NarrativeGeneratorModal } from "./NarrativeGeneratorModal";
import { useFinancialItems } from "../../hooks/useFinancialItems";
import { useNotes } from "../../hooks/useNotes";
import { usePinnedCases } from "../../hooks/usePinnedCases";
import { useTemplates } from "@/contexts/TemplateContext";
import { formatUSPhone } from "@/domain/common";
import { formatDateForDisplay, parseLocalDate } from "@/domain/common";

/**
 * Calculate 90 days from a date and format as tooltip text
 */
function get90DayTooltip(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  if (!date) return "";
  date.setDate(date.getDate() + 90);
  return `90 Days = ${formatDateForDisplay(date.toISOString())}`;
}

interface CaseDetailsProps {
  case: StoredCase;
  onBack: () => void;
  onSave: (caseData: { person: NewPersonData; caseRecord: NewCaseRecordData }) => Promise<void>;
  onDelete: () => void;
  alerts?: AlertWithMatch[];
  onUpdateStatus?: (
    caseId: string,
    status: StoredCase["status"],
  ) => Promise<StoredCase | null> | StoredCase | null | void;
  onResolveAlert?: (alert: AlertWithMatch) => Promise<void> | void;
  onUpdatePriority?: (caseIds: string[], priority: boolean) => Promise<number>;
}

export function CaseDetails({ 
  case: caseData, 
  onBack, 
  onSave,
  onDelete,
  alerts = [],
  onUpdateStatus,
  onResolveAlert,
  onUpdatePriority,
}: CaseDetailsProps) {
  
  // Fetch financials and notes for case summary generation
  const { groupedItems: financials, items: financialItemsList } = useFinancialItems(caseData.id);
  const { notes } = useNotes(caseData.id);
  
  // Pinned cases functionality
  const { isPinned, togglePin: togglePinCase } = usePinnedCases();
  const caseIsPinned = isPinned(caseData.id);
  
  // Get VR templates from unified template system
  const { getTemplatesByCategory } = useTemplates();
  const vrTemplates = useMemo(() => getTemplatesByCategory('vr'), [getTemplatesByCategory]);

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePinCase(caseData.id)}
                  className={cn(
                    "h-7 px-2",
                    caseIsPinned 
                      ? "text-blue-600 hover:text-blue-700" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={caseIsPinned ? "Unpin case" : "Pin case"}
                >
                  {caseIsPinned ? (
                    <Pin className="h-4 w-4 fill-current" />
                  ) : (
                    <PinOff className="h-4 w-4" />
                  )}
                </Button>
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
                {caseData.person?.phone && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    <CopyButton
                      value={caseData.person.phone}
                      displayText={formatUSPhone(caseData.person.phone)}
                      label="Phone"
                      showLabel={false}
                      buttonClassName={interactiveHoverClasses}
                      variant="plain"
                    />
                  </span>
                )}
                {caseData.person?.email && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    <CopyButton
                      value={caseData.person.email}
                      label="Email"
                      showLabel={false}
                      buttonClassName={interactiveHoverClasses}
                      variant="plain"
                    />
                  </span>
                )}
              </div>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={cn(
                    interactiveHoverClasses,
                    "text-destructive hover:text-destructive hover:bg-destructive/10",
                  )}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Case</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this case for {caseData.name}? This action cannot be undone.
                    This will permanently delete the case and all associated data including financial items and notes.
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
          </div>
        </div>
      </div>

      {/* Content - Top-level Tabs */}
      <div className="rounded-xl border bg-card/30 shadow-lg pb-16">
        <Tabs defaultValue="details" className="w-full">
          <div className="border-b px-4 py-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="financials" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Financials
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Details Tab - 3-Column Inline Editing */}
          <TabsContent value="details" className="mt-0">
            <div className="p-4">
              <CaseIntakeScreen caseData={caseData} onSave={onSave} />
            </div>
          </TabsContent>

          {/* Financials Tab - Grid View */}
          <TabsContent value="financials" className="mt-0">
            <div className="p-4">
              <FinancialsGridView caseId={caseData.id} selectedCase={caseData} />
            </div>
          </TabsContent>
        </Tabs>
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