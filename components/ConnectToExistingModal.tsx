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
  onGoToSettings: () => void;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
}

export function ConnectToExistingModal({ 
  isOpen, 
  isSupported, 
  onConnectToExisting,
  onGoToSettings,
  permissionStatus = 'unknown',
  hasStoredHandle = false
}: ConnectToExistingModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectToExisting = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const success = await onConnectToExisting();
      if (!success) {
        setError('Failed to connect to directory or load data. Please try again.');
      }
    } catch (err) {
      console.error('Connect to existing error:', err);
      setError('An error occurred while connecting to your data. Please try again.');
    } finally {
      setIsConnecting(false);
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
            {hasStoredHandle ? 'Ready to Connect' : 'Connect to Your Data'}
          </DialogTitle>
          <DialogDescription>
            {hasStoredHandle 
              ? 'Your previous data folder is ready to reconnect. Click below to continue where you left off.' 
              : 'Set up local data storage and load your existing cases.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
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



          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">What happens when you connect:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>{hasStoredHandle ? 'Reconnect to your existing folder' : 'Choose or create a folder for your case data'}</li>
              <li>{hasStoredHandle ? 'Confirm access permissions' : 'Grant read/write permission to that folder'}</li>
              <li>Directly load any existing case files (no import processing)</li>
              <li>Start working with your data immediately</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleConnectToExisting}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {hasStoredHandle ? 'Reconnect to Stored Folder' : 'Connect to Existing'}
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
                  >
                    Go to Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {hasStoredHandle 
              ? 'This will reconnect to your previously selected folder'
              : 'This will open your browser\'s folder selection dialog'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}