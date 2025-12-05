import { useCallback, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { FinancialsGridView } from "./FinancialsGridView";
import { NotesDrawer } from "./NotesDrawer";
import { IntakeChecklistView } from "./IntakeChecklistView";
import { StoredCase } from "../../types/case";
import { ArrowLeft, Edit2, Trash2, Wallet, BellRing, FileText, ClipboardCheck, Star, StarOff, Phone, Mail } from "lucide-react";
import { withDataErrorBoundary } from "../error/ErrorBoundaryHOC";
import { CaseStatusMenu } from "./CaseStatusMenu";
import { Badge } from "../ui/badge";
import { cn, interactiveHoverClasses } from "../ui/utils";
import type { AlertWithMatch } from "../../utils/alertsData";
import { CaseAlertsDrawer } from "./CaseAlertsDrawer";
import { CopyButton } from "@/components/common/CopyButton";
import { CaseSummaryModal } from "./CaseSummaryModal";
import { useFinancialItems } from "../../hooks/useFinancialItems";
import { useNotes } from "../../hooks/useNotes";
import { formatUSPhone } from "@/utils/phoneFormatter";
import { formatDateForDisplay } from "@/utils/dateFormatting";

interface CaseDetailsProps {
  case: StoredCase;
  onBack: () => void;
  onEdit: () => void;
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
  onEdit,
  onDelete,
  alerts = [],
  onUpdateStatus,
  onResolveAlert,
  onUpdatePriority,
}: CaseDetailsProps) {
  
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  
  // Fetch financials and notes for case summary generation
  const { groupedItems: financials } = useFinancialItems(caseData.id);
  const { notes } = useNotes(caseData.id);

  const { totalAlerts, openAlertCount, hasOpenAlerts } = useMemo(() => {
    const total = alerts.length;
    const openCount = alerts.filter(alert => alert.status !== "resolved").length;
    return {
      totalAlerts: total,
      openAlertCount: openCount,
      hasOpenAlerts: openCount > 0,
    };
  }, [alerts]);

  const handleResolveAlert = useCallback(
    (alert: AlertWithMatch) => {
      onResolveAlert?.(alert);
    },
    [onResolveAlert],
  );

  const handleTogglePriority = useCallback(async () => {
    if (!onUpdatePriority) return;
    await onUpdatePriority([caseData.id], !caseData.priority);
  }, [onUpdatePriority, caseData.id, caseData.priority]);

  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  return (
    <div className="space-y-6">
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
                    value={caseData.caseRecord.applicationDate}
                    displayText={formatDateForDisplay(caseData.caseRecord.applicationDate)}
                    label="App Date"
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
            {/* Alerts indicator */}
            {totalAlerts > 0 ? (
              <>
                <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800 h-9 px-3">
                  <BellRing className="mr-1.5 h-3.5 w-3.5" />
                  {hasOpenAlerts
                    ? `${openAlertCount} open`
                    : "Resolved"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAlertsDrawerOpen(true)}
                >
                  View {hasOpenAlerts ? "Alerts" : "History"}
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="h-9 px-3 text-muted-foreground">
                <BellRing className="mr-1.5 h-3.5 w-3.5" />
                No alerts
              </Badge>
            )}
            <div className="w-px h-9 bg-border" />
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
              onClick={onEdit}
              className={interactiveHoverClasses}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
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
        <Tabs defaultValue="financials" className="w-full">
          <div className="border-b px-4 py-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="financials" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Financials
              </TabsTrigger>
              <TabsTrigger value="intake" className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Intake
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Financials Tab - Grid View */}
          <TabsContent value="financials" className="mt-0">
            <div className="p-4">
              <FinancialsGridView caseId={caseData.id} selectedCase={caseData} />
            </div>
          </TabsContent>

          {/* Intake Tab */}
          <TabsContent value="intake" className="mt-0">
            <div className="p-4">
              <IntakeChecklistView caseData={caseData} onEdit={onEdit} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Notes Bottom Drawer */}
      <NotesDrawer caseId={caseData.id} />

      <CaseAlertsDrawer
          alerts={alerts}
          open={alertsDrawerOpen}
          onOpenChange={setAlertsDrawerOpen}
          caseName={caseData.name || "Unnamed Case"}
          caseId={caseData.id}
          caseStatus={caseData.status}
          onUpdateCaseStatus={onUpdateStatus}
          onResolveAlert={onResolveAlert ? handleResolveAlert : undefined}
        />

      <CaseSummaryModal
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        caseData={caseData}
        financials={financials}
        notes={notes}
      />
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);