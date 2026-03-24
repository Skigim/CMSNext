import { Backdrop, BackdropGlow, BackdropLayer } from "../ui/backdrop";
import { cn } from "@/lib/utils";

interface AuthBackdropProps {
  readonly isOpen: boolean;
  readonly className?: string;
}

/**
 * Decorative backdrop for authentication modals (Welcome + Login).
 * Provides a polished, opaque background with subtle visual interest.
 */
export function AuthBackdrop({ isOpen, className }: AuthBackdropProps) {
  if (!isOpen) return null;

  return (
    <Backdrop
      aria-hidden="true"
      className={cn(
        "z-40 overflow-hidden bg-gradient-to-br from-background via-background/95 to-background",
        "supports-[backdrop-filter]:backdrop-blur-sm animate-in fade-in-0 duration-300",
        className,
      )}
    >
      <BackdropLayer
        className="opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--foreground))_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <BackdropLayer className="[background-image:radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18)_0%,transparent_50%)]" />
      <BackdropLayer className="[background-image:radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.1)_0%,transparent_50%)]" />
      <BackdropLayer className="flex items-center justify-center">
        <BackdropGlow className="h-[400px] w-[500px] bg-primary/5" />
      </BackdropLayer>
    </Backdrop>
  );
}

