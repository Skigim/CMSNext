import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PlaceholderWidgetProps {
  title?: string;
  description?: string;
}

/**
 * Placeholder widget for dashboard layout.
 * Used to reserve space for upcoming features.
 */
export function PlaceholderWidget({ 
  title = "Coming Soon",
  description = "This widget is under development",
}: PlaceholderWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Construction className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Construction className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default PlaceholderWidget;
