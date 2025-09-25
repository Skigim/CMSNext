import { memo, type ReactNode } from "react";
import { MainLayout } from "./MainLayout";
import type { AppView } from "../../types/view";

export interface AppNavigationConfig {
  currentView: AppView;
  breadcrumbTitle?: string;
  sidebarOpen: boolean;
  onNavigate: (view: AppView) => void;
  onNewCase: () => void;
  onSidebarOpenChange: (open: boolean) => void;
}

interface AppNavigationShellProps extends AppNavigationConfig {
  children: ReactNode;
}

/**
 * Lightweight wrapper around {@link MainLayout} that centralizes the
 * navigation wiring for the application shell. By moving this into its own
 * module we keep `App.tsx` focused on data orchestration.
 */
export const AppNavigationShell = memo(function AppNavigationShell({
  currentView,
  breadcrumbTitle,
  sidebarOpen,
  onNavigate,
  onNewCase,
  onSidebarOpenChange,
  children,
}: AppNavigationShellProps) {
  return (
    <MainLayout
      currentView={currentView}
      onNavigate={onNavigate}
      onNewCase={onNewCase}
      breadcrumbTitle={breadcrumbTitle}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={onSidebarOpenChange}
    >
      {children}
    </MainLayout>
  );
});
