import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Separator } from "../ui/separator";
import { useMemo } from "react";
import { NewCaseRecordData } from "../../types/case";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";

interface CaseInfoFormProps {
  caseData: NewCaseRecordData;
  retroRequested: boolean;
  onCaseDataChange: (field: keyof NewCaseRecordData, value: any) => void;
  onRetroRequestedChange: (value: boolean) => void;
}

export function CaseInfoForm({
  caseData,
  retroRequested,
  onCaseDataChange,
  onRetroRequestedChange
}: CaseInfoFormProps) {
  const { config } = useCategoryConfig();

  const { caseTypes, caseStatuses, livingArrangements } = useMemo(() => ({
    caseTypes: config.caseTypes,
    caseStatuses: config.caseStatuses,
    livingArrangements: config.livingArrangements,
  }), [config]);

  return (
    <div className="space-y-6">
      {/* Case Identification */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Case Identification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mcn">MCN *</Label>
            <Input
              id="mcn"
              value={caseData.mcn}
              onChange={(e) => onCaseDataChange('mcn', e.target.value)}
              placeholder="Enter MCN"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caseType">Case Type</Label>
            <Select
              value={caseData.caseType}
              onValueChange={(value) => onCaseDataChange('caseType', value)}
            >
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="applicationDate">Application Date *</Label>
            <Input
              id="applicationDate"
              type="date"
              value={caseData.applicationDate}
              onChange={(e) => onCaseDataChange('applicationDate', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={caseData.status}
              onValueChange={(value) => onCaseDataChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {caseStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Case Details */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Case Details</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={caseData.description}
              onChange={(e) => onCaseDataChange('description', e.target.value)}
              placeholder="Enter case description"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="caseLivingArrangement">Living Arrangement</Label>
              <Select
                value={caseData.livingArrangement}
                onValueChange={(value) => onCaseDataChange('livingArrangement', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select living arrangement" />
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
            <div className="space-y-2">
              <Label htmlFor="admissionDate">Admission Date</Label>
              <Input
                id="admissionDate"
                type="date"
                value={caseData.admissionDate}
                onChange={(e) => onCaseDataChange('admissionDate', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Case Flags */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">Case Flags</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="priority"
              checked={caseData.priority}
              onCheckedChange={(checked) => onCaseDataChange('priority', checked)}
            />
            <Label htmlFor="priority">Priority Case</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="withWaiver"
              checked={caseData.withWaiver}
              onCheckedChange={(checked) => onCaseDataChange('withWaiver', checked)}
            />
            <Label htmlFor="withWaiver">With Waiver</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="retroRequested"
              checked={retroRequested}
              onCheckedChange={(checked) => onRetroRequestedChange(checked === true)}
            />
            <Label htmlFor="retroRequested">Retro Requested</Label>
          </div>
        </div>
      </div>
    </div>
  );
}