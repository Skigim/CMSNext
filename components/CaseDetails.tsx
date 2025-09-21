import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { CaseSection } from "./CaseSection";
import { NotesSection } from "./NotesSection";
import { CaseDisplay, CaseCategory } from "../types/case";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { withDataErrorBoundary } from "./ErrorBoundaryHOC";

interface CaseDetailsProps {
  case: CaseDisplay;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: (category: CaseCategory) => void;
  onEditItem: (category: CaseCategory, itemId: string) => void;
  onDeleteItem: (category: CaseCategory, itemId: string) => void;
  onAddNote: () => void;
  onEditNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  financialView?: 'cards' | 'table';
}

export function CaseDetails({ 
  case: caseData, 
  onBack, 
  onEdit,
  onDelete,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAddNote,
  onEditNote,
  onDeleteNote,
  financialView = 'cards'
}: CaseDetailsProps) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1>{caseData.name || 'Unnamed Case'}</h1>
                <Badge className={getStatusColor(caseData.status || 'In Progress')}>
                  {caseData.status || 'In Progress'}
                </Badge>
              </div>
              <p className="text-muted-foreground">MCN: {caseData.mcn || 'No MCN'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onEdit}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Case
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Case
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
            <Button>
              Generate Summary
            </Button>
            <Button variant="outline">
              Open VR App
            </Button>
          </div>
        </div>
      </div>

      {/* Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Financial Sections */}
        <div className="space-y-6">
          <CaseSection
            title="Resources"
            category="resources"
            view={financialView}
            items={caseData.caseRecord.financials.resources || []}
            onAddItem={onAddItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
          />
          <CaseSection
            title="Income"
            category="income"
            view={financialView}
            items={caseData.caseRecord.financials.income || []}
            onAddItem={onAddItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
          />
          <CaseSection
            title="Expenses"
            category="expenses"
            view={financialView}
            items={caseData.caseRecord.financials.expenses || []}
            onAddItem={onAddItem}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
          />
        </div>

        {/* Right Column: Notes Section */}
        <div>
          <NotesSection
            notes={caseData.caseRecord.notes || []}
            onAddNote={onAddNote}
            onEditNote={onEditNote}
            onDeleteNote={onDeleteNote}
          />
        </div>
      </div>
    </div>
  );
}

// Export with error boundary for data operations
export default withDataErrorBoundary(CaseDetails);