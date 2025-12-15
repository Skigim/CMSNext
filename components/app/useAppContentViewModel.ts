import { useMemo } from "react";
import type { AppNavigationConfig } from "./AppNavigationShell";
import type { AppContentViewProps } from "./AppContentView";
import type { CaseWorkspaceProps } from "./CaseWorkspace";
import type { FileStorageLifecycleState } from "../../contexts/FileStorageContext";

interface ConnectionHandlers {
  onConnectionComplete: () => void;
  onGoToSettings: () => void;
}

export interface AppContentViewModelArgs {
  showConnectModal: boolean;
  isLoading: boolean;
  isSupported?: boolean;
  permissionStatus?: string;
  hasStoredHandle: boolean;
  lifecycle?: FileStorageLifecycleState;
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
  lifecycle,
  navigationState,
  connectionHandlers,
  workspaceState,
}: AppContentViewModelArgs): AppContentViewProps {
  const connectionMessage = useMemo(() => {
    if (isSupported === false) {
      return "This browser can’t access local files. Try Chrome, Edge, or Opera.";
    }

    switch (lifecycle) {
      case "requestingPermission":
        return "Please choose a folder so we can store your cases.";
      case "blocked":
        return "Access to the data folder was blocked. Reconnect to continue.";
      case "recovering":
        return "Reconnecting to your data folder…";
      case "error":
        return "We hit a storage error. Review the details below.";
      default:
        return "Setting up data storage…";
    }
  }, [isSupported, lifecycle]);

  const connectionProps = useMemo<AppContentViewProps["connection"]>(
    () => ({
      navigation: {
        ...navigationState,
        breadcrumbTitle: "Setup Required",
      },
      message: connectionMessage,
      isOpen: showConnectModal,
      isSupported: isSupported ?? false,
      permissionStatus,
      hasStoredHandle,
      onConnectionComplete: connectionHandlers.onConnectionComplete,
      onGoToSettings: connectionHandlers.onGoToSettings,
    }),
    [
      connectionHandlers.onConnectionComplete,
      connectionHandlers.onGoToSettings,
      hasStoredHandle,
      connectionMessage,
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
