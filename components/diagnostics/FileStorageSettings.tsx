import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FolderOpen,
  HardDrive,
  XCircle,
  AlertTriangle,
  Settings as SettingsIcon,
  Save,
  Folder,
  WifiOff,
  FileText,
  Upload,
} from 'lucide-react';
import { useFileStorage } from '@/contexts/FileStorageContext';
import { useAutosaveStatus } from '@/hooks/useAutosaveStatus';
import { AutosaveStatusBadge } from '@/components/app/AutosaveStatusBadge';
import { toast } from "sonner";
import { withFileSystemErrorBoundary } from '@/components/error/ErrorBoundaryHOC';

export function FileStorageSettings() {
  const { 
    service, 
    isSupported, 
    isConnected, 
    connectToFolder, 
    disconnect, 
    saveNow, 
    updateSettings,
    listDataFiles,
    loadDataFromFile
  } = useFileStorage();

  const autosaveStatus = useAutosaveStatus();

  const [localSettings, setLocalSettings] = useState({
    enabled: true,
    saveInterval: 120, // in seconds for UI
    debounceDelay: 5,  // in seconds for UI
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const consecutiveFailures = autosaveStatus.consecutiveFailures;

  // Debug current state
  console.log('[FileStorageSettings] Render state:', { 
    isConnected, 
    availableFilesCount: availableFiles.length, 
    availableFiles,
    isLoadingFiles 
  });

  // Load settings from service when available
  useEffect(() => {
    if (service) {
      // Use default settings since getStatus doesn't have config info
      setLocalSettings({
        enabled: true, // Default to enabled
        saveInterval: 120, // Default 2 minutes
        debounceDelay: 5,  // Default 5 seconds
      });
    }
  }, [service]);

  // Load available files when connected
  const loadAvailableFiles = useCallback(async () => {
    console.log('[FileStorageSettings] loadAvailableFiles called', { isConnected, listDataFiles: typeof listDataFiles });
    setIsLoadingFiles(true);
    try {
      const files = await listDataFiles();
      console.log('[FileStorageSettings] loadAvailableFiles result:', files);
      setAvailableFiles(files);
      if (files.length > 0) {
        toast.success(`Found ${files.length} data file(s)`, { id: 'files-found' }); // Deduplicate with ID
      } else {
        toast.info("No data files found in the connected folder", { id: 'no-files-found' });
      }
    } catch (error) {
      console.error('[FileStorageSettings] loadAvailableFiles error:', error);
      toast.error("Failed to load available files");
    } finally {
      setIsLoadingFiles(false);
    }
  }, [listDataFiles, isConnected]);

  useEffect(() => {
    if (isConnected) {
      loadAvailableFiles();
    } else {
      setAvailableFiles([]);
    }
  }, [isConnected, loadAvailableFiles]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const success = await connectToFolder();
      if (success) {
        toast.success("Successfully connected to folder");
      } else {
        toast.error("Failed to connect to folder");
      }
    } catch (error) {
      toast.error("Error connecting to folder");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success("Disconnected from folder");
    } catch (error) {
      toast.error("Error disconnecting from folder");
    }
  };

  const handleSaveNow = async () => {
    setIsManualSaving(true);
    try {
      await saveNow();
      toast.success("Data saved to file successfully");
    } catch (error) {
      toast.error("Failed to save data to file");
    } finally {
      setIsManualSaving(false);
    }
  };

  const handleLoadFromFile = async (fileName: string) => {
    const toastId = toast.loading(`Loading data from ${fileName}...`);
    try {
      console.log('[FileStorageSettings] Loading file:', fileName);
      const data = await loadDataFromFile(fileName);
      console.log('[FileStorageSettings] File data loaded:', data);
      
      if (data) {
        toast.success(`Successfully loaded data from ${fileName}`, { id: toastId });
        // Note: Data will be automatically synced through the dataLoadCallback system
        // No page refresh needed - React state will update automatically
      } else {
        console.warn('[FileStorageSettings] No data found in file:', fileName);
        toast.error(`No data found in ${fileName}`, { id: toastId });
      }
    } catch (error) {
      console.error('[FileStorageSettings] Failed to load file:', error);
      toast.error(`Failed to load data from ${fileName}`, { id: toastId });
    }
  };

  const handleSettingsChange = (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    
    // Apply settings to service (convert seconds back to milliseconds)
    try {
      updateSettings({
        enabled: newSettings.enabled,
        saveInterval: newSettings.saveInterval * 1000,
        debounceDelay: newSettings.debounceDelay * 1000,
      });
      
      // Show appropriate toast based on what changed
      if (key === 'enabled') {
        toast.success(value ? "Autosave enabled" : "Autosave disabled");
      } else {
        toast.success("Autosave settings updated");
      }
    } catch (error) {
      toast.error("Failed to update autosave settings");
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <CardTitle>File Storage</CardTitle>
          </div>
          <CardDescription>
            Automatic file backup and storage management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>File System Access API not supported</strong><br />
              Your browser doesn't support the File System Access API. This feature requires Chrome, Edge, or other Chromium-based browsers.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <CardTitle>File Storage</CardTitle>
        </div>
        <CardDescription>
          Automatic file backup and storage management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Connection Status</h4>
              <p className="text-sm text-muted-foreground">
                Current file storage connection state
              </p>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-emerald-600 dark:bg-emerald-700 text-white" : undefined}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          <AutosaveStatusBadge summary={autosaveStatus} showDetail />

          {autosaveStatus.lastSavedAt && (
            <div className="text-xs text-muted-foreground">
              Last saved: {new Date(autosaveStatus.lastSavedAt).toLocaleString()}
            </div>
          )}

          {autosaveStatus.pendingWrites > 0 && (
            <div className="text-xs text-muted-foreground">
              Pending writes: {autosaveStatus.pendingWrites}
            </div>
          )}
        </div>

        {/* Available Files Section - Only show when connected */}
        {isConnected && (
          <>
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Available Data Files</h4>
                  <p className="text-sm text-muted-foreground">
                    JSON files found in the connected folder
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAvailableFiles}
                  disabled={isLoadingFiles}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {isLoadingFiles ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                {availableFiles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium mb-2">Found {availableFiles.length} file(s):</div>
                    {availableFiles.map((fileName) => (
                      <div key={fileName} className="flex items-center justify-between p-2 bg-background rounded border">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{fileName}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLoadFromFile(fileName)}
                          className="gap-2 text-xs"
                        >
                          <Upload className="h-3 w-3" />
                          Load
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No JSON files found in the connected folder
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Connection Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Folder Connection</h4>
              <p className="text-sm text-muted-foreground">
                Connect to a folder on your computer for automatic backups
              </p>
            </div>
            <div className="flex gap-2">
              {isConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveNow}
                    disabled={isManualSaving || autosaveStatus.isSaving}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isManualSaving || autosaveStatus.isSaving ? 'Saving...' : 'Save Now'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="gap-2"
                  >
                    <WifiOff className="h-4 w-4" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  {isConnecting ? 'Connecting...' : 'Connect to Folder'}
                </Button>
              )}
            </div>
          </div>

          <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">How it works</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
              <li>• Choose a folder on your computer for automatic backups</li>
              <li>• Data is saved as JSON files with timestamps</li>
              <li>• Files are created/updated automatically as you work</li>
              <li>• Your data stays on your computer - no cloud dependency</li>
            </ul>
          </div>
        </div>

        <Separator />

        {/* Autosave Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Autosave Settings</h4>
              <p className="text-sm text-muted-foreground">
                Configure automatic saving behavior
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={localSettings.enabled}
                onCheckedChange={(checked) => handleSettingsChange('enabled', checked)}
              />
              <Label>Enable Autosave</Label>
            </div>
          </div>

          {localSettings.enabled && (
            <div className="space-y-4 pl-4 border-l-2 border-muted">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="saveInterval">Auto-save Interval (seconds)</Label>
                  <Input
                    id="saveInterval"
                    type="number"
                    min="30"
                    max="600"
                    value={localSettings.saveInterval}
                    onChange={(e) => handleSettingsChange('saveInterval', parseInt(e.target.value) || 120)}
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to automatically save (30-600 seconds)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="debounceDelay">Change Detection Delay (seconds)</Label>
                  <Input
                    id="debounceDelay"
                    type="number"
                    min="1"
                    max="30"
                    value={localSettings.debounceDelay}
                    onChange={(e) => handleSettingsChange('debounceDelay', parseInt(e.target.value) || 5)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Wait time after changes before saving (1-30 seconds)
                  </p>
                </div>
              </div>

              <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <SettingsIcon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Autosave Features</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>• Saves automatically after data changes</li>
                  <li>• Periodic saves at set intervals</li>
                  <li>• Smart debouncing prevents excessive saves</li>
                  <li>• Automatic retry on save failures</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Status Information */}
        {consecutiveFailures > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Save Issues Detected</strong><br />
              {consecutiveFailures} consecutive save failure(s). Check your folder connection and permissions.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Export with error boundary for file system operations
export default withFileSystemErrorBoundary(FileStorageSettings);