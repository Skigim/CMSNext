import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';
import type { StoredCase } from '@/types/case';
import type { AlertsIndex } from '@/utils/alertsData';
import type { WidgetMetadata } from './WidgetRegistry';
import { useTodaysWork } from '@/hooks/useTodaysWork';

/**
 * Props for the Today's Work Widget.
 */
interface TodaysWorkWidgetProps {
  /** All cases from data manager */
  cases: StoredCase[];
  /** Alerts index with case mapping */
  alerts: AlertsIndex;
  /** Widget metadata (injected by WidgetRegistry) */
  metadata?: WidgetMetadata;
  /** Handler to view a case */
  onViewCase?: (caseId: string) => void;
}

/**
 * Today's Work Widget Component
 *
 * Surfaces cases requiring immediate attention based on priority scoring:
 * - Unresolved alerts (highest priority)
 * - Recent modifications (last 24 hours)
 * - Priority flags
 *
 * Features:
 * - Priority-sorted case list
 * - Human-readable reason for each case
 * - One-click navigation to case detail
 * - Visual indicators for priority level
 * - Empty state when no priority cases exist
 *
 * @example
 * ```tsx
 * <TodaysWorkWidget 
 *   cases={cases} 
 *   alerts={alertsIndex}
 *   onViewCase={handleViewCase}
 * />
 * ```
 */
export function TodaysWorkWidget({ 
  cases, 
  alerts, 
  metadata,
  onViewCase 
}: TodaysWorkWidgetProps) {
  // Get priority cases using the hook (limit to top 10)
  const priorityCases = useTodaysWork(cases, alerts, 10);

  // Derive priority level from score for visual indicators
  const getPriorityLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 200) return 'high';
    if (score >= 100) return 'medium';
    return 'low';
  };

  // Badge styling based on priority level
  const getPriorityBadgeClass = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  const hasPriorityCases = priorityCases.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Today's Work</CardTitle>
            <CardDescription>Cases requiring immediate attention</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {hasPriorityCases ? `${priorityCases.length} cases` : 'All clear'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {hasPriorityCases ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {priorityCases.map((priorityCase, index) => {
                const { case: caseData, score, reason } = priorityCase;
                const level = getPriorityLevel(score);
                const Icon = level === 'high' ? AlertCircle : ArrowRight;

                return (
                  <div
                    key={caseData.id}
                    className="flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon 
                        className={`h-5 w-5 ${
                          level === 'high' 
                            ? 'text-red-500 dark:text-red-400' 
                            : 'text-muted-foreground'
                        }`} 
                      />
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
                        <Badge 
                          variant="outline" 
                          className={`text-xs flex-shrink-0 ${getPriorityBadgeClass(level)}`}
                        >
                          {level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-1">
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
                      
                      <p className="text-xs text-foreground/80 flex items-center gap-1.5">
                        <span className="font-medium">{reason}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 opacity-60 text-green-500 dark:text-green-400" />
            <p className="text-sm font-medium mb-1">No urgent cases</p>
            <p className="text-xs">All cases are up to date</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TodaysWorkWidget;
