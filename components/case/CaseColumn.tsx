import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { FileText, Calendar, Flag, Check, X, Users, Plus, Minus, Phone } from "lucide-react";
import { NewCaseRecordData, Relationship } from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { isoToDateInputValue, dateInputValueToISO, formatDateForDisplay, formatPhoneNumberAsTyped, normalizePhoneNumber, getDisplayPhoneNumber } from "@/domain/common";
import { CopyButton } from "../common/CopyButton";

interface CaseColumnProps {
  caseData: NewCaseRecordData;
  retroRequested: boolean;
  relationships: Relationship[];
  isEditing: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: unknown) => void;
  onRetroRequestedChange: (value: boolean) => void;
  onRelationshipsChange: {
    add: () => void;
    update: (index: number, field: keyof Relationship, value: string) => void;
    remove: (index: number) => void;
  };
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
  relationships,
  isEditing,
  onCaseDataChange,
  onRetroRequestedChange,
  onRelationshipsChange,
}: CaseColumnProps) {
  const { config } = useCategoryConfig();

  const { caseTypes, caseStatuses } = useMemo(() => ({
    caseTypes: config.caseTypes,
    caseStatuses: config.caseStatuses,
  }), [config]);

  // Use domain formatDateForDisplay - returns "None" for empty values
  const formatDate = (dateString?: string) => {
    const formatted = formatDateForDisplay(dateString);
    return formatted === "None" ? null : formatted;
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

          <Separator />

          {/* Relationships */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">Relationships</h4>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {relationships.length}
              </Badge>
            </div>
            {relationships.length > 0 ? (
              <div className="space-y-2">
                {relationships.map((rel, index) => (
                  <div key={index} className="flex flex-col gap-1 p-2 border rounded-md bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{rel.name}</span>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {rel.type}
                      </Badge>
                    </div>
                    {rel.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <CopyButton
                          value={getDisplayPhoneNumber(rel.phone)}
                          label="Phone"
                          showLabel={false}
                          successMessage="Phone copied"
                          textClassName="text-xs"
                          buttonClassName="text-xs px-1 py-0"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No relationships added</p>
            )}
          </div>

          {/* Retro Months - shown only when retro is requested */}
          {retroRequested && caseData.retroMonths && caseData.retroMonths.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Retro Months</span>
                <p className="text-sm font-medium">{caseData.retroMonths.join(", ")}</p>
              </div>
            </>
          )}
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

        <Separator />

        {/* Relationships */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-muted-foreground">Relationships</h4>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRelationshipsChange.add}
              className="h-7 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {relationships.map((rel, index) => (
              <div key={index} className="flex flex-col gap-2 p-2 border rounded-md bg-muted/10 relative group">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRelationshipsChange.remove(index)}
                  className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={rel.type}
                    onValueChange={(value) => onRelationshipsChange.update(index, 'type', value)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spouse">Spouse</SelectItem>
                      <SelectItem value="Child">Child</SelectItem>
                      <SelectItem value="Parent">Parent</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                      <SelectItem value="Authorized Representative">Auth Rep</SelectItem>
                      <SelectItem value="Case Manager">Case Manager</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={rel.name}
                    onChange={(e) => onRelationshipsChange.update(index, 'name', e.target.value)}
                    placeholder="Name"
                    className="h-7 text-xs"
                  />
                  <Input
                    value={formatPhoneNumberAsTyped(rel.phone)}
                    onChange={(e) => onRelationshipsChange.update(index, 'phone', normalizePhoneNumber(e.target.value))}
                    placeholder="Phone"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            ))}
            {relationships.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No relationships added</p>
            )}
          </div>
        </div>

        {/* Retro Months Input - shown only when retro is requested */}
        {retroRequested && (
          <>
            <Separator />
            <div className="space-y-1">
              <Label htmlFor="retroMonthsInput" className="text-xs">Retro Months</Label>
              <Input
                id="retroMonthsInput"
                value={(caseData.retroMonths ?? []).join(", ")}
                onChange={(e) => {
                  const value = e.target.value;
                  const months = value.split(",").map(m => m.trim()).filter(m => m.length > 0);
                  onCaseDataChange('retroMonths', months);
                }}
                placeholder="e.g., Jan, Feb, Mar"
                className="h-8"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default CaseColumn;
