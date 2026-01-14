import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Plus, 
  MoreHorizontal,
  Download,
  Upload,
  Database,
  ChevronDown,
} from "lucide-react";
import { useCategoryConfig } from "@/contexts/CategoryConfigContext";
import type { CaseStatus, StoredCase } from "@/types/case";
import type { AlertWithMatch } from "@/utils/alertsData";
import { Badge } from "@/components/ui/badge";
import { getColorSlotBadgeStyle } from "@/types/colorSlots";
import { GlobalSearchDropdown } from "./GlobalSearchDropdown";

export interface QuickActionsBarProps {
  /** Handler for new case creation */
  onNewCase: () => void;
  /** Cases available for search */
  cases: StoredCase[];
  /** Alerts available for search */
  alerts: AlertWithMatch[];
  /** Handler when a case is selected from search */
  onViewCase: (caseId: string) => void;
  /** Handler for bulk status update */
  onBulkStatusUpdate?: (status: CaseStatus) => void;
  /** Handler for data export */
  onExport?: () => void;
  /** Handler for data import */
  onImport?: () => void;
  /** Handler for alerts CSV import */
  onImportAlerts?: () => void;
  /** Show bulk operations menu */
  showBulkOperations?: boolean;
}

/**
 * Quick Actions Bar Component
 * 
 * Command center at the top of the dashboard providing instant access to:
 * - Global search across all cases
 * - New case creation
 * - Bulk operations (status updates)
 * - Import/Export data operations
 * 
 * Designed to be the primary action hub where users initiate most workflows.
 */
export const QuickActionsBar = memo(function QuickActionsBar({
  onNewCase,
  cases,
  alerts,
  onViewCase,
  onBulkStatusUpdate,
  onExport,
  onImport,
  onImportAlerts,
  showBulkOperations = true,
}: QuickActionsBarProps) {
  const { config } = useCategoryConfig();

  const handleStatusSelect = useCallback((status: string) => {
    onBulkStatusUpdate?.(status as CaseStatus);
  }, [onBulkStatusUpdate]);

  return (
    <div 
      className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      data-papercut-context="QuickActionsBar"
    >
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Global Search with Fuzzy Dropdown */}
        <GlobalSearchDropdown
          cases={cases}
          alerts={alerts}
          onSelectCase={onViewCase}
          placeholder="Search cases and alerts..."
          className="flex-1 max-w-md"
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* New Case */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onNewCase} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Case</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create a new case</p>
              <kbd className="ml-2 text-xs opacity-70">Ctrl+N</kbd>
            </TooltipContent>
          </Tooltip>

          {/* Bulk Operations */}
          {showBulkOperations && onBulkStatusUpdate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Database className="h-4 w-4" />
                  <span className="hidden sm:inline">Bulk Actions</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {config.caseStatuses.map((statusConfig) => {
                  const style = getColorSlotBadgeStyle(statusConfig.colorSlot);
                  return (
                    <DropdownMenuItem
                      key={statusConfig.name}
                      onClick={() => handleStatusSelect(statusConfig.name)}
                      className="cursor-pointer"
                    >
                      <Badge
                        className="mr-2 border text-xs"
                        style={style}
                      >
                        {statusConfig.name}
                      </Badge>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Import/Export Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Data Operations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onExport && (
                <DropdownMenuItem onClick={onExport} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </DropdownMenuItem>
              )}
              {onImport && (
                <DropdownMenuItem onClick={onImport} className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Data
                </DropdownMenuItem>
              )}
              {onImportAlerts && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onImportAlerts} className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Alerts (CSV)
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
