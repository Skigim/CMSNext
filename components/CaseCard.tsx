import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { CaseDisplay } from "../types/case";
import { Eye, Edit, Trash2 } from "lucide-react";

interface CaseCardProps {
  case: CaseDisplay;
  onView: (caseId: string) => void;
  onEdit: (caseId: string) => void;
  onDelete: (caseId: string) => void;
}

export function CaseCard({ case: caseData, onView, onEdit, onDelete }: CaseCardProps) {
  // Safely access financial data with fallbacks for malformed cases
  const financials = caseData.caseRecord?.financials || { resources: [], income: [], expenses: [] };
  const totalResources = (financials.resources || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalIncome = (financials.income || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = (financials.expenses || []).reduce((sum, item) => sum + (item.amount || 0), 0);

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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{caseData.name || 'Unnamed Case'}</CardTitle>
          <Badge className={getStatusColor(caseData.status || 'In Progress')}>
            {caseData.status || 'In Progress'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">MCN: {caseData.mcn || 'No MCN'}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Resources</p>
            <p className="font-medium">${totalResources.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Income</p>
            <p className="font-medium">${totalIncome.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expenses</p>
            <p className="font-medium">${totalExpenses.toFixed(2)}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onView(caseData.id)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(caseData.id)}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Case</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this case for {caseData.name}? This action cannot be undone.
                  This will permanently delete the case and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(caseData.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}