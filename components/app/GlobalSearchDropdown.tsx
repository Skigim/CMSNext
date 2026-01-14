import { memo, useCallback, useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, AlertCircle, Loader2, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useFuzzySearch, type SearchResult, type CaseSearchResult, type AlertSearchResult } from "@/hooks/useFuzzySearch";
import type { StoredCase } from "@/types/case";
import type { AlertWithMatch } from "@/utils/alertsData";
import { getColorSlotBadgeStyle } from "@/types/colorSlots";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";

export interface GlobalSearchDropdownProps {
  /** Available cases to search */
  cases: StoredCase[];
  /** Available alerts to search */
  alerts: AlertWithMatch[];
  /** Handler when a case is selected */
  onSelectCase: (caseId: string) => void;
  /** Handler when an alert is selected (navigates to the matched case) */
  onSelectAlert?: (alert: AlertWithMatch) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Global Search Dropdown Component
 * 
 * Provides fuzzy search across cases and alerts with a scrollable dropdown.
 * 
 * Features:
 * - Fuzzy matching using Fuse.js (500ms debounce)
 * - Combined case and alert results
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Scrollable dropdown with max height
 * - Visual indicators for result type
 */
export const GlobalSearchDropdown = memo(function GlobalSearchDropdown({
  cases,
  alerts,
  onSelectCase,
  onSelectAlert,
  placeholder = "Search cases and alerts...",
  className,
}: GlobalSearchDropdownProps) {
  const { config } = useCategoryConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { query, setQuery, clearSearch, results, isSearching, hasResults, isQueryValid } = useFuzzySearch({
    cases,
    alerts,
    options: { debounceMs: 500, maxResults: 10 },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.all]);

  // Listen for focus search events from keyboard shortcuts
  useEffect(() => {
    const handleFocusSearch = () => {
      inputRef.current?.focus();
      setIsOpen(true);
    };

    window.addEventListener("app:focussearch" as keyof WindowEventMap, handleFocusSearch);
    return () => {
      window.removeEventListener("app:focussearch" as keyof WindowEventMap, handleFocusSearch);
    };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  }, [setQuery]);

  const handleClear = useCallback(() => {
    clearSearch();
    setIsOpen(false);
    inputRef.current?.focus();
  }, [clearSearch]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    if (result.type === "case") {
      onSelectCase(result.item.id);
    } else if (result.type === "alert" && onSelectAlert) {
      onSelectAlert(result.item);
    } else if (result.type === "alert" && result.item.matchedCaseId) {
      // If no alert handler, navigate to the matched case
      onSelectCase(result.item.matchedCaseId);
    }
    clearSearch();
    setIsOpen(false);
  }, [onSelectCase, onSelectAlert, clearSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || !hasResults) {
      if (e.key === "ArrowDown" && isQueryValid) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.all.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results.all[selectedIndex]) {
          handleSelectResult(results.all[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, hasResults, isQueryValid, results.all, selectedIndex, handleSelectResult]);

  const getStatusStyle = useCallback((status: string) => {
    const statusConfig = config.caseStatuses.find(s => s.name === status);
    if (statusConfig) {
      return getColorSlotBadgeStyle(statusConfig.colorSlot);
    }
    return {};
  }, [config.caseStatuses]);

  // Keyboard shortcut indicator
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const searchShortcut = isMac ? "⌘K" : "Ctrl+K";

  const showDropdown = isOpen && isQueryValid && (hasResults || isSearching);

  return (
    <div className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => isQueryValid && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-16"
          aria-label="Search cases and alerts"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          role="combobox"
        />
        {query ? (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        ) : (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            {searchShortcut}
          </kbd>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover shadow-lg"
          role="listbox"
        >
          <ScrollArea className="max-h-80">
            {isSearching ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Searching...</span>
              </div>
            ) : hasResults ? (
              <div className="py-1">
                {/* Cases Section */}
                {results.cases.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                      Cases ({results.cases.length})
                    </div>
                    {results.cases.map((result, index) => (
                      <CaseResultItem
                        key={result.item.id}
                        result={result}
                        isSelected={selectedIndex === index}
                        onSelect={() => handleSelectResult(result)}
                        getStatusStyle={getStatusStyle}
                      />
                    ))}
                  </div>
                )}

                {/* Alerts Section */}
                {results.alerts.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                      Alerts ({results.alerts.length})
                    </div>
                    {results.alerts.map((result, index) => (
                      <AlertResultItem
                        key={`${result.item.id}-${index}`}
                        result={result}
                        isSelected={selectedIndex === results.cases.length + index}
                        onSelect={() => handleSelectResult(result)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            )}
          </ScrollArea>

          {/* Footer hint */}
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span><kbd className="px-1 rounded bg-muted">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 rounded bg-muted">Enter</kbd> Select</span>
            <span><kbd className="px-1 rounded bg-muted">Esc</kbd> Close</span>
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Case result item component
 */
const CaseResultItem = memo(function CaseResultItem({
  result,
  isSelected,
  onSelect,
  getStatusStyle,
}: {
  result: CaseSearchResult;
  isSelected: boolean;
  onSelect: () => void;
  getStatusStyle: (status: string) => React.CSSProperties;
}) {
  const caseData = result.item;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-accent transition-colors",
        isSelected && "bg-accent"
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex-shrink-0">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{caseData.name}</span>
          <Badge variant="outline" className="text-xs shrink-0" style={getStatusStyle(caseData.status)}>
            {caseData.status}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          MCN: {caseData.mcn || "N/A"}
          {caseData.caseRecord?.caseType && ` • ${caseData.caseRecord.caseType}`}
        </div>
      </div>
    </button>
  );
});

/**
 * Alert result item component
 */
const AlertResultItem = memo(function AlertResultItem({
  result,
  isSelected,
  onSelect,
}: {
  result: AlertSearchResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const alert = result.item;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-accent transition-colors",
        isSelected && "bg-accent"
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex-shrink-0">
        <AlertCircle className="h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{alert.description || "Alert"}</span>
          {alert.status && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {alert.status}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {alert.personName && `${alert.personName} • `}
          MCN: {alert.mcNumber || "N/A"}
          {alert.alertCode && ` • Code: ${alert.alertCode}`}
        </div>
      </div>
    </button>
  );
});
