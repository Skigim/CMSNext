import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, memo } from 'react';
import { CaseDisplay } from '@/types/case';
import { CaseCard } from '@/components/case/CaseCard';
import type { AlertWithMatch } from '@/utils/alertsData';

interface VirtualCaseListProps {
  cases: CaseDisplay[];
  onViewCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onDeleteCase: (caseId: string) => void;
  alertsByCaseId?: Map<string, AlertWithMatch[]>;
}

/**
 * VirtualCaseList component for efficiently rendering large lists of cases
 * Uses virtual scrolling to maintain performance with 1000+ items
 * 
 * @param cases - Array of case displays to render
 * @param onViewCase - Callback when a case is viewed
 * @param onEditCase - Callback when a case is edited
 * @param onDeleteCase - Callback when a case is deleted
 */
export const VirtualCaseList = memo(function VirtualCaseList({
  cases,
  onViewCase,
  onEditCase,
  onDeleteCase,
  alertsByCaseId,
}: VirtualCaseListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: cases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Estimated height for CaseCard (including margins)
    overscan: 5, // Render 5 items outside viewport for smooth scrolling
    paddingStart: 0,
    paddingEnd: 0,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div 
      ref={parentRef} 
      className="h-[600px] overflow-auto border rounded-lg bg-background"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          {items.map((virtualItem) => {
            const caseData = cases[virtualItem.index];
            
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  padding: '12px',
                }}
              >
                <CaseCard
                  case={caseData}
                  onView={onViewCase}
                  onEdit={onEditCase}
                  onDelete={onDeleteCase}
                  alerts={alertsByCaseId?.get(caseData.id) ?? []}
                />
              </div>
            );
          })}
        </div>
      </div>
      
      {cases.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No cases to display</p>
        </div>
      )}
    </div>
  );
});