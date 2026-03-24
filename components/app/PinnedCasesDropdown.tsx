import { memo, useEffect, useMemo } from "react";
import { Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePinnedCases } from "@/hooks/usePinnedCases";
import type { StoredCase } from "@/types/case";
import { caseNeedsIntake } from "@/domain/cases";
import { NeedsIntakeBadge } from "@/components/case/NeedsIntakeBadge";

export interface PinnedCasesDropdownProps {
  /** All cases from data manager (to resolve IDs to case data) */
  cases: StoredCase[];
  /** Whether case data has finished loading */
  hasLoadedData?: boolean;
  /** Handler to view a case */
  onViewCase: (caseId: string) => void;
}

/**
 * Pinned Cases Dropdown Component
 *
 * Displays user's pinned cases in a header dropdown for quick access.
 *
 * Features:
 * - One-click navigation to case detail
 * - Unpin button on each case
 * - Persists across sessions via localStorage
 * - Scrollable list for many pins (max 20)
 * - Empty state message when no pins
 * - Syncs instantly across all mounted instances
 *
 * @example
 * ```tsx
 * <PinnedCasesDropdown
 *   cases={cases}
 *   onViewCase={(caseId) => navigateToCase(caseId)}
 * />
 * ```
 */
export const PinnedCasesDropdown = memo(function PinnedCasesDropdown({
  cases,
  hasLoadedData = true,
  onViewCase,
}: PinnedCasesDropdownProps) {
  const { getPinReason, pinnedCaseIds, unpin, pruneStale } = usePinnedCases();

  // Resolve case IDs to full case objects, filtering out archived/deleted cases
  const pinnedCases = useMemo(() => {
    const caseMap = new Map(cases.map((c) => [c.id, c]));
    return pinnedCaseIds
      .map((id) => caseMap.get(id))
      .filter((c): c is StoredCase => c !== undefined);
  }, [pinnedCaseIds, cases]);

  // Auto-prune stale pinned IDs (e.g. archived or deleted cases)
  useEffect(() => {
    if (!hasLoadedData) {
      return;
    }

    if (pinnedCaseIds.length > 0 && pinnedCases.length < pinnedCaseIds.length) {
      const validIds = cases.map((c) => c.id);
      pruneStale(validIds);
    }
  }, [cases, hasLoadedData, pinnedCaseIds.length, pinnedCases.length, pruneStale]);

  // Use resolved count so the badge always matches visible items
  const resolvedCount = pinnedCases.length;
  const hasPinnedCases = resolvedCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={hasPinnedCases ? `Pinned cases (${resolvedCount})` : "Pinned cases"}
        >
          <Pin className="h-4 w-4" />
          {hasPinnedCases && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-4 min-w-4 p-0 text-[10px] flex items-center justify-center"
            >
              {resolvedCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Pinned Cases</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasPinnedCases ? (
          <div
            className="overflow-hidden flex flex-col max-h-64"
            data-testid="pinned-cases-scroll-wrapper"
          >
            <ScrollArea
              className="h-full max-h-64"
              data-testid="pinned-cases-scroll-area"
            >
              {pinnedCases.map((caseData) => {
                const pinReason = getPinReason(caseData.id);

                return (
                  <DropdownMenuItem
                    key={caseData.id}
                    className="flex items-center justify-between gap-2 cursor-pointer"
                    onSelect={() => onViewCase(caseData.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium truncate">{caseData.name}</p>
                        {caseNeedsIntake(caseData) ? (
                          <NeedsIntakeBadge className="text-[10px] px-1.5 py-0" />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {caseData.mcn || "No MCN"}
                      </p>
                      {pinReason ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {pinReason}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0 hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        unpin(caseData.id);
                      }}
                      aria-label={`Unpin ${caseData.name}`}
                    >
                      <PinOff className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                );
              })}
            </ScrollArea>
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            <PinOff className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No pinned cases</p>
            <p className="text-xs mt-1">Pin cases from the case list</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
