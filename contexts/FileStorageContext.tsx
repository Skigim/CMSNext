import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AutosaveFileService from '../utils/AutosaveFileService';
import { setFileService } from '../utils/fileServiceProvider';

interface FileStorageStatus {
  status: string;
  message: string;
  timestamp: number;
  permissionStatus: string;
  lastSaveTime: number | null;
  consecutiveFailures: number;
}

interface FileStorageContextType {
  service: AutosaveFileService | null;
  isSupported: boolean | undefined; // undefined = not initialized yet, boolean = definitive answer
  isConnected: boolean;
  hasStoredHandle: boolean;
  status: FileStorageStatus | null;
  connectToFolder: () => Promise<boolean>;
  connectToExisting: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  saveNow: () => Promise<void>;
  ensurePermission: () => Promise<boolean>;
  updateSettings: (settings: { enabled: boolean; saveInterval: number; debounceDelay: number }) => void;
  listDataFiles: () => Promise<string[]>;
  readNamedFile: (fileName: string) => Promise<any>;
  loadExistingData: () => Promise<any>;
}

const FileStorageContext = createContext<FileStorageContextType | null>(null);

interface FileStorageProviderProps {
  children: ReactNode;
  enabled?: boolean;
  getDataFunction?: () => any;
  onDataLoaded?: (data: any) => void;
}

