import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CaseSection } from "./CaseSection";
import { CaseDisplay, CaseCategory, FinancialItem } from "../types/case";
import { ArrowLeft, Edit2, Trash2, FileText, Landmark, Wallet, Receipt } from "lucide-react";
import { withDataErrorBoundary } from "./ErrorBoundaryHOC";

interface CaseDetailsProps {
  case: CaseDisplay;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: (category: CaseCategory) => void;
  onEditItem: (category: CaseCategory, itemId: string) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
  onBatchUpdateItem?: (category: CaseCategory, itemId: string, updatedItem: Partial<FinancialItem>) => Promise<void>;
  onCreateItem?: (category: CaseCategory, itemData: Omit<FinancialItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onAddNote: () => void;
  onEditNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
}

export function CaseDetails({ 
  case: caseData, 
  onBack, 
  onEdit,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onBatchUpdateItem,
  onCreateItem,
  onAddNote,
  onEditNote,
  onDeleteNote
}: CaseDetailsProps) {
  
    // Handle batched update for inline editing
  const handleUpdateFullItem = async (category: CaseCategory, itemId: string, updatedItem: FinancialItem) => {
    if (!caseData || !onBatchUpdateItem) return;

    try {
      // Use batch update function to avoid multiple toasts
      await onBatchUpdateItem(category, itemId, updatedItem);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const getStatusColor = (status: CaseDisplay['status']) => {
    switch (status) {
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800';
      case 'Priority':
        return 'bg-orange-500/10 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-800';
      case 'Review':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-800';
      case 'Completed':
        return 'bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-800';
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
                <Badge className={`${getStatusColor(caseData.status || 'In Progress')}`}>
                  {caseData.status || 'In Progress'}
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
                  onEditItem={onEditItem}
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
                  onEditItem={onEditItem}
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
                  onEditItem={onEditItem}
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
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Notes</h2>
                {caseData.caseRecord.notes && caseData.caseRecord.notes.length > 0 && (
                  <Badge variant="secondary">
                    {caseData.caseRecord.notes.length}
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={onAddNote}>
                + Add Note
              </Button>
            </div>
            
            {!caseData.caseRecord.notes || caseData.caseRecord.notes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">No notes added yet</p>
                <Button onClick={onAddNote} variant="outline">
                  + Add First Note
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {caseData.caseRecord.notes
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((note) => {
                    let contentHash = '';
                    if (note.content) {
                      try {
                        contentHash = btoa(unescape(encodeURIComponent(note.content.slice(0, 50)))).slice(0, 8);
                      } catch (error) {
                        contentHash = note.content.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '');
                      }
                    }
                    const compositeKey = note.id || `${note.createdAt}-${contentHash}`;
                    
                    return (
                      <div key={compositeKey} className="bg-card/50 border p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="flex items-center gap-2">
                            {note.category && (
                              <Badge variant="secondary" className="text-xs py-0.5">
                                {note.category}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => onEditNote(note.id)}
                              className="h-5 w-5 p-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => onDeleteNote(note.id)}
                              className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {note.content}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);