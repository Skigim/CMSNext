import { useMemo } from "react";
import type { AppNavigationConfig } from "./AppNavigationShell";
import type { AppContentViewProps } from "./AppContentView";
import type { CaseWorkspaceProps } from "./CaseWorkspace";

interface NavigationState {
  currentView: AppNavigationConfig["currentView"];
  breadcrumbTitle?: AppNavigationConfig["breadcrumbTitle"];
  sidebarOpen: AppNavigationConfig["sidebarOpen"];
  onNavigate: AppNavigationConfig["onNavigate"];
  onNewCase: AppNavigationConfig["onNewCase"];
  onSidebarOpenChange: AppNavigationConfig["onSidebarOpenChange"];
}

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
  navigationState: NavigationState;
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
  const navigationConfig = useMemo<AppNavigationConfig>(
    () => ({
      currentView: navigationState.currentView,
      breadcrumbTitle: navigationState.breadcrumbTitle,
      sidebarOpen: navigationState.sidebarOpen,
      onNavigate: navigationState.onNavigate,
      onNewCase: navigationState.onNewCase,
      onSidebarOpenChange: navigationState.onSidebarOpenChange,
    }),
    [
      navigationState.breadcrumbTitle,
      navigationState.currentView,
      navigationState.onNavigate,
      navigationState.onNewCase,
      navigationState.onSidebarOpenChange,
      navigationState.sidebarOpen,
    ],
  );

  const onboardingNavigation = useMemo<AppNavigationConfig>(
    () => ({
      ...navigationConfig,
      breadcrumbTitle: "Setup Required",
    }),
    [navigationConfig],
  );

  const loadingNavigation = useMemo<AppNavigationConfig>(
    () => ({
      ...navigationConfig,
      breadcrumbTitle: "Loading...",
    }),
    [navigationConfig],
  );

  const connectionProps = useMemo<AppContentViewProps["connection"]>(
    () => ({
      navigation: onboardingNavigation,
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
      onboardingNavigation,
      permissionStatus,
      showConnectModal,
    ],
  );

  const loadingProps = useMemo<AppContentViewProps["loading"]>(
    () => ({
      navigation: loadingNavigation,
      message: "Loading cases...",
    }),
    [loadingNavigation],
  );

  const workspaceProps = useMemo<AppContentViewProps["workspace"]>(
    () => ({
      navigation: navigationConfig,
      ...workspaceState,
    }),
    [navigationConfig, workspaceState],
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
