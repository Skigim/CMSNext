import { useState, useCallback } from "react";
import { WelcomeModal } from "./WelcomeModal";
import { LoginModal } from "./LoginModal";

interface ConnectToExistingModalProps {
  isOpen: boolean;
  isSupported: boolean;
  onConnectionComplete: () => void;
  onGoToSettings: () => void;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
}

/**
 * Orchestrator modal that shows the appropriate connection flow:
 * - LoginModal: For returning users with a stored directory handle
 * - WelcomeModal: For first-time users without a stored handle
 */
export function ConnectToExistingModal({
  isOpen,
  isSupported,
  onConnectionComplete,
  onGoToSettings,
  hasStoredHandle = false,
}: ConnectToExistingModalProps) {
  // Track if user wants to switch to a different folder
  const [forcedWelcome, setForcedWelcome] = useState(false);

  // Reset forced welcome when modal closes/opens
  const handleConnectionComplete = useCallback(() => {
    setForcedWelcome(false);
    onConnectionComplete();
  }, [onConnectionComplete]);

  // User wants to use a different folder
  const handleChooseDifferentFolder = useCallback(() => {
    setForcedWelcome(true);
  }, []);

  // Determine which modal to show
  const showLoginModal = hasStoredHandle && !forcedWelcome;

  if (showLoginModal) {
    return (
      <LoginModal
        isOpen={isOpen}
        onLoginComplete={handleConnectionComplete}
        onChooseDifferentFolder={handleChooseDifferentFolder}
      />
    );
  }

  return (
    <WelcomeModal
      isOpen={isOpen}
      isSupported={isSupported}
      onSetupComplete={handleConnectionComplete}
      onGoToSettings={onGoToSettings}
    />
  );
}

export default ConnectToExistingModal;
