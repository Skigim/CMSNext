import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/providers/AppProviders";
import { FileStorageIntegrator } from "@/components/providers/FileStorageIntegrator";
import { AppContent } from "@/components/app/AppContent";
import { createLogger } from "@/utils/logger";
import { usePaperCutCapture } from "@/hooks/usePaperCutCapture";
import { PaperCutModal } from "@/components/common/PaperCutModal";
import { KeyboardShortcutsHelp } from "@/components/common/KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useAntiMicroDrag } from "@/hooks/useAntiMicroDrag";
import { Badge } from "@/components/ui/badge";
import { isEncryptionTemporarilyDisabled } from "@/utils/featureFlags";

const logger = createLogger("App");

// Custom events for cross-component communication
const NAVIGATION_EVENT = "app:navigate";
const NEW_CASE_EVENT = "app:newcase";
const FOCUS_SEARCH_EVENT = "app:focussearch";
const TOGGLE_SIDEBAR_EVENT = "app:togglesidebar";

export function dispatchNavigationEvent(path: string) {
  globalThis.dispatchEvent(new CustomEvent(NAVIGATION_EVENT, { detail: { path } }));
}

export function dispatchNewCaseEvent() {
  globalThis.dispatchEvent(new CustomEvent(NEW_CASE_EVENT));
}

export function dispatchFocusSearchEvent() {
  globalThis.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
}

export function dispatchToggleSidebarEvent() {
  globalThis.dispatchEvent(new CustomEvent(TOGGLE_SIDEBAR_EVENT));
}

export default function App() {
  logger.lifecycle("Rendering main App component");
  useAntiMicroDrag(); // Prevent accidental text selection on micro-drags
  const paperCut = usePaperCutCapture();
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const showDevNoEncryptionBadge = import.meta.env.DEV && isEncryptionTemporarilyDisabled();

  const handleNavigate = useCallback((path: string) => {
    dispatchNavigationEvent(path);
  }, []);

  const handleNewCase = useCallback(() => {
    dispatchNewCaseEvent();
  }, []);

  const handleFocusSearch = useCallback(() => {
    dispatchFocusSearchEvent();
  }, []);

  const handlePaperCut = useCallback(() => {
    paperCut.openModal();
  }, [paperCut]);

  const handleShowHelp = useCallback(() => {
    setIsShortcutsHelpOpen(true);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    dispatchToggleSidebarEvent();
  }, []);

  const { chordPending } = useKeyboardShortcuts({
    onNavigate: handleNavigate,
    onNewCase: handleNewCase,
    onFocusSearch: handleFocusSearch,
    onPaperCut: handlePaperCut,
    onShowHelp: handleShowHelp,
    onToggleSidebar: handleToggleSidebar,
  });

  return (
    <AppProviders>
      <FileStorageIntegrator>
        <AppContent />
        <PaperCutModal
          key={paperCut.openCount}
          open={paperCut.isOpen}
          onOpenChange={(open) => (open ? paperCut.openModal() : paperCut.closeModal())}
          route={paperCut.currentRoute}
          context={paperCut.currentContext}
          onSubmit={paperCut.submitPaperCut}
        />
        <KeyboardShortcutsHelp 
          open={isShortcutsHelpOpen} 
          onOpenChange={setIsShortcutsHelpOpen}
          onCustomize={() => {
            setIsShortcutsHelpOpen(false);
            dispatchNavigationEvent("/settings");
          }}
        />
        {showDevNoEncryptionBadge && (
          <Badge
            variant="secondary"
            className="fixed right-4 top-4 z-50 border border-amber-300 bg-amber-100 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            DEV: No Encryption
          </Badge>
        )}
        {chordPending && (
          <div className="fixed bottom-4 right-4 bg-background/95 border rounded-md px-3 py-2 text-sm shadow-lg z-50">
            Waiting for next key...
          </div>
        )}
        <Toaster />
      </FileStorageIntegrator>
    </AppProviders>
  );
}