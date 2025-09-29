import { Button } from "../ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CaseSection } from "./CaseSection";
import { NotesSection } from "./NotesSection";
import { CaseDisplay, CaseCategory, FinancialItem, NewNoteData } from "../../types/case";
import { ArrowLeft, Edit2, Trash2, Landmark, Wallet, Receipt, Copy, BellRing } from "lucide-react";
import { withDataErrorBoundary } from "../error/ErrorBoundaryHOC";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { clickToCopy } from "../../utils/clipboard";
import { Badge } from "../ui/badge";
import { cn, interactiveHoverClasses } from "../ui/utils";
import type { AlertWithMatch } from "../../utils/alertsData";

interface CaseDetailsProps {
  case: CaseDisplay;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: (category: CaseCategory) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
  onBatchUpdateItem?: (category: CaseCategory, itemId: string, updatedItem: Partial<FinancialItem>) => Promise<void>;
  onCreateItem?: (category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onAddNote: () => void;
  onEditNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onBatchUpdateNote?: (noteId: string, updatedNote: NewNoteData) => Promise<void>;
  onBatchCreateNote?: (noteData: NewNoteData) => Promise<void>;
  alerts?: AlertWithMatch[];
}

export function CaseDetails({ 
  case: caseData, 
  onBack, 
  onEdit,
  onDelete,
  onAddItem,
  onDeleteItem,
  onBatchUpdateItem,
  onCreateItem,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onBatchUpdateNote,
  onBatchCreateNote,
  alerts = [],
}: CaseDetailsProps) {
  
  // Handle batched update for inline editing
  const handleUpdateFullItem = async (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => {
    if (!caseData || !onBatchUpdateItem) return;

    try {
      // Use batch update function to avoid multiple toasts
      await onBatchUpdateItem(category, itemId, updatedItem);
    } catch (error) {
      console.error('[CaseDetails] Failed to update item:', error);
    }
  };

  const totalAlerts = alerts.length;

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
                <CaseStatusBadge status={caseData.status} />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm font-medium">MCN:</span>
                {caseData.mcn ? (
                  <button
                    type="button"
                    onClick={() =>
                      void clickToCopy(caseData.mcn!, {
                        successMessage: `MCN ${caseData.mcn} copied`,
                      })
                    }
                    className={cn(
                      interactiveHoverClasses,
                      "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-sm text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                    aria-label="Copy MCN to clipboard"
                  >
                    <span>{caseData.mcn}</span>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded-md">
                    No MCN
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {totalAlerts > 0 ? (
                  <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-800">
                    <BellRing className="mr-1 h-3 w-3" />
                    {totalAlerts} alert{totalAlerts === 1 ? "" : "s"} linked to this case
                  </Badge>
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

      {/* Content - Resizable Layout */}
      <ResizablePanelGroup 
        direction="horizontal" 
        className="h-[calc(100vh-200px)] min-h-[400px] rounded-xl border bg-card/30 shadow-lg overflow-hidden"
      >
        {/* Left Panel: Financial Sections with Tabs */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full p-4 flex flex-col">
            <Tabs defaultValue="resources" className="w-full flex-1 flex flex-col">
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
              
              <TabsContent value="resources" className="mt-4 flex-1 overflow-y-auto">
                <CaseSection
                  title="Resources"
                  category="resources"
                  items={caseData.caseRecord.financials.resources || []}
                  onAddItem={onAddItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateFullItem={handleUpdateFullItem}
                  onCreateItem={onCreateItem}
                />
              </TabsContent>
              
              <TabsContent value="income" className="mt-4 flex-1 overflow-y-auto">
                <CaseSection
                  title="Income"
                  category="income"
                  items={caseData.caseRecord.financials.income || []}
                  onAddItem={onAddItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateFullItem={handleUpdateFullItem}
                  onCreateItem={onCreateItem}
                />
              </TabsContent>
              
              <TabsContent value="expenses" className="mt-4 flex-1 overflow-y-auto">
                <CaseSection
                  title="Expenses"
                  category="expenses"
                  items={caseData.caseRecord.financials.expenses || []}
                  onAddItem={onAddItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateFullItem={handleUpdateFullItem}
                  onCreateItem={onCreateItem}
                />
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Notes Section */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="p-4 bg-muted/30 overflow-y-auto">
            <NotesSection
              notes={caseData.caseRecord.notes || []}
              onAddNote={onAddNote}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
              onUpdateNote={onBatchUpdateNote}
              onCreateNote={onBatchCreateNote}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);