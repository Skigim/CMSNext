import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, History, X } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';
import { PinButton } from '@/components/common/PinButton';
import type { StoredCase } from '@/types/case';
import { useRecentCases } from '@/hooks/useRecentCases';
import { useMemo } from 'react';

/**
 * Props for the Recent Cases Widget.
 */
interface RecentCasesWidgetProps {
  /** All cases from data manager (to resolve IDs to case data) */
  cases: StoredCase[];
  /** Handler to view a case */
  onViewCase?: (caseId: string) => void;
}

/**
 * Recent Cases Widget Component
 *
 * Displays the last 10 cases the user viewed, enabling quick navigation
 * back to frequently accessed cases.
 *
 * Features:
 * - Most recently viewed at top
 * - One-click navigation to case detail
 * - Clear individual entries or all history
 * - Persists across sessions via localStorage
 *
 * @example
 * ```tsx
 * <RecentCasesWidget 
 *   cases={cases} 
 *   onViewCase={handleViewCase}
 * />
 * ```
 */
export function RecentCasesWidget({ 
  cases, 
  onViewCase 
}: RecentCasesWidgetProps) {
  const { recentCaseIds, removeFromRecent, clearRecent } = useRecentCases();

  // Resolve case IDs to full case objects, filtering out deleted cases
  const recentCases = useMemo(() => {
    const caseMap = new Map(cases.map(c => [c.id, c]));
    return recentCaseIds
      .map(id => caseMap.get(id))
      .filter((c): c is StoredCase => c !== undefined);
  }, [recentCaseIds, cases]);

  const hasRecentCases = recentCases.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Recently Viewed
            </CardTitle>
            <CardDescription>Quick access to cases you've viewed</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasRecentCases && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-7"
                onClick={clearRecent}
              >
                Clear all
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {hasRecentCases ? `${recentCases.length} cases` : 'No history'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasRecentCases ? (
          <div className="space-y-2">
            {recentCases.slice(0, 3).map((caseData) => (
                <div
                  key={caseData.id}
                  className="flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors group h-[72px]"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        {onViewCase ? (
                          <Button
                            variant="link"
                            className="h-auto p-0 text-sm font-medium text-left"
                            onClick={() => onViewCase(caseData.id)}
                          >
                            {caseData.name}
                          </Button>
                        ) : (
                          <p className="text-sm font-medium truncate">{caseData.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PinButton caseId={caseData.id} size="sm" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeFromRecent(caseData.id)}
                          aria-label={`Remove ${caseData.name} from recent`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CopyButton
                        value={caseData.mcn}
                        label="MCN"
                        showLabel={false}
                        mono
                        className="text-muted-foreground"
                        buttonClassName="text-xs"
                        textClassName="text-xs"
                        missingLabel="No MCN"
                        missingClassName="text-xs text-muted-foreground"
                        variant="plain"
                      />
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {caseData.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <History className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="text-sm font-medium mb-1">No recent cases</p>
            <p className="text-xs">Cases you view will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentCasesWidget;
