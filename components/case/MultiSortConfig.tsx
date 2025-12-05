import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { SortConfig, CaseListSortKey, CaseListSortDirection } from "@/hooks/useCaseListPreferences";

interface MultiSortConfigProps {
  sortConfigs: SortConfig[];
  onSortConfigsChange: (configs: SortConfig[]) => void;
}

const SORT_KEY_LABELS: Record<CaseListSortKey, string> = {
  name: "Name",
  mcn: "MCN",
  status: "Status",
  caseType: "Case Type",
  application: "Application Date",
  updated: "Last Updated",
  alerts: "Alerts",
};

export function MultiSortConfig({ sortConfigs, onSortConfigsChange }: MultiSortConfigProps) {
  const handleAddSort = useCallback(() => {
    // Add a new sort config with a key that's not already used
    const usedKeys = new Set(sortConfigs.map(c => c.key));
    const availableKey = (Object.keys(SORT_KEY_LABELS) as CaseListSortKey[]).find(
      key => !usedKeys.has(key)
    );
    
    if (availableKey) {
      onSortConfigsChange([...sortConfigs, { key: availableKey, direction: "asc" }]);
    }
  }, [sortConfigs, onSortConfigsChange]);

  const handleRemoveSort = useCallback((index: number) => {
    if (sortConfigs.length > 1) {
      const newConfigs = sortConfigs.filter((_, i) => i !== index);
      onSortConfigsChange(newConfigs);
    }
  }, [sortConfigs, onSortConfigsChange]);

  const handleSortKeyChange = useCallback((index: number, key: CaseListSortKey) => {
    const newConfigs = [...sortConfigs];
    newConfigs[index] = { ...newConfigs[index], key };
    onSortConfigsChange(newConfigs);
  }, [sortConfigs, onSortConfigsChange]);

  const handleSortDirectionChange = useCallback((index: number, direction: CaseListSortDirection) => {
    const newConfigs = [...sortConfigs];
    newConfigs[index] = { ...newConfigs[index], direction };
    onSortConfigsChange(newConfigs);
  }, [sortConfigs, onSortConfigsChange]);

  const hasMultipleSorts = sortConfigs.length > 1;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowUpDown className="h-4 w-4" />
            Sort
            {hasMultipleSorts && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {sortConfigs.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Sort cases</h4>
              {sortConfigs.length < Object.keys(SORT_KEY_LABELS).length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddSort}
                  className="h-auto px-2 py-1 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add sort
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {sortConfigs.map((config, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={config.key}
                      onValueChange={(value) => handleSortKeyChange(index, value as CaseListSortKey)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SORT_KEY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {index > 0 && "then by "}
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSortDirectionChange(
                      index,
                      config.direction === "asc" ? "desc" : "asc"
                    )}
                    className="h-9 px-3"
                    aria-label={`Toggle sort direction for ${SORT_KEY_LABELS[config.key]}`}
                  >
                    {config.direction === "asc" ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                  {sortConfigs.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSort(index)}
                      className="h-9 px-2"
                      aria-label={`Remove ${SORT_KEY_LABELS[config.key]} sort`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {hasMultipleSorts && (
              <p className="text-xs text-muted-foreground">
                Cases will be sorted in the order shown above.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {hasMultipleSorts && (
        <div className="text-xs text-muted-foreground">
          {sortConfigs.map((config, index) => (
            <span key={index}>
              {index > 0 && " → "}
              {SORT_KEY_LABELS[config.key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
