import { useState, useCallback, useEffect, useRef, type FormEvent } from "react";
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
import { AlertCircle, Loader2, Lock, KeyRound, FolderOpen } from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { createLogger } from "@/utils/logger";
import { AuthBackdrop } from "./AuthBackdrop";
import { EncryptionError } from "@/types/encryption";

const logger = createLogger("LoginModal");

interface LoginModalProps {
  isOpen: boolean;
  onLoginComplete: () => void | Promise<void>;
  onChooseDifferentFolder: () => void;
}

/**
 * Login modal for returning users with a stored directory handle.
 * Shows password entry and handles connection + decryption in one step.
 */
export function LoginModal({
  isOpen,
  onLoginComplete,
  onChooseDifferentFolder,
}: Readonly<LoginModalProps>) {
  const encryption = useEncryption();
  const { setFileEncrypted } = encryption;
  const { service, connectToExisting, loadExistingData } = useFileStorage();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingUnlock, setIsPreparingUnlock] = useState(false);
  const [isCheckingFile, setIsCheckingFile] = useState(true);
  const [fileExists, setFileExists] = useState(true);
  const [fileIsEncrypted, setFileIsEncrypted] = useState(false);

  const hasCheckedRef = useRef(false);
  const passwordRequired = encryption.requiresPassword;
  const submitLabel = passwordRequired ? "Unlock" : "Open Workspace";
  const submitProgressLabel = isPreparingUnlock
    ? "Preparing workspace..."
    : passwordRequired
      ? "Unlocking..."
      : "Opening...";
  const canSubmit = !isLoading && (!passwordRequired || Boolean(password.trim()));
  let workspaceAccessHint = "This environment bypasses unlock gating and leaves workspace files readable on disk for inspection.";
  if (encryption.isEncryptionEnabled) {
    workspaceAccessHint = "Your data is encrypted locally using AES-256. The password never leaves your device.";
  } else if (passwordRequired) {
    workspaceAccessHint = "This environment preserves the unlock flow, but workspace files remain readable on disk for inspection.";
  }

  // E2E Mock Mode: bypass login entirely
  useEffect(() => {
    if (
      !isOpen ||
      import.meta.env.VITE_E2E_MOCK_MODE !== "true" ||
      hasCheckedRef.current
    ) {
      return;
    }

    hasCheckedRef.current = true;
    setIsCheckingFile(false);
    logger.info("E2E Mock Mode: Bypassing login");

    loadExistingData()
      .then(() => onLoginComplete())
      .catch((error) => {
        logger.error("E2E Mock Mode: Failed to load data", { error });
      });
  }, [isOpen, loadExistingData, onLoginComplete]);

  // Check if file exists on mount
  useEffect(() => {
    if (!isOpen || hasCheckedRef.current) return;

    hasCheckedRef.current = true;

    const checkFile = async () => {
      try {
        const status = await service?.checkFileEncryptionStatus();
        logger.info("File check on login", { status });

        if (!status?.exists) {
          // No file exists - shouldn't be on login screen
          setFileExists(false);
        }

        setFileIsEncrypted(status?.encrypted ?? false);
        setFileEncrypted(status?.encrypted ?? false);
      } catch (error) {
        logger.warn("File check failed", { error: String(error) });
      } finally {
        setIsCheckingFile(false);
      }
    };

    checkFile();
  }, [isOpen, service, setFileEncrypted]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasCheckedRef.current = false;
      setPassword("");
      setError(null);
      setIsLoading(false);
      setIsPreparingUnlock(false);
      setIsCheckingFile(true);
      setFileExists(true);
      setFileIsEncrypted(false);
      setFileEncrypted(false);
    }
  }, [isOpen, setFileEncrypted]);

  const isDecryptionError = useCallback((error: unknown): boolean => {
    if (error instanceof EncryptionError) return true;
    
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("Invalid password") ||
      message.includes("corrupted data") ||
      message.includes("Failed to derive key") ||
      message.includes("Decryption failed")
    );
  }, []);

  const connectAndAuthenticate = useCallback(async (): Promise<string | null> => {
    const connected = await connectToExisting();
    if (!connected) {
      return "Failed to access data folder. Please try again or choose a different folder.";
    }

    encryption.setPendingPassword(passwordRequired ? password : null);

    const authSuccess = await encryption.authenticate(
      "admin",
      passwordRequired ? password : "",
    );

    if (!authSuccess) {
      encryption.setPendingPassword(null);
      return "Failed to set up encryption";
    }

    return null;
  }, [connectToExisting, encryption, password, passwordRequired]);

  const handleTypedEncryptionError = useCallback((error: EncryptionError) => {
    encryption.setPendingPassword(null);

    if (error.code === "wrong_password") {
      logger.warn("Decryption failed - wrong password");
      encryption.clearCredentials();
      setPassword("");
      setError("Incorrect password. Please try again.");
      return;
    }

    if (error.code === "corrupt_salt") {
      logger.error("Decryption failed - corrupt salt");
      setError("Data file appears corrupted (invalid salt). Cannot decrypt.");
      return;
    }

    if (error.code === "system_error") {
      logger.error("Decryption failed - system error");
      setError(`System error: ${error.message}`);
      return;
    }

    logger.error("Decryption failed - unknown code", { code: error.code });
    setError(error.message);
  }, [encryption]);

  const handleUnknownLoginError = useCallback((error: unknown) => {
    if (isDecryptionError(error)) {
      logger.warn("Decryption failed - wrong password (generic mismatch)");
      encryption.setPendingPassword(null);
      encryption.clearCredentials();
      setPassword("");
      setError("Incorrect password. Please try again.");
      return;
    }

    logger.error("Login error", { error: String(error) });
    encryption.setPendingPassword(null);
    setError(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }, [encryption, isDecryptionError]);

  const handleLogin = useCallback(async () => {
    if (fileIsEncrypted && !encryption.isEncryptionEnabled) {
      setError(
        "This workspace is encrypted, but the current environment is configured for readable on-disk data. Choose a different folder or reopen it in a full-encryption environment.",
      );
      return;
    }

    if (passwordRequired && !password.trim()) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.lifecycle("Logging in - connecting and decrypting");

      const setupError = await connectAndAuthenticate();
      if (setupError) {
        setError(setupError);
        return;
      }

      if (fileIsEncrypted && encryption.isEncryptionEnabled) {
        setIsPreparingUnlock(true);
        await encryption.waitForStartupUnlockReady();
      }

      await loadExistingData();

      logger.info("Login successful");
      await onLoginComplete();
    } catch (error) {
      if (error instanceof EncryptionError) {
        handleTypedEncryptionError(error);
        return;
      }

      handleUnknownLoginError(error);
    } finally {
      setIsPreparingUnlock(false);
      setIsLoading(false);
    }
  }, [
    fileIsEncrypted,
    password,
    passwordRequired,
    connectAndAuthenticate,
    encryption,
    handleTypedEncryptionError,
    handleUnknownLoginError,
    loadExistingData,
    onLoginComplete,
  ]);

  const handleFormSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      void handleLogin();
    }
  }, [canSubmit, handleLogin]);

  // Loading state while checking file
  if (isCheckingFile) {
    return (
      <>
        <AuthBackdrop isOpen={isOpen} />
        <Dialog open={isOpen}>
          <DialogContent hideCloseButton className="sm:max-w-md">
            <DialogHeader className="sr-only">
              <DialogTitle>Loading</DialogTitle>
              <DialogDescription>
                Checking your data before unlocking your workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Checking your data...</p>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // No file exists - prompt to choose folder
  if (!fileExists) {
    return (
      <>
        <AuthBackdrop isOpen={isOpen} />
        <Dialog open={isOpen}>
          <DialogContent hideCloseButton className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                No Data Found
              </DialogTitle>
              <DialogDescription>
                We couldn't find your data file in the stored location. It may have been moved or deleted.
              </DialogDescription>
            </DialogHeader>

            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                Choose a folder to create new data or locate your existing data file.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={onChooseDifferentFolder} className="w-full">
                <FolderOpen className="mr-2 h-4 w-4" />
                Choose Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <AuthBackdrop isOpen={isOpen} />
      <Dialog open={isOpen}>
      <DialogContent hideCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            Welcome Back
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {passwordRequired
              ? "Enter your password to unlock and access your data."
              : "Open your workspace without password gating in this environment."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
          {passwordRequired ? (
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>
          ) : null}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            {workspaceAccessHint}
          </p>
        </form>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onChooseDifferentFolder}
            disabled={isLoading}
            className="text-xs text-muted-foreground"
          >
            Use different folder
          </Button>
          <Button
            onClick={handleLogin}
            disabled={!canSubmit}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submitProgressLabel}
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
