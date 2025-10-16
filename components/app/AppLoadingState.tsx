import { memo } from "react";
import { Card, CardContent } from "../ui/card";
import { Spinner } from "../ui/spinner";
import { AppNavigationShell, type AppNavigationConfig } from "./AppNavigationShell";

interface AppLoadingStateProps {
  navigation: AppNavigationConfig;
  message?: string;
}

/**
 * Displays a consistent loading experience while case data is retrieved.
 * By extracting this from `App.tsx` we keep rendering concerns isolated
 * from the shell orchestration logic.
 *
 * Uses shadcn/ui primitives (Card, Spinner) for theme-compatible styling
 * and proper centering with Tailwind flex utilities.
 */
export const AppLoadingState = memo(function AppLoadingState({
  navigation,
  message = "Loading cases...",
}: AppLoadingStateProps) {
  return (
    <AppNavigationShell {...navigation}>
      <div className="flex h-96 items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Spinner size={32} className="mb-4 text-primary" />
            <p className="text-center text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      </div>
    </AppNavigationShell>
  );
});
