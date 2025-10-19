import { lazy, memo, Suspense } from "react";
import { AppNavigationShell, type AppNavigationConfig } from "./AppNavigationShell";

const ConnectToExistingModal = lazy(() => import("../modals/ConnectToExistingModal"));

interface ConnectionOnboardingProps {
  navigation: AppNavigationConfig;
  message?: string;
  isOpen: boolean;
  isSupported: boolean;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
  onConnectToExisting: () => Promise<boolean>;
  onChooseNewFolder: () => Promise<boolean>;
  onGoToSettings: () => void;
}

/**
 * Handles the initial connection workflow while keeping App.tsx focused on
 * data orchestration. Displays a placeholder workspace and coordinates the
 * lazily-loaded connection modal.
 *
 * The modal uses shadcn/ui Dialog primitives with:
 * - Focus trap and keyboard navigation (via Radix UI)
 * - Escape key handling for dismissal
 * - Proper ARIA labels and semantic structure
 * - Full accessibility compliance
 */
export const ConnectionOnboarding = memo(function ConnectionOnboarding({
  navigation,
  message = "Setting up data storage...",
  isOpen,
  isSupported,
  permissionStatus,
  hasStoredHandle,
  onConnectToExisting,
  onChooseNewFolder,
  onGoToSettings,
}: ConnectionOnboardingProps) {
  return (
    <>
      <AppNavigationShell {...navigation}>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">{message}</p>
          </div>
        </div>
      </AppNavigationShell>

      {isOpen && (
        <Suspense fallback={<div aria-label="Loading connection modal">Loading...</div>}>
          <ConnectToExistingModal
            isOpen={isOpen}
            isSupported={isSupported}
            onConnectToExisting={onConnectToExisting}
            onChooseNewFolder={onChooseNewFolder}
            onGoToSettings={onGoToSettings}
            permissionStatus={permissionStatus}
            hasStoredHandle={hasStoredHandle}
          />
        </Suspense>
      )}
    </>
  );
});
