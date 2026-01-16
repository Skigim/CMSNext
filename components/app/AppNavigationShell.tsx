import { memo, type ReactNode } from "react";
import { MainLayout } from "./MainLayout";
import type { AppView } from "../../types/view";
import type { StoredCase } from "../../types/case";

export interface AppNavigationConfig {
  currentView: AppView;
  breadcrumbTitle?: string;
  /** The view from which the user navigated to case details (for breadcrumb context) */
  breadcrumbSourceView?: AppView;
  sidebarOpen: boolean;
  onNavigate: (view: AppView) => void;
  onNewCase: () => void;
  onSidebarOpenChange: (open: boolean) => void;
  /** All cases for pinned cases dropdown */
  cases?: StoredCase[];
  /** Handler to view a case from pinned dropdown */
  onViewCase?: (caseId: string) => void;
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
  breadcrumbSourceView,
  sidebarOpen,
  onNavigate,
  onNewCase,
  onSidebarOpenChange,
  cases,
  onViewCase,
  children,
}: AppNavigationShellProps) {
  return (
    <MainLayout
      currentView={currentView}
      onNavigate={onNavigate}
      onNewCase={onNewCase}
      breadcrumbTitle={breadcrumbTitle}
      breadcrumbSourceView={breadcrumbSourceView}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={onSidebarOpenChange}
      cases={cases}
      onViewCase={onViewCase}
    >
      {children}
    </MainLayout>
  );
});
