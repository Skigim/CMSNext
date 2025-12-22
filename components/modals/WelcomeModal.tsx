import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  FolderOpen,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { createLogger } from "@/utils/logger";
import { AuthBackdrop } from "./AuthBackdrop";

const logger = createLogger("WelcomeModal");

/**
 * Welcome/Onboarding modal for first-time users (no stored directory handle).
 * Flow: Choose folder → Create password → Done
 */
type WelcomeStep = "welcome" | "password";

interface WelcomeModalProps {
  isOpen: boolean;
  isSupported: boolean;
  onSetupComplete: () => void;
  onGoToSettings: () => void;
}

export function WelcomeModal({
  isOpen,
  isSupported,
  onSetupComplete,
}: WelcomeModalProps) {
  const encryption = useEncryption();
  const { service, connectToFolder, loadExistingData } = useFileStorage();

  const [step, setStep] = useState<WelcomeStep>("welcome");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessingPassword, setIsProcessingPassword] = useState(false);

  // Handle folder selection
  const handleChooseFolder = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      logger.lifecycle("Choosing folder for new setup");

      const connected = await connectToFolder();
      if (!connected) {
        logger.warn("Folder selection cancelled");
        return;
      }

      // Check if there's existing encrypted data in this folder
      const status = await service?.checkFileEncryptionStatus();
      logger.info("File status in chosen folder", { status });

      if (status?.exists && status.encrypted) {
        // User chose a folder with existing encrypted data
        setError(
          "This folder already has encrypted data. Choose a different folder or use the login screen."
        );
        return;
      }

      // New folder or unencrypted - proceed to password creation
      setStep("password");
    } catch (err) {
      logger.error("Folder selection error", { error: String(err) });
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsConnecting(false);
    }
  }, [connectToFolder, service]);

  // Handle password creation
  const handleCreatePassword = useCallback(async () => {
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setIsProcessingPassword(true);
    setError(null);

    try {
      // Set up encryption
      encryption.setPendingPassword(password);
      const authSuccess = await encryption.authenticate("admin", password);
      if (!authSuccess) {
        encryption.setPendingPassword(null);
        setError("Failed to set up encryption");
        return;
      }

      // Initialize data (will be encrypted on first save)
      await loadExistingData();

      logger.info("Setup complete");
      onSetupComplete();
    } catch (err) {
      logger.error("Password setup error", { error: String(err) });
      encryption.setPendingPassword(null);
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsProcessingPassword(false);
    }
  }, [password, confirmPassword, encryption, loadExistingData, onSetupComplete]);

  // Go back to welcome
  const handleBack = useCallback(() => {
    setStep("welcome");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    encryption.clearCredentials();
  }, [encryption]);

  // Browser not supported
  if (!isSupported) {
    return (
      <>
        <AuthBackdrop isOpen={isOpen} />
        <Dialog open={isOpen}>
          <DialogContent className="sm:max-w-md" hideCloseButton>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Browser Not Supported
              </DialogTitle>
              <DialogDescription>
                This application requires the File System Access API, which is not
                supported in your current browser.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please use a supported browser such as:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Google Chrome (version 86+)</li>
                  <li>Microsoft Edge (version 86+)</li>
                  <li>Opera (version 72+)</li>
                </ul>
              </AlertDescription>
            </Alert>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Password creation step
  if (step === "password") {
    return (
      <>
        <AuthBackdrop isOpen={isOpen} />
        <Dialog open={isOpen}>
          <DialogContent hideCloseButton className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Create Your Password
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                This password encrypts your data. Choose something memorable.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isProcessingPassword && password.trim() && confirmPassword.trim()) {
                  handleCreatePassword();
                }
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="pl-10"
                    disabled={isProcessingPassword}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10"
                    disabled={isProcessingPassword}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <p className="text-xs text-muted-foreground text-center">
                <span className="text-amber-600 dark:text-amber-400">Remember this password</span>
                {" — "}there's no way to recover it if forgotten.
              </p>
            </form>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button variant="outline" onClick={handleBack} disabled={isProcessingPassword}>
                Back
              </Button>
              <Button
                onClick={handleCreatePassword}
                disabled={isProcessingPassword || !password.trim() || !confirmPassword.trim()}
                className="w-full sm:w-auto"
              >
                {isProcessingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Started
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Welcome step (default)
  return (
    <>
      <AuthBackdrop isOpen={isOpen} />
      <Dialog open={isOpen}>
        <DialogContent hideCloseButton className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-semibold">
              Welcome to CMSNext
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your secure, local-first case management system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Simple feature highlights */}
            <div className="grid gap-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Private & Secure</p>
                  <p className="text-xs text-muted-foreground">
                    AES-256 encryption keeps your data safe on your computer
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">You Own Your Data</p>
                  <p className="text-xs text-muted-foreground">
                    Choose any folder — nothing is sent to external servers
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="sm:justify-center">
            <Button onClick={handleChooseFolder} disabled={isConnecting} size="lg" className="w-full sm:w-auto px-8">
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Choose Save Folder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WelcomeModal;
