import { Button } from '@/components/ui/button';
import { Pin, PinOff } from 'lucide-react';
import { usePinnedCases } from '@/hooks/usePinnedCases';
import { cn } from '@/lib/utils';

interface PinButtonProps {
  /** Case ID to pin/unpin */
  caseId: string;
  /** Optional size variant */
  size?: 'sm' | 'default';
  /** Optional additional className */
  className?: string;
}

/**
 * Reusable pin/unpin button for cases.
 * 
 * Uses usePinnedCases hook internally for state management.
 * Renders a toggle button that shows filled pin when pinned.
 * 
 * @example
 * ```tsx
 * <PinButton caseId={case.id} size="sm" />
 * ```
 */
export function PinButton({ caseId, size = 'sm', className }: PinButtonProps) {
  const { isPinned, togglePin } = usePinnedCases();
  const pinned = isPinned(caseId);

  return (
    <Button
      variant="ghost"
      size={size === 'sm' ? 'sm' : 'default'}
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering parent click handlers
        togglePin(caseId);
      }}
      className={cn(
        size === 'sm' ? 'h-6 w-6 p-0' : 'h-8 w-8 p-0',
        pinned 
          ? 'text-blue-600 hover:text-blue-700' 
          : 'text-muted-foreground hover:text-foreground',
        className
      )}
      aria-label={pinned ? 'Unpin case' : 'Pin case'}
    >
      {pinned ? (
        <Pin className={size === 'sm' ? 'h-3.5 w-3.5 fill-current' : 'h-4 w-4 fill-current'} />
      ) : (
        <PinOff className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      )}
    </Button>
  );
}
