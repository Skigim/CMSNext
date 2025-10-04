import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { CaseDisplay } from "../../types/case";
import { Eye, Edit, Trash2 } from "lucide-react";
import { CaseStatusBadge } from "./CaseStatusBadge";
import type { AlertWithMatch } from "../../utils/alertsData";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import { McnCopyControl } from "@/components/common/McnCopyControl";

interface CaseCardProps {
  case: CaseDisplay;
  onView: (caseId: string) => void;
  onEdit: (caseId: string) => void;
  onDelete: (caseId: string) => void;
  alerts?: AlertWithMatch[];
}

export function CaseCard({ case: caseData, onView, onEdit, onDelete, alerts = [] }: CaseCardProps) {
  const formatDate = (value?: string) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const caseType = caseData.caseRecord?.caseType || "Not specified";
  const applicationDate = caseData.caseRecord?.applicationDate || caseData.createdAt;
  const lastUpdated = caseData.updatedAt || caseData.caseRecord?.updatedDate || caseData.createdAt;
  const primaryContact = caseData.person?.phone || caseData.person?.email || "Not provided";

  const priorityLabel = caseData.priority ? "High priority" : "Standard priority";
  const priorityClasses = caseData.priority
    ? "bg-red-500/10 text-red-500 border-red-500/20"
    : "bg-muted text-muted-foreground border-transparent";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{caseData.name || 'Unnamed Case'}</CardTitle>
          <CaseStatusBadge status={caseData.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <McnCopyControl
            mcn={caseData.mcn}
            className="text-muted-foreground"
            labelClassName="text-sm"
            textClassName="text-sm"
            variant="muted"
          />
          <AlertBadge alerts={alerts} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Case type</p>
            <p className="font-medium">{caseType}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Application date</p>
            <p className="font-medium">{formatDate(applicationDate)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last updated</p>
            <p className="font-medium">{formatDate(lastUpdated)}</p>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-2 text-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-muted-foreground">Primary contact</p>
            <p className="font-medium text-foreground">{primaryContact}</p>
          </div>
          <Badge className={priorityClasses}>{priorityLabel}</Badge>
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