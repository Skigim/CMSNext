import { memo } from "react";
import { ConnectionOnboarding } from "./ConnectionOnboarding";
import { AppLoadingState } from "./AppLoadingState";
import { CaseWorkspace } from "./CaseWorkspace";
import { GlobalContextMenu } from "@/components/common/GlobalContextMenu";

export interface AppContentViewProps {
  showConnectModal: boolean;
  isLoading: boolean;
  connection: React.ComponentProps<typeof ConnectionOnboarding>;
  loading: React.ComponentProps<typeof AppLoadingState>;
  workspace: React.ComponentProps<typeof CaseWorkspace>;
}

/**
 * Central view coordinator for the application shell. Accepts precomputed
 * props for the connection, loading, and main workspace experiences and
 * selects the correct presentation based on the current state. This keeps
 * `App.tsx` focused on state orchestration rather than conditional JSX.
 */
export const AppContentView = memo(function AppContentView({
  showConnectModal,
  isLoading,
  connection,
  loading,
  workspace,
}: AppContentViewProps) {
  if (showConnectModal) {
    return <ConnectionOnboarding {...connection} />;
  }

  if (isLoading) {
    return <AppLoadingState {...loading} />;
  }

  return (
    <GlobalContextMenu onNavigate={workspace.navigation.onNavigate}>
      <div className="contents">
        <CaseWorkspace {...workspace} />
      </div>
    </GlobalContextMenu>
  );
});
