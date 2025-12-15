import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "../ui/dropdown-menu";
import { FolderOpen, AlertCircle, Loader2, Upload, Database, ChevronDown, FileJson, Lock, User } from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ConnectToExistingModal");

type ConnectionStep = "login" | "choose";

interface ConnectToExistingModalProps {
  isOpen: boolean;
  isSupported: boolean;
  onConnectToExisting: () => Promise<boolean>;
  onChooseNewFolder: () => Promise<boolean>;
  onGoToSettings: () => void;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
}

export function ConnectToExistingModal({ 
  isOpen, 
  isSupported, 
  onConnectToExisting,
  onChooseNewFolder,
  onGoToSettings,
  permissionStatus = 'unknown',
  hasStoredHandle = false
}: ConnectToExistingModalProps) {
  const encryption = useEncryption();
  
  // Connection step state
  const [step, setStep] = useState<ConnectionStep>("login");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingType, setConnectingType] = useState<'existing' | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Login form state
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    
    setIsAuthenticating(true);
    setError(null);
    
    try {
      logger.lifecycle("Authenticating user", { username });
      
      // Store password for key derivation when file is read
      // This is needed because we don't know the salt until we read the file
      encryption.setPendingPassword(password);
      
      // Authenticate without salt for now - key will be derived when file is read
      const success = await encryption.authenticate(username, password);
      
      if (success) {
        logger.info("Authentication successful, proceeding to folder selection");
        setStep("choose");
        setError(null);
      } else {
        // Clear pending password on auth failure
        encryption.setPendingPassword(null);
        setError("Authentication failed. Please try again.");
      }
    } catch (err) {
      // Clear pending password on error
      encryption.setPendingPassword(null);
      logger.error("Login error", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError("An error occurred during login.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [username, password, encryption]);

  // Helper to check if error is a decryption failure
  const isDecryptionError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Invalid password') ||
      message.includes('corrupted data') ||
      message.includes('Failed to derive key') ||
      message.includes('Decryption failed')
    );
  };

  // Handle decryption error by returning to login step
  const handleDecryptionError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Decryption failed, returning to login', { error: message });
    
    // Clear the pending password since it was wrong
    encryption.setPendingPassword(null);
    encryption.clearCredentials();
    
    // Return to login step with error
    setStep('login');
    setPassword(''); // Clear password field
    setError('Incorrect password. Please try again.');
  };

  const handleConnectToExisting = async () => {
    setIsConnecting(true);
    setConnectingType('existing');
    setError(null);
    
    try {
      logger.lifecycle('Starting existing connection', {
        permissionStatus,
        hasStoredHandle,
      });
      
      const success = await onConnectToExisting();
      logger.info('Existing connection completed', { success });
      
      if (!success) {
        const errorMsg = 'Failed to connect to existing directory. Please check console for details and try again.';
        logger.warn('Existing connection failed');
        setError(errorMsg);
      }
    } catch (err) {
      // Check if this is a decryption error (wrong password)
      if (isDecryptionError(err)) {
        handleDecryptionError(err);
        return;
      }
      
      logger.error('Existing connection errored', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(`Connection error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`);
    } finally {
      setIsConnecting(false);
      setConnectingType(null);
    }
  };

  const handleChooseNewFolder = async () => {
    setIsConnecting(true);
    setConnectingType('new');
    setError(null);
    
    try {
      logger.lifecycle('Starting new folder selection');
      
      const success = await onChooseNewFolder();
      logger.info('New folder selection completed', { success });
      
      if (!success) {
        const errorMsg = 'Failed to connect to new folder. Please try again or check if you cancelled the selection.';
        logger.warn('New folder selection failed');
        setError(errorMsg);
      }
    } catch (err) {
      // Check if this is a decryption error (wrong password)
      if (isDecryptionError(err)) {
        handleDecryptionError(err);
        return;
      }
      
      logger.error('New folder selection errored', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(`Folder selection error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`);
    } finally {
      setIsConnecting(false);
      setConnectingType(null);
    }
  };

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
          
          <p className="text-sm text-muted-foreground">
            The File System Access API is required for local file storage and automatic backup functionality.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 1: Login
  if (step === "login") {
    return (
      <Dialog open={isOpen}>
        <DialogContent hideCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Lock className="h-5 w-5 text-primary flex-shrink-0" />
              <span>Sign In</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Enter your credentials to access case management data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="pl-10"
                  disabled={isAuthenticating}
                />
              </div>
            </div>

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
                  placeholder="Enter password"
                  className="pl-10"
                  disabled={isAuthenticating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isAuthenticating) {
                      handleLogin();
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

            <p className="text-xs text-muted-foreground">
              Your password is used to encrypt and decrypt your local data files. 
              It is never stored or transmitted.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={handleLogin}
              disabled={isAuthenticating || !password.trim()}
              className="w-full"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Continue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Folder Selection
  return (
    <Dialog open={isOpen}>
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Database className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="break-words">Connect to Your Data</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm break-words">
            Choose how you'd like to access your case management data stored locally on your computer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 sm:space-y-6 overflow-x-hidden w-full">
          {/* Logged in indicator */}
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
            <User className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <AlertDescription className="text-green-800 dark:text-green-200 text-xs sm:text-sm">
              Signed in as <strong>{encryption.username}</strong>
            </AlertDescription>
          </Alert>

          {!hasStoredHandle && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
              <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs sm:text-sm break-words">
                <strong>First time setup:</strong> You'll be asked to choose a folder on your computer. 
                This can be an empty folder or one containing existing case files.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
            <p className="break-words">This application stores your data locally in files on your computer for:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4">
              <li className="break-words">Complete data privacy and security</li>
              <li className="break-words">Automatic local backups</li>
              <li className="break-words">Offline access to your cases</li>
              <li className="break-words">Full control over your data</li>
            </ul>
          </div>

          {hasStoredHandle && permissionStatus === 'granted' && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <FolderOpen className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <AlertDescription className="text-green-800 dark:text-green-200 text-xs sm:text-sm break-words">
                Your data folder is ready to reconnect. All permissions are in place.
              </AlertDescription>
            </Alert>
          )}

          {permissionStatus === 'denied' && (
            <Alert>
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm break-words">
                Permission was previously denied. You'll need to grant permission to continue.
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm break-words">{error}</AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 text-xs sm:text-sm space-y-3 w-full">
            <p className="font-medium break-words">Your connection options:</p>
            
            {hasStoredHandle && (
              <div className="flex gap-2 sm:gap-3">
                <Database className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-green-700 dark:text-green-300 break-words">Connect to Previous Folder</p>
                  <p className="text-xs text-muted-foreground break-words">Reconnect to your existing data folder and load your cases immediately.</p>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 sm:gap-3">
              <FolderOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-blue-700 dark:text-blue-300 break-words">Choose {hasStoredHandle ? 'Different' : 'Data'} Folder</p>
                <p className="text-xs text-muted-foreground break-words">
                  {hasStoredHandle 
                    ? 'Select a different folder or start fresh with a new location.' 
                    : 'Pick any folder on your computer to store your case data (can be empty or contain existing files).'}
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
                  <h3 className="font-medium text-xs sm:text-sm break-words">Import New Data</h3>
                  <p className="text-xs text-muted-foreground break-words">
                    Import cases from JSON files or start fresh
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center break-words">
            Choose the option that best fits your needs
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
                {isConnecting && connectingType === 'new' ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Load New Data</span>
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
              {isConnecting && connectingType === 'existing' ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin flex-shrink-0" />
                  <span className="truncate">Reconnecting...</span>
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