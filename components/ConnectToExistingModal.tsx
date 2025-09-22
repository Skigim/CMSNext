import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Card, CardContent } from "./ui/card";
import { FolderOpen, AlertCircle, Loader2, Upload, Database } from "lucide-react";

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingType, setConnectingType] = useState<'existing' | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnectToExisting = async () => {
    setIsConnecting(true);
    setConnectingType('existing');
    setError(null);
    
    try {
      console.log('[ConnectToExistingModal] Starting existing connection process...');
      console.log('[ConnectToExistingModal] Permission status:', permissionStatus);
      console.log('[ConnectToExistingModal] Has stored handle:', hasStoredHandle);
      
      const success = await onConnectToExisting();
      console.log('[ConnectToExistingModal] Existing connection result:', success);
      
      if (!success) {
        const errorMsg = 'Failed to connect to existing directory. Please check console for details and try again.';
        console.error('[ConnectToExistingModal] Existing connection failed');
        setError(errorMsg);
      }
    } catch (err) {
      console.error('[ConnectToExistingModal] Connect to existing error:', err);
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
      console.log('[ConnectToExistingModal] Starting new folder selection process...');
      
      const success = await onChooseNewFolder();
      console.log('[ConnectToExistingModal] New folder selection result:', success);
      
      if (!success) {
        const errorMsg = 'Failed to connect to new folder. Please try again or check if you cancelled the selection.';
        console.error('[ConnectToExistingModal] New folder selection failed');
        setError(errorMsg);
      }
    } catch (err) {
      console.error('[ConnectToExistingModal] Choose new folder error:', err);
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
          
          <div className="space-y-4">
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
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-lg" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Connect to Your Data
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to access your case management data stored locally on your computer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {!hasStoredHandle && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
              <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>First time setup:</strong> You'll be asked to choose a folder on your computer. 
                This can be an empty folder or one containing existing case files.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p>This application stores your data locally in files on your computer for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Complete data privacy and security</li>
              <li>Automatic local backups</li>
              <li>Offline access to your cases</li>
              <li>Full control over your data</li>
            </ul>
          </div>

          {hasStoredHandle && permissionStatus === 'granted' && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                Your data folder is ready to reconnect. All permissions are in place.
              </AlertDescription>
            </Alert>
          )}

          {permissionStatus === 'denied' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Permission was previously denied. You'll need to grant permission to continue.
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}



          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
            <p className="font-medium">Your connection options:</p>
            
            {hasStoredHandle && (
              <div className="flex gap-3">
                <Database className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">Connect to Previous Folder</p>
                  <p className="text-xs text-muted-foreground">Reconnect to your existing data folder and load your cases immediately.</p>
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <FolderOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-300">Choose {hasStoredHandle ? 'Different' : 'Data'} Folder</p>
                <p className="text-xs text-muted-foreground">
                  {hasStoredHandle 
                    ? 'Select a different folder or start fresh with a new location.' 
                    : 'Pick any folder on your computer to store your case data (can be empty or contain existing files).'}
                </p>
              </div>
            </div>
          </div>

          {/* Connection Options */}
          <div className="space-y-3">
            {hasStoredHandle && (
              <Button 
                onClick={handleConnectToExisting}
                disabled={isConnecting}
                className="w-full"
                size="lg"
                variant="default"
              >
                {isConnecting && connectingType === 'existing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Connect to Previous Folder
                  </>
                )}
              </Button>
            )}

            <Button 
              onClick={handleChooseNewFolder}
              disabled={isConnecting}
              className="w-full"
              size="lg"
              variant={hasStoredHandle ? "outline" : "default"}
            >
              {isConnecting && connectingType === 'new' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Selecting Folder...
                </>
              ) : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Choose {hasStoredHandle ? 'Different' : 'Data'} Folder
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted-foreground/20" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Card className="border-dashed border-muted-foreground/25">
              <CardContent className="pt-4 pb-4">
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Import New Data</h3>
                    <p className="text-xs text-muted-foreground">
                      Import cases from JSON files or start fresh
                    </p>
                  </div>
                  <Button 
                    onClick={onGoToSettings}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isConnecting}
                  >
                    Go to Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Choose the option that best fits your needs
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConnectToExistingModal;