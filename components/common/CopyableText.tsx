import { memo, useCallback } from "react";
import { Copy } from "lucide-react";
import { clickToCopy } from "@/utils/clipboard";
import { cn, interactiveHoverClasses } from "@/components/ui/utils";

export interface CopyableTextProps {
  text?: string | null;
  label?: string;
  showLabel?: boolean;
  missingLabel?: string;
  className?: string;
  labelClassName?: string;
  buttonClassName?: string;
  textClassName?: string;
  missingClassName?: string;
  successMessage?: string;
  ariaLabel?: string;
}

const DEFAULT_MISSING_LABEL = "Not provided";

/**
 * A reusable component for displaying text with a copy-to-clipboard button.
 * Similar to McnCopyControl but designed for general text like contact information.
 * 
 * @example
 * ```tsx
 * <CopyableText text={phone} label="Phone" />
 * <CopyableText text={email} label="Email" />
 * ```
 */
export const CopyableText = memo(function CopyableText({
  text,
  label,
  showLabel = true,
  missingLabel = DEFAULT_MISSING_LABEL,
  className,
  labelClassName,
  buttonClassName,
  textClassName,
  missingClassName,
  successMessage,
  ariaLabel,
}: CopyableTextProps) {
  const handleCopy = useCallback(() => {
    if (!text) {
      return;
    }

    clickToCopy(text, {
      successMessage: successMessage || `${label || 'Text'} copied to clipboard`,
    });
  }, [text, successMessage, label]);

  const resolvedLabel = label?.trim();
  const labelWithSuffix = resolvedLabel && showLabel
    ? (resolvedLabel.endsWith(":") ? resolvedLabel : `${resolvedLabel}:`)
    : null;

  const wrapperClasses = cn("inline-flex items-center gap-2", className);

  const baseButtonClasses = cn(
    "group inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm bg-muted hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    interactiveHoverClasses,
    buttonClassName,
  );

  const textClasses = cn("text-sm", textClassName);
  const iconClasses = "h-3.5 w-3.5";

  if (!text) {
    const accessibleMissing = labelWithSuffix
      ? `${labelWithSuffix} ${missingLabel}`
      : missingLabel;
    return (
      <span className={wrapperClasses}>
        {labelWithSuffix && (
          <span aria-hidden className={cn("text-sm font-medium text-muted-foreground", labelClassName)}>
            {labelWithSuffix}
          </span>
        )}
        <span className="sr-only">{accessibleMissing}</span>
        <span
          className={cn(
            "rounded-md bg-muted px-2 py-0.5 text-sm text-muted-foreground/80",
            missingClassName,
          )}
        >
          {missingLabel}
        </span>
      </span>
    );
  }

  const accessibleLabel = labelWithSuffix
    ? `${labelWithSuffix} ${text}`
    : text;
  const copyAriaLabel = ariaLabel || `Copy ${label || 'text'} ${text}`;

  return (
    <span className={wrapperClasses}>
      {labelWithSuffix && (
        <span aria-hidden className={cn("text-sm font-medium text-muted-foreground", labelClassName)}>
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
        <span className={textClasses}>{text}</span>
        <Copy aria-hidden className={iconClasses} />
      </button>
    </span>
  );
});

CopyableText.displayName = "CopyableText";
