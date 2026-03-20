import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";

interface NeedsIntakeBadgeProps {
  className?: string;
}

export function NeedsIntakeBadge({ className }: Readonly<NeedsIntakeBadgeProps>) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
        className,
      )}
    >
      Needs Intake
    </Badge>
  );
}