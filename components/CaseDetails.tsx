import { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { CaseSection } from "./CaseSection";
import { NotesSection } from "./NotesSection";
import { CaseDisplay, CaseCategory } from "../types/case";
import { ArrowLeft, Edit2, Trash2, LayoutGrid, Table } from "lucide-react";
import { withDataErrorBoundary } from "./ErrorBoundaryHOC";

interface CaseDetailsProps {
  case: CaseDisplay;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: (category: CaseCategory) => void;
  onEditItem: (category: CaseCategory, itemId: string) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
  onUpdateItem?: (category: CaseCategory, itemId: string, field: string, value: string) => Promise<void>;
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
  onUpdateItem,
  onAddNote,
  onEditNote,
  onDeleteNote
}: CaseDetailsProps) {
  const [financialView, setFinancialView] = useState<'cards' | 'table'>('cards');
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const handleViewChange = (value: string | undefined) => {
    if (value && value !== financialView) {
      setIsTransitioning(true);
      setTimeout(() => {
        setFinancialView(value as 'cards' | 'table');
        setIsTransitioning(false);
      }, 150);
    }
  };

  const getStatusColor = (status: CaseDisplay['status']) => {
    switch (status) {
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Priority':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Review':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      {/* Enhanced Header with Better Visual Hierarchy */}
      <div className="bg-gradient-to-r from-card via-card to-card/50 border rounded-xl p-8 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
              className="mt-1 hover:bg-accent/50 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-foreground leading-tight">
                  {caseData.name || 'Unnamed Case'}
                </h1>
                <Badge className={`${getStatusColor(caseData.status || 'In Progress')} font-medium px-3 py-1 text-sm transition-all duration-200 hover:scale-105`}>
                  {caseData.status || 'In Progress'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm font-medium">MCN:</span>
                <span className="text-sm font-mono bg-muted/50 px-2 py-1 rounded-md">
                  {caseData.mcn || 'No MCN'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onEdit}
              className="hover:bg-accent/50 transition-all duration-200 hover:scale-105"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Case
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-105"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Case
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="animate-in fade-in-0 zoom-in-95 duration-300">
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
            <Button className="bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 shadow-sm">
              Generate Summary
            </Button>
            <ToggleGroup 
              type="single" 
              value={financialView}
              onValueChange={handleViewChange}
              variant="outline"
              size="sm"
              className="bg-background/50 rounded-lg p-1 transition-all duration-200"
            >
              <ToggleGroupItem 
                value="cards" 
                aria-label="Card view"
                className="transition-all duration-200 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Cards
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="table" 
                aria-label="Table view"
                className="transition-all duration-200 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Table className="h-4 w-4 mr-2" />
                Table
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* Content - Resizable Layout with Enhanced Animations */}
      <div className="block lg:hidden">
        {/* Mobile: Stacked Layout with Staggered Animation */}
        <div className="space-y-8">
          {/* Financial Sections */}
          <div className={`space-y-6 animate-in slide-in-from-left-4 delay-100 transition-all duration-300 ${isTransitioning ? 'opacity-50 scale-98' : 'opacity-100 scale-100'}`}>
            <CaseSection
              title="Resources"
              category="resources"
              view={financialView}
              items={caseData.caseRecord.financials.resources || []}
              onAddItem={onAddItem}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onUpdateItem={onUpdateItem}
            />
            <CaseSection
              title="Income"
              category="income"
              view={financialView}
              items={caseData.caseRecord.financials.income || []}
              onAddItem={onAddItem}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onUpdateItem={onUpdateItem}
            />
            <CaseSection
              title="Expenses"
              category="expenses"
              view={financialView}
              items={caseData.caseRecord.financials.expenses || []}
              onAddItem={onAddItem}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onUpdateItem={onUpdateItem}
            />
          </div>

          {/* Notes Section */}
          <div className="animate-in slide-in-from-right-4 duration-500 delay-200">
            <NotesSection
              notes={caseData.caseRecord.notes || []}
              onAddNote={onAddNote}
              onEditNote={onEditNote}
              onDeleteNote={onDeleteNote}
            />
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        {/* Desktop: Resizable 2 Column Layout with Enhanced Styling */}
        <ResizablePanelGroup 
          direction="horizontal" 
          className="min-h-[700px] rounded-xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-500 overflow-hidden"
        >
          {/* Left Panel: Financial Sections with Gradient Background */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="p-8 space-y-8 h-full overflow-y-auto bg-gradient-to-br from-background via-background to-accent/5">
              <div className={`animate-in slide-in-from-left-4 delay-100 transition-all duration-300 ${isTransitioning ? 'opacity-50 scale-98' : 'opacity-100 scale-100'}`}>
                <CaseSection
                  title="Resources"
                  category="resources"
                  view={financialView}
                  items={caseData.caseRecord.financials.resources || []}
                  onAddItem={onAddItem}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateItem={onUpdateItem}
                />
              </div>
              <div className={`animate-in slide-in-from-left-4 delay-150 transition-all duration-300 ${isTransitioning ? 'opacity-50 scale-98' : 'opacity-100 scale-100'}`}>
                <CaseSection
                  title="Income"
                  category="income"
                  view={financialView}
                  items={caseData.caseRecord.financials.income || []}
                  onAddItem={onAddItem}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateItem={onUpdateItem}
                />
              </div>
              <div className={`animate-in slide-in-from-left-4 delay-200 transition-all duration-300 ${isTransitioning ? 'opacity-50 scale-98' : 'opacity-100 scale-100'}`}>
                <CaseSection
                  title="Expenses"
                  category="expenses"
                  view={financialView}
                  items={caseData.caseRecord.financials.expenses || []}
                  onAddItem={onAddItem}
                  onEditItem={onEditItem}
                  onDeleteItem={onDeleteItem}
                  onUpdateItem={onUpdateItem}
                />
              </div>
            </div>
          </ResizablePanel>

          {/* Enhanced Resizable Handle */}
          <ResizableHandle 
            withHandle 
            className="hover:bg-primary/20 transition-colors duration-200 group"
          />

          {/* Right Panel: Notes Section with Subtle Background */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="p-8 h-full overflow-y-auto bg-gradient-to-bl from-background via-background to-accent/5 animate-in slide-in-from-right-4 duration-500 delay-100">
              <NotesSection
                key="notes-desktop"
                notes={caseData.caseRecord.notes || []}
                onAddNote={onAddNote}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);