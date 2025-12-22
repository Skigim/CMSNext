import { useState, useCallback, useEffect, useRef } from "react";
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

const logger = createLogger("LoginModal");

interface LoginModalProps {
  isOpen: boolean;
  onLoginComplete: () => void;
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
}: LoginModalProps) {
  const encryption = useEncryption();
  const { service, connectToExisting, loadExistingData } = useFileStorage();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingFile, setIsCheckingFile] = useState(true);
  const [fileExists, setFileExists] = useState(true);

  const hasCheckedRef = useRef(false);

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
      } catch (err) {
        logger.warn("File check failed", { error: String(err) });
      } finally {
        setIsCheckingFile(false);
      }
    };

    checkFile();
  }, [isOpen, service]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasCheckedRef.current = false;
      setPassword("");
      setError(null);
      setIsLoading(false);
      setIsCheckingFile(true);
      setFileExists(true);
    }
  }, [isOpen]);

  const isDecryptionError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("Invalid password") ||
      message.includes("corrupted data") ||
      message.includes("Failed to derive key") ||
      message.includes("Decryption failed")
    );
  };

  const handleLogin = useCallback(async () => {
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.lifecycle("Logging in - connecting and decrypting");

      // Step 1: Connect to existing directory (requests permission)
      const connected = await connectToExisting();
      if (!connected) {
        setError("Failed to access data folder. Please try again or choose a different folder.");
        return;
      }

      // Step 2: Set up encryption with password
      encryption.setPendingPassword(password);
      const authSuccess = await encryption.authenticate("admin", password);
      if (!authSuccess) {
        encryption.setPendingPassword(null);
        setError("Failed to set up encryption");
        return;
      }

      // Step 3: Load and decrypt data
      await loadExistingData();

      logger.info("Login successful");
      onLoginComplete();
    } catch (err) {
      if (isDecryptionError(err)) {
        logger.warn("Decryption failed - wrong password");
        encryption.setPendingPassword(null);
        encryption.clearCredentials();
        setPassword("");
        setError("Incorrect password. Please try again.");
      } else {
        logger.error("Login error", { error: String(err) });
        encryption.setPendingPassword(null);
        setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [password, connectToExisting, encryption, loadExistingData, onLoginComplete]);

  // Loading state while checking file
  if (isCheckingFile) {
    return (
      <>
        <AuthBackdrop isOpen={isOpen} />
        <Dialog open={isOpen}>
          <DialogContent hideCloseButton className="sm:max-w-md" aria-describedby={undefined}>
            <DialogHeader className="sr-only">
              <DialogTitle>Loading</DialogTitle>
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
            Enter your password to unlock and access your data.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isLoading && password.trim()) {
              handleLogin();
            }
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">
            Your data is encrypted locally using AES-256. The password never leaves your device.
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
            disabled={isLoading || !password.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Unlock
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default LoginModal;
