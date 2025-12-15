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
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useFileStorage } from "@/contexts/FileStorageContext";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ConnectToExistingModal");

/**
 * Connection flow steps:
 * 1. "choose" - Select folder (existing or new)
 * 2. "password" - Enter password (encrypted file) or Create password (new/unencrypted)
 * 3. After password, data loads automatically
 */
type ConnectionStep = "choose" | "password";
type PasswordMode = "enter" | "create";

interface ConnectToExistingModalProps {
  isOpen: boolean;
  isSupported: boolean;
  onConnectionComplete: () => void;
  onGoToSettings: () => void;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
}

export function ConnectToExistingModal({
  isOpen,
  isSupported,
  onConnectionComplete,
  onGoToSettings,
  permissionStatus = "unknown",
  hasStoredHandle = false,
}: ConnectToExistingModalProps) {
  const encryption = useEncryption();
  const { service, connectToFolder, connectToExisting, loadExistingData } = useFileStorage();

  // Connection step state
  const [step, setStep] = useState<ConnectionStep>("choose");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("enter");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingType, setConnectingType] = useState<"existing" | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Password form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessingPassword, setIsProcessingPassword] = useState(false);

  // Helper to check if error is a decryption failure
  const isDecryptionError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes("Invalid password") ||
      message.includes("corrupted data") ||
      message.includes("Failed to derive key") ||
      message.includes("Decryption failed")
    );
  };

  // Handle folder selection and check encryption status
  const handleFolderSelected = useCallback(
    async (type: "existing" | "new") => {
      setIsConnecting(true);
      setConnectingType(type);
      setError(null);

      try {
        logger.lifecycle("Selecting folder", { type, hasStoredHandle });

        // Connect to folder (just establishes handle, doesn't load data)
        const connectFn = type === "existing" ? connectToExisting : connectToFolder;
        const connected = await connectFn();
        if (!connected) {
          logger.warn("Folder connection failed or cancelled");
          // User cancelled - not an error
          return;
        }

        // Check if file exists and is encrypted
        const status = await service?.checkFileEncryptionStatus();
        logger.info("File encryption status", { status });

        if (status?.exists && status.encrypted) {
          // Encrypted file - need to enter existing password
          setPasswordMode("enter");
        } else {
          // New or unencrypted file - need to create password
          setPasswordMode("create");
        }
        setStep("password");
      } catch (err) {
        logger.error("Folder selection error", {
          error: err instanceof Error ? err.message : String(err),
        });
        setError(`Connection error: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setIsConnecting(false);
        setConnectingType(null);
      }
    },
    [service, connectToFolder, connectToExisting, hasStoredHandle]
  );

  const handleConnectToExisting = useCallback(() => {
    handleFolderSelected("existing");
  }, [handleFolderSelected]);

  const handleChooseNewFolder = useCallback(() => {
    handleFolderSelected("new");
  }, [handleFolderSelected]);

  // Handle password submission
  const handlePasswordSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    if (passwordMode === "create") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 4) {
        setError("Password must be at least 4 characters");
        return;
      }
    }

    setIsProcessingPassword(true);
    setError(null);

    try {
      // Store password for encryption/decryption
      encryption.setPendingPassword(password);

      // Authenticate (sets up encryption context)
      const authSuccess = await encryption.authenticate("admin", password);
      if (!authSuccess) {
        encryption.setPendingPassword(null);
        setError("Failed to set up encryption");
        return;
      }

      // Now load the data (will decrypt if encrypted, or mark for encryption if new)
      await loadExistingData();

      logger.info("Password accepted, data loaded successfully");
      
      // Notify parent that connection is complete
      onConnectionComplete();
    } catch (err) {
      if (isDecryptionError(err)) {
        // Wrong password for encrypted file
        logger.warn("Decryption failed - wrong password");
        encryption.setPendingPassword(null);
        encryption.clearCredentials();
        setPassword("");
        setError("Incorrect password. Please try again.");
      } else {
        logger.error("Password submission error", {
          error: err instanceof Error ? err.message : String(err),
        });
        encryption.setPendingPassword(null);
        setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } finally {
      setIsProcessingPassword(false);
    }
  }, [password, confirmPassword, passwordMode, encryption, loadExistingData, onConnectionComplete]);

  // Go back to folder selection
  const handleBackToChoose = useCallback(() => {
    setStep("choose");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    encryption.clearCredentials();
  }, [encryption]);

  // Browser not supported view
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

          <p className="text-sm text-muted-foreground">
            The File System Access API is required for local file storage and
            automatic backup functionality.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Password entry (after folder selection)
  if (step === "password") {
    const isEnterMode = passwordMode === "enter";

    return (
      <Dialog open={isOpen}>
        <DialogContent hideCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {isEnterMode ? (
                <>
                  <KeyRound className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Enter Password</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Create Password</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {isEnterMode
                ? "Enter your password to decrypt and access your data."
                : "Create a password to encrypt and protect your data."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEnterMode ? "Enter your password" : "Create a password"}
                  className="pl-10"
                  disabled={isProcessingPassword}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isProcessingPassword) {
                      if (passwordMode === "create" && !confirmPassword) {
                        document.getElementById("confirmPassword")?.focus();
                      } else {
                        handlePasswordSubmit();
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>

            {passwordMode === "create" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pl-10"
                    disabled={isProcessingPassword}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isProcessingPassword) {
                        handlePasswordSubmit();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {passwordMode === "create" && (
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                  <strong>Important:</strong> Remember this password! There is no password
                  recovery. If you forget it, you cannot access your encrypted data.
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              Your data is encrypted locally using AES-256. The password never
              leaves your device.
            </p>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={handleBackToChoose} disabled={isProcessingPassword}>
              Back
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={
                isProcessingPassword ||
                !password.trim() ||
                (passwordMode === "create" && !confirmPassword.trim())
              }
              className="w-full sm:w-auto"
            >
              {isProcessingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEnterMode ? "Decrypting..." : "Encrypting..."}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {isEnterMode ? "Unlock" : "Secure & Continue"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 1: Folder Selection (default)
  return (
    <Dialog open={isOpen}>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Database className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="break-words">Connect to Your Data</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm break-words">
            Choose a folder to store your encrypted case management data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 overflow-x-hidden w-full">
          {!hasStoredHandle && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
              <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm break-words">
                <strong>First time setup:</strong> Choose a folder on your computer.
                Your data will be encrypted and stored locally.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
            <p className="break-words">
              This application stores your data locally with encryption:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4">
              <li className="break-words">AES-256 encryption protects your data</li>
              <li className="break-words">Password never stored or transmitted</li>
              <li className="break-words">Complete offline access</li>
              <li className="break-words">Full control over your files</li>
            </ul>
          </div>

          {hasStoredHandle && permissionStatus === "granted" && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <FolderOpen className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <AlertDescription className="text-green-800 dark:text-green-200 text-xs sm:text-sm break-words">
                Your data folder is ready to reconnect. All permissions are in place.
              </AlertDescription>
            </Alert>
          )}

          {permissionStatus === "denied" && (
            <Alert>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm break-words">
                Permission was previously denied. You'll need to grant permission to
                continue.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm break-words">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 text-xs sm:text-sm space-y-3 w-full">
            <p className="font-medium break-words">Your connection options:</p>

            {hasStoredHandle && (
              <div className="flex gap-2 sm:gap-3">
                <Database className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-green-700 dark:text-green-300 break-words">
                    Connect to Previous Folder
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    Reconnect to your existing data folder.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2 sm:gap-3">
              <FolderOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-blue-700 dark:text-blue-300 break-words">
                  Choose {hasStoredHandle ? "Different" : "Data"} Folder
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {hasStoredHandle
                    ? "Select a different folder or start fresh."
                    : "Pick any folder on your computer to store your data."}
                </p>
              </div>
            </div>
          </div>

          {/* Import Data Card Option */}
          <Card className="border-dashed border-muted-foreground/25 w-full">
            <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
              <div className="text-center space-y-2 sm:space-y-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-medium text-xs sm:text-sm break-words">
                    Import New Data
                  </h3>
                  <p className="text-xs text-muted-foreground break-words">
                    Import cases from JSON files or start fresh
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center break-words">
            After selecting a folder, you'll set up encryption
          </p>
        </div>

        {/* Dialog Footer with Action Buttons */}
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isConnecting}
                variant={hasStoredHandle ? "outline" : "default"}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                {isConnecting && connectingType === "new" ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span>New Location</span>
                    <ChevronDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleChooseNewFolder} disabled={isConnecting}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Choose New Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGoToSettings} disabled={isConnecting}>
                <FileJson className="mr-2 h-4 w-4" />
                Import JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasStoredHandle && (
            <Button
              onClick={handleConnectToExisting}
              disabled={isConnecting}
              variant="default"
              aria-label="Connect to previous folder"
              className="w-full sm:w-auto text-xs sm:text-sm flex-shrink-0"
            >
              {isConnecting && connectingType === "existing" ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin flex-shrink-0" />
                  <span className="truncate">Connecting...</span>
                </>
              ) : (
                <>
                  <Database className="mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">Connect to Previous Folder</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConnectToExistingModal;
