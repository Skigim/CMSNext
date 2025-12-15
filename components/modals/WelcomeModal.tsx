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
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  FolderOpen,
  AlertCircle,
  Loader2,
  Upload,
  Database,
  ChevronDown,
  FileJson,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { createLogger } from "@/utils/logger";

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
  onGoToSettings,
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
        // This shouldn't happen in welcome flow, but handle gracefully
        setError("This folder contains encrypted data. Please use a different folder or log in with your existing password.");
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
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-md" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Browser Not Supported
            </DialogTitle>
            <DialogDescription>
              This application requires the File System Access API, which is not supported in your current browser.
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
    );
  }

  // Password creation step
  if (step === "password") {
    return (
      <Dialog open={isOpen}>
        <DialogContent hideCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Create Your Password
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Create a password to encrypt and protect your data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isProcessingPassword && !confirmPassword) {
                      document.getElementById("confirm-password")?.focus();
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isProcessingPassword) {
                      handleCreatePassword();
                    }
                  }}
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                <strong>Important:</strong> Remember this password! There is no password recovery.
                If you forget it, you cannot access your encrypted data.
              </AlertDescription>
            </Alert>

            <p className="text-xs text-muted-foreground">
              Your data is encrypted locally using AES-256. The password never leaves your device.
            </p>
          </div>

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
                  <Lock className="mr-2 h-4 w-4" />
                  Secure & Continue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Welcome step (default)
  return (
    <Dialog open={isOpen}>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Database className="h-5 w-5 text-primary" />
            Welcome to Case Management
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Let's set up your secure, encrypted data storage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
            <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm">
              <strong>Your data stays on your computer.</strong> Nothing is sent to any server.
            </AlertDescription>
          </Alert>

          <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
            <p>This application provides:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4">
              <li>AES-256 encryption for all your data</li>
              <li>Password protection that never leaves your device</li>
              <li>Complete offline access</li>
              <li>Full control over your files</li>
            </ul>
          </div>

          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Choose a Folder</h3>
                  <p className="text-xs text-muted-foreground">
                    Pick any folder on your computer to store your encrypted data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isConnecting} className="w-full sm:w-auto">
                <Upload className="mr-2 h-4 w-4" />
                Import Data
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onGoToSettings} disabled={isConnecting}>
                <FileJson className="mr-2 h-4 w-4" />
                Import from JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleChooseFolder}
            disabled={isConnecting}
            className="w-full sm:w-auto"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <FolderOpen className="mr-2 h-4 w-4" />
                Get Started
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeModal;
