import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Icon to display (optional) */
  icon?: ReactNode;
  /** Main title/message */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button or link */
  action?: ReactNode;
  /** Container className override */
  className?: string;
  /** Use compact variant (less padding) */
  compact?: boolean;
}

/**
 * EmptyState - Consistent empty state display across the application
 * 
 * @example
 * <EmptyState
 *   icon={<FileText className="h-8 w-8 text-muted-foreground/50" />}
 *   title="No cases found"
 *   description="Create your first case to get started"
 *   action={<Button>Create case</Button>}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 text-center",
        compact ? "p-4" : "p-6",
        className
      )}
    >
      {icon && (
        <div className={cn("flex justify-center", compact ? "mb-2" : "mb-3")}>
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground/80">{description}</p>
      )}
      {action && <div className={cn(compact ? "mt-2" : "mt-3")}>{action}</div>}
    </div>
  );
}
