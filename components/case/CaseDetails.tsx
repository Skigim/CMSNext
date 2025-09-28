import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CaseSection } from "./CaseSection";
import { NotesSection } from "./NotesSection";
import { CaseDisplay, CaseCategory, FinancialItem, NewNoteData } from "../../types/case";
import { ArrowLeft, Edit2, Trash2, Landmark, Wallet, Receipt } from "lucide-react";
import { withDataErrorBoundary } from "../error/ErrorBoundaryHOC";

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
  onBatchCreateNote
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

  const getStatusColor = (status: CaseDisplay['status']) => {
    switch (status) {
      case 'Pending':
        return 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800';
      case 'Approved':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-800';
      case 'Denied':
        return 'bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-800';
      case 'Spenddown':
        return 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-800';
    }
  };

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
              className="mt-0.5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">
                  {caseData.name || 'Unnamed Case'}
                </h1>
                <Badge className={`${getStatusColor(caseData.status || 'Pending')}`}>
                  {caseData.status || 'Pending'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm font-medium">MCN:</span>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded-md">
                  {caseData.mcn || 'No MCN'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onEdit}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
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