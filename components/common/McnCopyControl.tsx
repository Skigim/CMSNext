import { memo, useCallback } from "react";
import { Copy } from "lucide-react";
import { clickToCopy } from "@/utils/clipboard";
import { cn, interactiveHoverClasses } from "@/components/ui/utils";

export type McnCopyControlVariant = "muted" | "plain";

export interface McnCopyControlProps {
  mcn?: string | null;
  label?: string;
  showLabel?: boolean;
  missingLabel?: string;
  className?: string;
  labelClassName?: string;
  buttonClassName?: string;
  textClassName?: string;
  missingClassName?: string;
  variant?: McnCopyControlVariant;
  interactive?: boolean;
}

const DEFAULT_LABEL = "MCN";
const DEFAULT_MISSING_LABEL = "No MCN";

export const McnCopyControl = memo(function McnCopyControl({
  mcn,
  label = DEFAULT_LABEL,
  showLabel = true,
  missingLabel = DEFAULT_MISSING_LABEL,
  className,
  labelClassName,
  buttonClassName,
  textClassName,
  missingClassName,
  variant = "muted",
  interactive = false,
}: McnCopyControlProps) {
  const handleCopy = useCallback(() => {
    if (!mcn) {
      return;
    }

    clickToCopy(mcn);
  }, [mcn]);

  const resolvedLabel = label?.trim() || DEFAULT_LABEL;
  const labelWithSuffix = resolvedLabel.endsWith(":") ? resolvedLabel : `${resolvedLabel}:`;

  const wrapperClasses = cn("inline-flex items-center gap-2", className);

  const baseButtonClasses = cn(
    "group inline-flex items-center gap-1 rounded-md font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variant === "plain"
      ? "rounded-none border-b border-transparent px-0 py-0 text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground focus-visible:border-muted-foreground"
      : "bg-muted px-2 py-0.5 text-foreground hover:bg-muted/80",
    interactive ? interactiveHoverClasses : undefined,
    buttonClassName,
  );

  const textClasses = cn("truncate text-sm", textClassName);
  const iconClasses = cn(
    "h-3.5 w-3.5",
    variant === "plain"
      ? "text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground"
      : undefined,
  );

  if (!mcn) {
    const accessibleMissing = `${labelWithSuffix} ${missingLabel}`;
    return (
      <span className={wrapperClasses}>
        {showLabel ? (
          <span aria-hidden className={cn("text-sm font-medium text-muted-foreground", labelClassName)}>
            {labelWithSuffix}
          </span>
        ) : null}
        <span className="sr-only">{accessibleMissing}</span>
        <span
          className={cn(
            "font-mono text-sm text-muted-foreground/80",
            variant === "muted" ? "rounded-md bg-muted px-2 py-0.5" : undefined,
            missingClassName,
          )}
        >
          {missingLabel}
        </span>
      </span>
    );
  }

  const accessibleLabel = `${labelWithSuffix} ${mcn}`;

  return (
    <span className={wrapperClasses}>
      {showLabel ? (
        <span aria-hidden className={cn("text-sm font-medium text-muted-foreground", labelClassName)}>
          {labelWithSuffix}
        </span>
      ) : null}
      <span className="sr-only">{accessibleLabel}</span>
      <button type="button" onClick={handleCopy} className={baseButtonClasses} aria-label={`Copy MCN ${mcn}`}>
        <span className={textClasses}>{mcn}</span>
        <Copy aria-hidden className={iconClasses} />
      </button>
    </span>
  );
});

McnCopyControl.displayName = "McnCopyControl";

