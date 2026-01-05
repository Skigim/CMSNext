import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PinOff } from 'lucide-react';
import type { StoredCase } from '@/types/case';
import { usePinnedCases } from '@/hooks/usePinnedCases';
import { useMemo } from 'react';

/**
 * Props for the Pinned Cases Widget.
 */
interface PinnedCasesWidgetProps {
  /** All cases from data manager (to resolve IDs to case data) */
  cases: StoredCase[];
  /** Handler to view a case */
  onViewCase?: (caseId: string) => void;
}

/**
 * Pinned Cases Widget Component
 *
 * Displays user's favorite/pinned cases for quick access.
 *
 * Features:
 * - One-click navigation to case detail
 * - Unpin button on each case
 * - Persists across sessions via localStorage
 * - Maximum 20 pinned cases
 *
 * @example
 * ```tsx
 * <PinnedCasesWidget 
 *   cases={cases} 
 *   onViewCase={handleViewCase}
 * />
 * ```
 */
export function PinnedCasesWidget({ 
  cases, 
  onViewCase 
}: PinnedCasesWidgetProps) {
  const { pinnedCaseIds, unpin, pinnedCount } = usePinnedCases();

  // Resolve case IDs to full case objects, filtering out deleted cases
  const pinnedCases = useMemo(() => {
    const caseMap = new Map(cases.map(c => [c.id, c]));
    return pinnedCaseIds
      .map(id => caseMap.get(id))
      .filter((c): c is StoredCase => c !== undefined);
  }, [pinnedCaseIds, cases]);

  const hasPinnedCases = pinnedCases.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pinned Cases</CardTitle>
            <CardDescription>Your favorite cases for quick access</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {hasPinnedCases ? `${pinnedCount} pinned` : 'No pins'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {hasPinnedCases ? (
          <div className="grid grid-cols-3 gap-2">
            {pinnedCases.slice(0, 3).map((caseData) => (
              <div
                key={caseData.id}
                className="p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex-1 min-w-0">
                    {onViewCase ? (
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sm font-medium text-left truncate w-full justify-start"
                        onClick={() => onViewCase(caseData.id)}
                      >
                        {caseData.name}
                      </Button>
                    ) : (
                      <p className="text-sm font-medium truncate">{caseData.name}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => unpin(caseData.id)}
                    aria-label={`Unpin ${caseData.name}`}
                  >
                    <PinOff className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {caseData.mcn || 'No MCN'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <Pin className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm font-medium mb-1">No pinned cases</p>
            <p className="text-xs">Pin cases from the case list for quick access</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PinnedCasesWidget;
