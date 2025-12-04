/**
 * Case Summary Modal
 * ==================
 * Modal for configuring and previewing case summary before copying to clipboard.
 * Allows toggling sections and editing the preview before final copy.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Copy, X } from "lucide-react";
import { StoredCase, FinancialItem, Note } from "../../types/case";
import { generateCaseSummary, SummarySections } from "../../utils/caseSummaryGenerator";
import { clickToCopy } from "../../utils/clipboard";

interface CaseSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: StoredCase;
  financials: {
    resources: FinancialItem[];
    income: FinancialItem[];
    expenses: FinancialItem[];
  };
  notes: Note[];
}

interface SectionConfig {
  key: keyof SummarySections;
  label: string;
  description: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  { key: "caseInfo", label: "Case Info", description: "Application date, retro, waiver" },
  { key: "personInfo", label: "Person Info", description: "Name, contact, verifications" },
  { key: "relationships", label: "Relationships", description: "Related contacts" },
  { key: "resources", label: "Resources", description: "Bank accounts, assets" },
  { key: "income", label: "Income", description: "Income sources" },
  { key: "expenses", label: "Expenses", description: "Monthly expenses" },
  { key: "notes", label: "Notes", description: "Case notes" },
];

export function CaseSummaryModal({
  open,
  onOpenChange,
  caseData,
  financials,
  notes,
}: CaseSummaryModalProps) {
  // Section toggles - all enabled by default
  const [sections, setSections] = useState<SummarySections>({
    caseInfo: true,
    personInfo: true,
    relationships: true,
    resources: true,
    income: true,
    expenses: true,
    notes: true,
  });

  // Editable preview text
  const [previewText, setPreviewText] = useState("");

  // Generate summary whenever sections change
  const generatedSummary = useMemo(() => {
    return generateCaseSummary(caseData, { financials, notes, sections });
  }, [caseData, financials, notes, sections]);

  // Update preview when generated summary changes
  useEffect(() => {
    setPreviewText(generatedSummary);
  }, [generatedSummary]);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSections({
        caseInfo: true,
        personInfo: true,
        relationships: true,
        resources: true,
        income: true,
        expenses: true,
        notes: true,
      });
    }
  }, [open]);

  const handleSectionToggle = useCallback((key: keyof SummarySections) => {
    setSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleCopy = useCallback(() => {
    clickToCopy(previewText, {
      successMessage: "Case summary copied to clipboard",
      errorMessage: "Failed to copy summary to clipboard",
    });
    onOpenChange(false);
  }, [previewText, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Count enabled sections
  const enabledCount = Object.values(sections).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Case Summary</DialogTitle>
          <DialogDescription>
            Select sections to include and edit the preview before copying.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Section Toggles */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Include Sections ({enabledCount}/{SECTION_CONFIGS.length})
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SECTION_CONFIGS.map(({ key, label, description }) => (
                <label
                  key={key}
                  className="flex items-start gap-2 p-2 rounded-md border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={sections[key]}
                    onCheckedChange={() => handleSectionToggle(key)}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col min-h-0">
            <Label className="text-sm font-medium mb-2">Preview (editable)</Label>
            <Textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              className="flex-1 min-h-[200px] max-h-[300px] font-mono text-xs resize-none"
              placeholder="Select at least one section to generate a preview..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleCopy} disabled={!previewText.trim()}>
            <Copy className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
