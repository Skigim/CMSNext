import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";
import { FolderOpen, AlertCircle, Loader2 } from "lucide-react";

interface DirectoryAccessModalProps {
  isOpen: boolean;
  isSupported: boolean;
  onGrantAccess: () => Promise<boolean>;
  permissionStatus?: string;
  hasStoredHandle?: boolean;
}

export function DirectoryAccessModal({ 
  isOpen, 
  isSupported, 
  onGrantAccess,
  permissionStatus = 'unknown',
  hasStoredHandle = false
}: DirectoryAccessModalProps) {
  const [isGranting, setIsGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrantAccess = async () => {
    setIsGranting(true);
    setError(null);
    
    try {
      const success = await onGrantAccess();
      if (!success) {
        setError('Failed to connect to directory. Please try again.');
      }
    } catch (err) {
      console.error('Directory access error:', err);
      setError('An error occurred while connecting to the directory.');
    } finally {
      setIsGranting(false);
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
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {hasStoredHandle ? 'Reconnect to Data Folder' : 'Connect to Data Folder'}
          </DialogTitle>
          <DialogDescription>
            {hasStoredHandle 
              ? 'You need to reconnect to your data folder to continue.' 
              : 'You need to connect to a folder to continue using the case tracking platform.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>This application stores your data locally in files on your computer for:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Complete data privacy and security</li>
              <li>Automatic local backups</li>
              <li>Offline access to your cases</li>
              <li>Full control over your data</li>
            </ul>
          </div>

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
            <p className="font-medium mb-2">What happens next:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Choose or create a folder for your case data</li>
              <li>Grant read/write permission to that folder</li>
              <li>Your data will be automatically saved as JSON files</li>
              <li>You can access these files anytime, even outside this app</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleGrantAccess}
              disabled={isGranting}
              className="w-full"
            >
              {isGranting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {hasStoredHandle ? 'Reconnect to Folder' : 'Grant Access to Folder'}
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              This will open your browser's folder selection dialog
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}