import { memo, useCallback } from "react";
import { Copy } from "lucide-react";
import { clickToCopy } from "@/utils/clipboard";
import { cn, interactiveHoverClasses } from "@/components/ui/utils";

export type CopyButtonVariant = "muted" | "plain";

export interface CopyButtonProps {
  /** The text value to copy to clipboard */
  value?: string | null;
  /** Optional display text (if different from value) */
  displayText?: string;
  /** Label shown before the value */
  label?: string;
  /** Whether to show the label */
  showLabel?: boolean;
  /** Text shown when value is missing */
  missingLabel?: string;
  /** Custom success message for toast */
  successMessage?: string;
  /** Custom aria-label for the button */
  ariaLabel?: string;
  /** Visual variant */
  variant?: CopyButtonVariant;
  /** Whether to show interactive hover effects */
  interactive?: boolean;
  /** Use monospace font for the value */
  mono?: boolean;
  /** Container className */
  className?: string;
  /** Label className */
  labelClassName?: string;
  /** Button className */
  buttonClassName?: string;
  /** Value text className */
  textClassName?: string;
  /** Missing state className */
  missingClassName?: string;
}

const DEFAULT_MISSING_LABEL = "Not provided";

/**
 * A reusable component for displaying text with a copy-to-clipboard button.
 * Supports multiple visual variants and optional label display.
 * 
 * @example
 * ```tsx
 * // MCN with monospace font
 * <CopyButton value={mcn} label="MCN" mono />
 * 
 * // Phone number with formatted display
 * <CopyButton value={phone} label="Phone" />
 * 
 * // Email without label
 * <CopyButton value={email} showLabel={false} />
 * 
 * // Date with custom display format
 * <CopyButton value={date} displayText={formatDate(date)} label="App Date" />
 * ```
 */
export const CopyButton = memo(function CopyButton({
  value,
  displayText,
  label,
  showLabel = true,
  missingLabel = DEFAULT_MISSING_LABEL,
  successMessage,
  ariaLabel,
  variant = "muted",
  interactive = true,
  mono = false,
  className,
  labelClassName,
  buttonClassName,
  textClassName,
  missingClassName,
}: CopyButtonProps) {
  const handleCopy = useCallback(() => {
    if (!value) {
      return;
    }

    clickToCopy(value, {
      successMessage: successMessage || `${label || "Text"} copied to clipboard`,
    });
  }, [value, successMessage, label]);

  const resolvedLabel = label?.trim();
  const labelWithSuffix =
    resolvedLabel && showLabel
      ? resolvedLabel.endsWith(":")
        ? resolvedLabel
        : `${resolvedLabel}:`
      : null;

  const wrapperClasses = cn("inline-flex items-center gap-2", className);

  const baseButtonClasses = cn(
    "group inline-flex items-center gap-1 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variant === "plain"
      ? "rounded-none border-b border-transparent px-0 py-0 text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground focus-visible:border-muted-foreground"
      : "bg-muted px-2 py-0.5 text-foreground hover:bg-muted/80",
    interactive ? interactiveHoverClasses : undefined,
    buttonClassName,
  );

  const textClasses = cn(
    "truncate text-sm",
    mono ? "font-mono" : undefined,
    textClassName,
  );

  const iconClasses = cn(
    "h-3.5 w-3.5 shrink-0",
    variant === "plain"
      ? "text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground"
      : undefined,
  );

  // Display text defaults to value
  const display = displayText ?? value;

  if (!value) {
    const accessibleMissing = labelWithSuffix
      ? `${labelWithSuffix} ${missingLabel}`
      : missingLabel;
    return (
      <span className={wrapperClasses}>
        {labelWithSuffix && (
          <span
            aria-hidden
            className={cn(
              "text-sm font-medium text-muted-foreground",
              labelClassName,
            )}
          >
            {labelWithSuffix}
          </span>
        )}
        <span className="sr-only">{accessibleMissing}</span>
        <span
          className={cn(
            "text-sm text-muted-foreground/80",
            variant === "muted" ? "rounded-md bg-muted px-2 py-0.5" : undefined,
            mono ? "font-mono" : undefined,
            missingClassName,
          )}
        >
          {missingLabel}
        </span>
      </span>
    );
  }

  const accessibleLabel = labelWithSuffix
    ? `${labelWithSuffix} ${display}`
    : String(display);
  const copyAriaLabel = ariaLabel || `Copy ${label || "text"} ${value}`;

  return (
    <span className={wrapperClasses}>
      {labelWithSuffix && (
        <span
          aria-hidden
          className={cn(
            "text-sm font-medium text-muted-foreground",
            labelClassName,
          )}
        >
          {labelWithSuffix}
        </span>
      )}
      <span className="sr-only">{accessibleLabel}</span>
      <button
        type="button"
        onClick={handleCopy}
        className={baseButtonClasses}
        aria-label={copyAriaLabel}
      >
        <span className={textClasses}>{display}</span>
        <Copy aria-hidden className={iconClasses} />
      </button>
    </span>
  );
});

CopyButton.displayName = "CopyButton";

// Legacy alias for backward compatibility
/** @deprecated Use CopyButton instead */
export const McnCopyControl = CopyButton;
/** @deprecated Use CopyButtonProps instead */
export type McnCopyControlProps = CopyButtonProps;
/** @deprecated Use CopyButtonVariant instead */
export type McnCopyControlVariant = CopyButtonVariant;

// Legacy alias for CopyableText compatibility
/** @deprecated Use CopyButton instead */
export const CopyableText = CopyButton;
/** @deprecated Use CopyButtonProps instead */
export type CopyableTextProps = CopyButtonProps;