export function FileStorageProvider({ 
  children, 
  enabled = true,
  getDataFunction,
  onDataLoaded 
}: FileStorageProviderProps) {
  const [service, setService] = useState<AutosaveFileService | null>(null);
  const [status, setStatus] = useState<FileStorageStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasExplicitlyConnected, setHasExplicitlyConnected] = useState(false);
  const [hasStoredHandle, setHasStoredHandle] = useState(false);

  // Initialize the service
  useEffect(() => {
    const fileService = new AutosaveFileService({
      fileName: 'case-tracker-data.json',
      enabled,
      saveInterval: 120000, // 2 minutes
      debounceDelay: 5000,   // 5 seconds
      maxRetries: 3,
      statusCallback: (statusUpdate) => {
        setStatus(statusUpdate);
        // More resilient connection state - don't disconnect on transient errors
        // Only disconnect if we get an explicit 'denied' permission or 'disconnected' status
        if (hasExplicitlyConnected) {
          if (statusUpdate.status === 'disconnected' || statusUpdate.permissionStatus === 'denied') {
            setIsConnected(false);
            setHasExplicitlyConnected(false); // Reset explicit connection flag on disconnect
          } else if (statusUpdate.permissionStatus === 'granted' && statusUpdate.status === 'connected') {
            setIsConnected(true);
          }
          // For other states like 'waiting', 'retrying', 'error' - maintain current connection state
        }
        // Track if we have a stored handle (even if not connected)
        // We have a stored handle if permission is granted/prompt AND status is not 'disconnected'
        setHasStoredHandle(
          (statusUpdate.permissionStatus === 'granted' || statusUpdate.permissionStatus === 'prompt') &&
          statusUpdate.status !== 'disconnected'
        );
      },
      errorCallback: (message, type) => {
        console.error(`File storage ${type || 'error'}:`, message);
        // You could also show a toast notification here
      }
    });

    setService(fileService);
    setFileService(fileService);

    return () => {
      fileService.destroy();
      setFileService(null);
    };
  }, [enabled, hasExplicitlyConnected]); // Include hasExplicitlyConnected since it's used in statusCallback

  // Handle data provider setup separately to avoid recreating service
  useEffect(() => {
    if (service && getDataFunction) {
      service.initializeWithReactState(getDataFunction, (statusUpdate) => {
        setStatus(statusUpdate);
        // More resilient connection state - don't disconnect on transient errors
        // Only disconnect if we get an explicit 'denied' permission or 'disconnected' status
        if (hasExplicitlyConnected) {
          if (statusUpdate.status === 'disconnected' || statusUpdate.permissionStatus === 'denied') {
            setIsConnected(false);
            setHasExplicitlyConnected(false); // Reset explicit connection flag on disconnect
          } else if (statusUpdate.permissionStatus === 'granted' && statusUpdate.status === 'connected') {
            setIsConnected(true);
          }
          // For other states like 'waiting', 'retrying', 'error' - maintain current connection state
        }
        // Track if we have a stored handle (even if not connected)
        // We have a stored handle if permission is granted/prompt AND status is not 'disconnected'
        setHasStoredHandle(
          (statusUpdate.permissionStatus === 'granted' || statusUpdate.permissionStatus === 'prompt') &&
          statusUpdate.status !== 'disconnected'
        );
      });
    }
  }, [service, getDataFunction, hasExplicitlyConnected]);

  // Handle data load callback setup separately
  useEffect(() => {
    if (service && onDataLoaded) {
      service.setDataLoadCallback(onDataLoaded);
    }
  }, [service, onDataLoaded]);

  const connectToFolder = async (): Promise<boolean> => {
    if (!service) return false;
    const success = await service.connect();
    if (success) {
      setHasExplicitlyConnected(true);
      setIsConnected(true); // Now we're truly connected
    }
    return success;
  };

  const connectToExisting = async (): Promise<boolean> => {
    if (!service) return false;
    const success = await service.connectToExisting();
    if (success) {
      setHasExplicitlyConnected(true);
      setIsConnected(true); // Now we're truly connected
    }
    return success;
  };

  const disconnect = async (): Promise<void> => {
    if (!service) return;
    await service.disconnect();
    setHasExplicitlyConnected(false);
    setIsConnected(false);
  };

  const saveNow = async (): Promise<void> => {
    if (!service) return;
    await service.save();
  };

  const ensurePermission = async (): Promise<boolean> => {
    if (!service) return false;
    return await service.ensurePermission();
  };

  const updateSettings = (settings: { enabled: boolean; saveInterval: number; debounceDelay: number }) => {
    if (!service) return;
    
    service.updateConfig(settings);
    
    if (settings.enabled && !service.getStatus().isRunning) {
      service.startAutosave();
    } else if (!settings.enabled && service.getStatus().isRunning) {
      service.stopAutosave();
    }
  };

  const listDataFiles = async (): Promise<string[]> => {
    if (!service) return [];
    return await service.listDataFiles();
  };

  const readNamedFile = async (fileName: string): Promise<any> => {
    if (!service) return null;
    return await service.readNamedFile(fileName);
  };

  const loadExistingData = async (): Promise<any> => {
    if (!service) return null;
    return await service.loadExistingData();
  };

  const notifyDataChange = useCallback(() => {
    if (service) {
      service.notifyDataChange();
    }
  }, [service]);

  // Expose notifyDataChange globally for easy access
  useEffect(() => {
    if (service) {
      (window as any).fileStorageNotifyChange = notifyDataChange;
    }
    return () => {
      delete (window as any).fileStorageNotifyChange;
    };
  }, [service, notifyDataChange]);

  const contextValue: FileStorageContextType = {
    service,
    isSupported: service ? service.isSupported() : undefined, // undefined until service is initialized
    isConnected,
    hasStoredHandle,
    status,
    connectToFolder,
    connectToExisting,
    disconnect,
    saveNow,
    ensurePermission,
    updateSettings,
    listDataFiles,
    readNamedFile,
    loadExistingData,
  };

  return (
    <FileStorageContext.Provider value={contextValue}>
      {children}
    </FileStorageContext.Provider>
  );
}

export function useFileStorage() {
  const context = useContext(FileStorageContext);
  if (!context) {
    throw new Error('useFileStorage must be used within a FileStorageProvider');
  }
  return context;
}

// Helper hook for notifying data changes
export function useFileStorageDataChange() {
  const { service } = useFileStorage();
  
  return () => {
    if (service) {
      service.notifyDataChange();
    }
  };
}