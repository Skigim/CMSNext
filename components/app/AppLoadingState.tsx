import { memo } from "react";
import { AppNavigationShell, type AppNavigationConfig } from "./AppNavigationShell";

interface AppLoadingStateProps {
  navigation: AppNavigationConfig;
  message?: string;
}

/**
 * Displays a consistent loading experience while case data is retrieved.
 * By extracting this from `App.tsx` we keep rendering concerns isolated
 * from the shell orchestration logic.
 */
export const AppLoadingState = memo(function AppLoadingState({
  navigation,
  message = "Loading cases...",
}: AppLoadingStateProps) {
  return (
    <AppNavigationShell {...navigation}>
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    </AppNavigationShell>
  );
});
