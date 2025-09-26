import { useMemo } from "react";
import type { AppNavigationConfig } from "./AppNavigationShell";
import type { AppContentViewProps } from "./AppContentView";
import type { CaseWorkspaceProps } from "./CaseWorkspace";

interface ConnectionHandlers {
  onConnectToExisting: () => Promise<boolean>;
  onChooseNewFolder: () => Promise<boolean>;
  onGoToSettings: () => void;
}

export interface AppContentViewModelArgs {
  showConnectModal: boolean;
  isLoading: boolean;
  isSupported?: boolean;
  permissionStatus?: string;
  hasStoredHandle: boolean;
  navigationState: AppNavigationConfig;
  connectionHandlers: ConnectionHandlers;
  workspaceState: Omit<CaseWorkspaceProps, "navigation">;
}

/**
 * Produces stable props for {@link AppContentView} so `App.tsx` can focus on
 * orchestrating data and side-effects. All conditional view wiring is kept in
 * one place to simplify future shell adjustments.
 */
export function useAppContentViewModel({
  showConnectModal,
  isLoading,
  isSupported,
  permissionStatus,
  hasStoredHandle,
  navigationState,
  connectionHandlers,
  workspaceState,
}: AppContentViewModelArgs): AppContentViewProps {
  const connectionProps = useMemo<AppContentViewProps["connection"]>(
    () => ({
      navigation: {
        ...navigationState,
        breadcrumbTitle: "Setup Required",
      },
      message: "Setting up data storage...",
      isOpen: showConnectModal,
      isSupported: isSupported ?? false,
      permissionStatus,
      hasStoredHandle,
      onConnectToExisting: connectionHandlers.onConnectToExisting,
      onChooseNewFolder: connectionHandlers.onChooseNewFolder,
      onGoToSettings: connectionHandlers.onGoToSettings,
    }),
    [
      connectionHandlers.onChooseNewFolder,
      connectionHandlers.onConnectToExisting,
      connectionHandlers.onGoToSettings,
      hasStoredHandle,
      isSupported,
      navigationState,
      permissionStatus,
      showConnectModal,
    ],
  );

  const loadingProps = useMemo<AppContentViewProps["loading"]>(
    () => ({
      navigation: {
        ...navigationState,
        breadcrumbTitle: "Loading...",
      },
      message: "Loading cases...",
    }),
    [navigationState],
  );

  const workspaceProps = useMemo<AppContentViewProps["workspace"]>(
    () => ({
      navigation: navigationState,
      ...workspaceState,
    }),
    [navigationState, workspaceState],
  );

  return useMemo(
    () => ({
      showConnectModal,
      isLoading,
      connection: connectionProps,
      loading: loadingProps,
      workspace: workspaceProps,
    }),
    [connectionProps, isLoading, loadingProps, showConnectModal, workspaceProps],
  );
}
