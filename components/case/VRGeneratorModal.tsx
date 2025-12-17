/**
 * VR Generator Modal
 * 
 * Modal for generating Verification Request letters from financial items.
 * User selects a script template, checks items to include, and copies the result.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Copy, FileText, CheckSquare, Square, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import type { StoredCase, StoredFinancialItem } from "@/types/case";
import type { VRScript } from "@/types/vr";
import { renderMultipleVRs } from "@/utils/vrGenerator";
import { buildCaseLevelContext, renderTemplate } from "@/utils/vrGenerator";
import { cn } from "@/lib/utils";

interface VRGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storedCase: StoredCase;
  financialItems: StoredFinancialItem[];
  vrScripts: VRScript[];
}

export function VRGeneratorModal({
  open,
  onOpenChange,
  storedCase,
  financialItems,
  vrScripts,
}: VRGeneratorModalProps) {
  // Local state
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [renderedText, setRenderedText] = useState("");

  // Build selectable items list
  const selectableItems = useMemo(() => {
    return financialItems.map(item => ({
      item,
      type: item.category,
      selected: selectedItemIds.has(item.id),
    }));
  }, [financialItems, selectedItemIds]);

  const selectedScript = vrScripts.find(s => s.id === selectedScriptId);
  const totalItems = selectableItems.length;
  const selectedCount = selectableItems.filter(i => i.selected).length;
  const allSelected = selectedCount === totalItems && totalItems > 0;
  const noneSelected = selectedCount === 0;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      // Select no items by default
      setSelectedItemIds(new Set());
      // Select first script if available (but don't auto-populate)
      setSelectedScriptId(vrScripts[0]?.id ?? null);
      setRenderedText("");
    }
  }, [open, vrScripts]);

  const handleToggleItem = useCallback((itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedItemIds(new Set(financialItems.map(i => i.id)));
  }, [financialItems]);

  const handleDeselectAll = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const handleAddScript = useCallback(() => {
    if (!selectedScript) {
      toast.error("Select a script first");
      return;
    }

    let textToAdd = selectedScript.template;
    
    const selectedItems = selectableItems
      .filter(i => i.selected)
      .map(({ item, type }) => ({ item, type }));

    if (selectedItems.length > 0 && storedCase) {
      // If items are selected, render with item values
      textToAdd = renderMultipleVRs(
        selectedScript,
        selectedItems,
        storedCase as unknown as Parameters<typeof renderMultipleVRs>[2]
      );
    } else if (storedCase) {
      // No items selected - render with case-level placeholders filled
      const caseContext = buildCaseLevelContext(storedCase);
      textToAdd = renderTemplate(selectedScript.template, caseContext);
    }

    // Append to existing text with separator
    if (renderedText) {
      setRenderedText(renderedText + "\n-----\n" + textToAdd);
    } else {
      setRenderedText(textToAdd);
    }

    toast.success("Script added");
  }, [selectedScript, selectableItems, renderedText, storedCase]);

  const handleCopy = async () => {
    if (!renderedText) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(renderedText);
      toast.success("VR copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getItemTypeLabel = (type: "resources" | "income" | "expenses") => {
    const labels = {
      resources: "Resource",
      income: "Income",
      expenses: "Expense",
    };
    return labels[type];
  };

  const getItemTypeBadgeVariant = (type: "resources" | "income" | "expenses") => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      resources: "default",
      income: "secondary",
      expenses: "outline",
    };
    return variants[type];
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Verification Requests
          </DialogTitle>
          <DialogDescription>
            Select a script and choose which items to include in the VR.
          </DialogDescription>
        </DialogHeader>

        {vrScripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No VR Scripts Configured</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Create VR scripts in Settings → Category Manager → VR Scripts tab before generating VRs.
            </p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
            {/* Left panel: Script & Item selection */}
            <div className="flex flex-col gap-4 md:w-1/3">
              {/* Script selector */}
              <div className="space-y-2">
                <Label htmlFor="vr-script">VR Script</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedScriptId ?? ""}
                    onValueChange={(value) => setSelectedScriptId(value || null)}
                  >
                    <SelectTrigger id="vr-script" className="flex-1">
                      <SelectValue placeholder="Select a script..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vrScripts.map((script) => (
                        <SelectItem key={script.id} value={script.id}>
                          {script.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddScript}
                    disabled={!selectedScriptId}
                    className="px-2"
                    title="Add selected script to VR"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Item selection */}
              <div className="space-y-2 flex-1 min-h-0">
                <div className="flex items-center justify-between">
                  <Label>Financial Items ({selectedCount}/{totalItems})</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={allSelected}
                      className="h-7 px-2 text-xs"
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAll}
                      disabled={noneSelected}
                      className="h-7 px-2 text-xs"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      None
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-[250px] border rounded-md p-2">
                  <div className="space-y-2">
                    {selectableItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No financial items in this case.
                      </p>
                    ) : (
                      selectableItems.map(({ item, type, selected }) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                            selected && "bg-muted"
                          )}
                          onClick={() => handleToggleItem(item.id)}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => handleToggleItem(item.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">
                                {item.description || "Unnamed item"}
                              </span>
                              <Badge variant={getItemTypeBadgeVariant(type)} className="text-[10px] px-1">
                                {getItemTypeLabel(type)}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.location && <span>{item.location} • </span>}
                              {formatAmount(item.amount)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <Separator orientation="vertical" className="hidden md:block" />

            {/* Right panel: Preview */}
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <Label htmlFor="vr-preview">Preview</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!renderedText}
                  className="h-7"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea
                id="vr-preview"
                value={renderedText}
                onChange={(e) => setRenderedText(e.target.value)}
                placeholder={
                  !selectedScriptId
                    ? "Select a script and click + to add it here..."
                    : "Click + to add the selected script, or select items to auto-fill placeholders..."
                }
                className="flex-1 min-h-[300px] font-mono text-sm resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleCopy} disabled={!renderedText}>
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VRGeneratorModal;
