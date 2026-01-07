/**
 * Case Summary Modal
 * ==================
 * Modal for configuring and previewing case summary before copying to clipboard.
 * Allows toggling sections and editing the preview before final copy.
 * 
 * Now integrated with the Template system for customizable section rendering.
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
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import { useTemplates } from "@/contexts/TemplateContext";
import type { SummarySectionKey } from "@/types/categoryConfig";

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

export function CaseSummaryModal({
  open,
  onOpenChange,
  caseData,
  financials,
  notes,
}: CaseSummaryModalProps) {
  const { config } = useCategoryConfig();
  const { templates } = useTemplates();
  const { sectionOrder, defaultSections } = config.summaryTemplate;

  // Get summary templates from TemplateContext
  const summaryTemplates = useMemo(() => {
    const templatesBySection: Partial<Record<SummarySectionKey, any>> = {};
    
    templates
      .filter(t => t.category === 'summary' && t.sectionKey)
      .forEach(t => {
        if (t.sectionKey) {
          templatesBySection[t.sectionKey] = t;
        }
      });
    
    return templatesBySection;
  }, [templates]);

  // Build section configs from template order
  const SECTION_CONFIGS: SectionConfig[] = useMemo(() => {
    const labels: Record<string, { label: string; description: string }> = {
      notes: { label: "Notes", description: "Case notes" },
      caseInfo: { label: "Case Info", description: "Application date, retro, waiver" },
      personInfo: { label: "Person Info", description: "Name, contact, verifications" },
      relationships: { label: "Relationships", description: "Related contacts" },
      resources: { label: "Resources", description: "Bank accounts, assets" },
      income: { label: "Income", description: "Income sources" },
      expenses: { label: "Expenses", description: "Monthly expenses" },
      avsTracking: { label: "AVS Tracking", description: "AVS submission and tracking dates" },
    };
    return sectionOrder.map(key => ({
      key: key as keyof SummarySections,
      label: labels[key].label,
      description: labels[key].description,
    }));
  }, [sectionOrder]);

  // Section toggles - initialize from template defaults
  const [sections, setSections] = useState<SummarySections>(defaultSections);

  // Editable preview text
  const [previewText, setPreviewText] = useState("");

  // Generate summary whenever sections change - use Template objects
  const generatedSummary = useMemo(() => {
    return generateCaseSummary(caseData, { 
      financials, 
      notes, 
      sections,
      templateObjects: summaryTemplates
    });
  }, [caseData, financials, notes, sections, summaryTemplates]);

  // Update preview when generated summary changes
  useEffect(() => {
    setPreviewText(generatedSummary);
  }, [generatedSummary]);

  // Reset when modal opens - use template defaults
  useEffect(() => {
    if (open) {
      setSections(defaultSections);
    }
  }, [open, defaultSections]);

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
