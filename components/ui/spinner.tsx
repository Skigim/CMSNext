import { cn } from "./utils";

interface SpinnerProps extends React.ComponentProps<"div"> {
  /**
   * Size of the spinner in pixels (width and height)
   * @default 32
   */
  size?: number;
}

/**
 * Loading spinner component using Tailwind animations.
 * Integrates with theme system for color consistency.
 * 
 * @example
 * ```tsx
 * <Spinner />
 * <Spinner size={24} />
 * <Spinner size={48} className="text-primary" />
 * ```
 */
function Spinner({ size = 32, className, style, ...props }: SpinnerProps) {
  return (
    <div
      data-slot="spinner"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style,
      }}
      {...props}
    />
  );
}

export { Spinner };
