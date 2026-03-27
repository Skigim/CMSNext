import type { ReactNode } from "react";

interface AppNavigationShellStubProps {
  children?: ReactNode;
  currentView?: string;
}

export function AppNavigationShell({
  children,
  currentView,
}: Readonly<AppNavigationShellStubProps>) {
  return (
    <div data-testid="app-navigation-shell" data-current-view={currentView}>
      {children}
    </div>
  );
}
