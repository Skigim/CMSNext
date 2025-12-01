import { useCallback, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CaseSection } from "./CaseSection";
import { FinancialsGridView } from "./FinancialsGridView";
import { NotesDrawer } from "./NotesDrawer";
import { IntakeChecklistView } from "./IntakeChecklistView";
import { StoredCase } from "../../types/case";
import { ArrowLeft, Edit2, Trash2, Landmark, Wallet, Receipt, BellRing, FileText, ClipboardCheck, LayoutGrid, List } from "lucide-react";
import { withDataErrorBoundary } from "../error/ErrorBoundaryHOC";
import { CaseStatusMenu } from "./CaseStatusMenu";
import { Badge } from "../ui/badge";
import { cn, interactiveHoverClasses } from "../ui/utils";
import type { AlertWithMatch } from "../../utils/alertsData";
import { CaseAlertsDrawer } from "./CaseAlertsDrawer";
import { McnCopyControl } from "@/components/common/McnCopyControl";
import { generateCaseSummary } from "../../utils/caseSummaryGenerator";
import { clickToCopy } from "../../utils/clipboard";

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
}

type FinancialsViewMode = "tabs" | "grid";

export function CaseDetails({ 
  case: caseData, 
  onBack, 
  onEdit,
  onDelete,
  alerts = [],
  onUpdateStatus,
  onResolveAlert,
}: CaseDetailsProps) {
  
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [financialsViewMode, setFinancialsViewMode] = useState<FinancialsViewMode>("tabs");

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

  const handleGenerateSummary = useCallback(() => {
    const summary = generateCaseSummary(caseData);
    clickToCopy(summary, {
      successMessage: "Case summary copied to clipboard",
      errorMessage: "Failed to copy summary to clipboard",
    });
  }, [caseData]);

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
              </div>
              <McnCopyControl
                mcn={caseData.mcn}
                className="text-muted-foreground"
                labelClassName="text-sm font-medium"
                buttonClassName={cn(interactiveHoverClasses, "text-foreground")}
                textClassName="text-sm"
                variant="muted"
                interactive
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {totalAlerts > 0 ? (
                  <div className="flex items-center gap-2">
                    <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800">
                      <BellRing className="mr-1 h-3 w-3" />
                      {hasOpenAlerts
                        ? `${openAlertCount} open alert${openAlertCount === 1 ? "" : "s"}`
                        : "All alerts resolved"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setAlertsDrawerOpen(true)}
                    >
                      View {hasOpenAlerts ? "alerts" : "history"}
                    </Button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <BellRing className="h-3 w-3" /> All clear — no alerts for this case
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleGenerateSummary}
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
          <div className="border-b px-4 pt-4">
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

          {/* Financials Tab with Sub-tabs or Grid View */}
          <TabsContent value="financials" className="mt-0">
            <div className="p-4">
              {/* View Mode Toggle */}
              <div className="flex justify-end mb-4">
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  <Button
                    variant={financialsViewMode === "tabs" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFinancialsViewMode("tabs")}
                    className="h-8 px-3 gap-2"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Tabs</span>
                  </Button>
                  <Button
                    variant={financialsViewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setFinancialsViewMode("grid")}
                    className="h-8 px-3 gap-2"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="hidden sm:inline">Grid</span>
                  </Button>
                </div>
              </div>

              {financialsViewMode === "grid" ? (
                <FinancialsGridView caseId={caseData.id} />
              ) : (
                <Tabs defaultValue="resources" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="resources" className="flex items-center gap-2">
                      <Landmark className="w-4 h-4" />
                      Resources
                    </TabsTrigger>
                    <TabsTrigger value="income" className="flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Income
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Expenses
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="resources" className="mt-4">
                    <CaseSection
                      title="Resources"
                      category="resources"
                      caseId={caseData.id}
                    />
                  </TabsContent>

                  <TabsContent value="income" className="mt-4">
                    <CaseSection
                      title="Income"
                      category="income"
                      caseId={caseData.id}
                    />
                  </TabsContent>

                  <TabsContent value="expenses" className="mt-4">
                    <CaseSection
                      title="Expenses"
                      category="expenses"
                      caseId={caseData.id}
                    />
                  </TabsContent>
                </Tabs>
              )}
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
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);