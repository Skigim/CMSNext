import { cn } from "@/lib/utils";

interface AuthBackdropProps {
  isOpen: boolean;
  className?: string;
}

/**
 * Decorative backdrop for authentication modals (Welcome + Login).
 * Provides a polished, opaque background with subtle visual interest.
 */
export function AuthBackdrop({ isOpen, className }: AuthBackdropProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-40",
        // Base gradient - elegant dark to slightly lighter
        "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
        // Subtle pattern overlay
        "before:absolute before:inset-0 before:opacity-[0.03]",
        "before:bg-[radial-gradient(circle_at_1px_1px,_white_1px,_transparent_1px)]",
        "before:bg-[length:24px_24px]",
        // Soft corner accents
        "after:absolute after:inset-0",
        "after:bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.15)_0%,_transparent_50%)]",
        // Animation
        "animate-in fade-in-0 duration-300",
        className
      )}
    >
      {/* Bottom-right accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.1)_0%,_transparent_50%)]" />
      
      {/* Centered subtle glow behind modal area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[500px] h-[400px] bg-white/[0.02] rounded-full blur-3xl" />
      </div>
    </div>
  );
}

