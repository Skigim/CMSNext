import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { FileText, Calendar, Flag, Check, X } from "lucide-react";
import { NewCaseRecordData } from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { isoToDateInputValue, dateInputValueToISO } from "@/domain/common";

interface CaseColumnProps {
  caseData: NewCaseRecordData;
  retroRequested: boolean;
  isEditing: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
  onRetroRequestedChange: (value: boolean) => void;
}

// Read-only info display component
function InfoItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />}
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// Checklist item for read-only flags
function ChecklistItem({
  label,
  checked,
}: {
  label: string;
  checked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/50" />
      )}
      <span className={checked ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

export function CaseColumn({
  caseData,
  retroRequested,
  isEditing,
  onCaseDataChange,
  onRetroRequestedChange,
}: CaseColumnProps) {
  const { config } = useCategoryConfig();

  const { caseTypes, caseStatuses, livingArrangements } = useMemo(() => ({
    caseTypes: config.caseTypes,
    caseStatuses: config.caseStatuses,
    livingArrangements: config.livingArrangements,
  }), [config]);

  // Format dates for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  if (!isEditing) {
    // Read-only view
    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Case Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Case Identification */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Case Identification</h4>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="MCN" value={caseData.mcn} />
              <InfoItem label="Case Type" value={caseData.caseType} />
              <InfoItem label="Application Date" value={formatDate(caseData.applicationDate)} icon={Calendar} />
              <div className="flex items-start gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div className="mt-0.5">
                    <Badge variant="outline">{caseData.status}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Case Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Case Details</h4>
            <div className="space-y-3">
              {caseData.description && (
                <div>
                  <span className="text-xs text-muted-foreground">Description</span>
                  <p className="text-sm mt-0.5">{caseData.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="Living Arrangement" value={caseData.livingArrangement} />
                <InfoItem label="Admission Date" value={formatDate(caseData.admissionDate)} icon={Calendar} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Case Flags */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Case Flags</h4>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <ChecklistItem label="Priority Case" checked={caseData.priority} />
              <ChecklistItem label="With Waiver" checked={caseData.withWaiver} />
              <ChecklistItem label="Retro Requested" checked={retroRequested} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Case Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Case Identification */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Case Identification</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mcn" className="text-xs">MCN *</Label>
              <Input
                id="mcn"
                value={caseData.mcn}
                onChange={(e) => onCaseDataChange('mcn', e.target.value)}
                placeholder="Enter MCN"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caseType" className="text-xs">Case Type</Label>
              <Select
                value={caseData.caseType}
                onValueChange={(value) => onCaseDataChange('caseType', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="applicationDate" className="text-xs">Application Date *</Label>
              <Input
                id="applicationDate"
                type="date"
                value={isoToDateInputValue(caseData.applicationDate)}
                onChange={(e) => onCaseDataChange('applicationDate', dateInputValueToISO(e.target.value) || '')}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <Select
                value={caseData.status}
                onValueChange={(value) => onCaseDataChange('status', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {caseStatuses.map((status) => (
                    <SelectItem key={status.name} value={status.name}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Case Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Case Details</h4>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                value={caseData.description}
                onChange={(e) => onCaseDataChange('description', e.target.value)}
                placeholder="Case description"
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="caseLivingArrangement" className="text-xs">Living Arrangement</Label>
                <Select
                  value={caseData.livingArrangement}
                  onValueChange={(value) => onCaseDataChange('livingArrangement', value)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {livingArrangements.map((arrangement) => (
                      <SelectItem key={arrangement} value={arrangement}>
                        {arrangement}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="admissionDate" className="text-xs">Admission Date</Label>
                <Input
                  id="admissionDate"
                  type="date"
                  value={isoToDateInputValue(caseData.admissionDate)}
                  onChange={(e) => onCaseDataChange('admissionDate', dateInputValueToISO(e.target.value) || '')}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Case Flags */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Case Flags</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="priority"
                checked={caseData.priority ?? false}
                onCheckedChange={(checked) => onCaseDataChange('priority', checked)}
              />
              <Label htmlFor="priority" className="text-sm">Priority Case</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="withWaiver"
                checked={caseData.withWaiver ?? false}
                onCheckedChange={(checked) => onCaseDataChange('withWaiver', checked)}
              />
              <Label htmlFor="withWaiver" className="text-sm">With Waiver</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="retroRequested"
                checked={retroRequested}
                onCheckedChange={(checked) => onRetroRequestedChange(checked === true)}
              />
              <Label htmlFor="retroRequested" className="text-sm">Retro Requested</Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CaseColumn;
