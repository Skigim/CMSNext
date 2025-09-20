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
  loadDataFromFile: (fileName: string) => Promise<any>;
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

  const connectToFolder = useCallback(async (): Promise<boolean> => {
    console.log('[FileStorageContext] connectToFolder called', { service: !!service });
    if (!service) return false;
    try {
      const success = await service.connect();
      console.log('[FileStorageContext] connectToFolder result:', success);
      if (success) {
        setHasExplicitlyConnected(true);
      }
      return success;
    } catch (error) {
      console.error('[FileStorageContext] connectToFolder error:', error);
      return false;
    }
  }, [service]);

  const connectToExisting = useCallback(async (): Promise<boolean> => {
    if (!service) return false;
    const success = await service.connectToExisting();
    if (success) {
      setHasExplicitlyConnected(true);
      setIsConnected(true); // Now we're truly connected
    }
    return success;
  }, [service]);

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

  const listDataFiles = useCallback(async (): Promise<string[]> => {
    console.log('[FileStorageContext] listDataFiles called', { service: !!service });
    if (!service) return [];
    try {
      const result = await service.listDataFiles();
      console.log('[FileStorageContext] listDataFiles result:', result);
      return result;
    } catch (error) {
      console.error('[FileStorageContext] listDataFiles error:', error);
      return [];
    }
  }, [service]);

  const readNamedFile = async (fileName: string): Promise<any> => {
    console.log('[FileStorageContext] readNamedFile called', { service: !!service, fileName });
    if (!service) return null;
    try {
      const result = await service.readNamedFile(fileName);
      console.log('[FileStorageContext] readNamedFile result:', result);
      return result;
    } catch (error) {
      console.error('[FileStorageContext] readNamedFile error:', error);
      return null;
    }
  };

  const loadExistingData = async (): Promise<any> => {
    if (!service) return null;
    return await service.loadExistingData();
  };

  const loadDataFromFile = useCallback(async (fileName: string): Promise<any> => {
    console.log('[FileStorageContext] loadDataFromFile called', { service: !!service, fileName });
    if (!service) return null;
    try {
      const result = await service.loadDataFromFile(fileName);
      console.log('[FileStorageContext] loadDataFromFile result:', result);
      return result;
    } catch (error) {
      console.error('[FileStorageContext] loadDataFromFile error:', error);
      throw error;
    }
  }, [service]);

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
    loadDataFromFile,
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