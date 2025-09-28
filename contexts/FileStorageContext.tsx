import { createContext, useContext, useState, useEffect, useCallback, useReducer, ReactNode, useMemo } from 'react';
import AutosaveFileService from '@/utils/AutosaveFileService';
import { setFileService } from '@/utils/fileServiceProvider';
import {
  reportFileStorageError,
  type FileStorageOperation,
} from '@/utils/fileStorageErrorReporter';
import {
  initialMachineState,
  reduceFileStorageState,
  readyLifecycleStates,
  blockingLifecycleStates,
  type FileStorageStatus,
  type FileStorageLifecycleState,
  type FileStoragePermissionState,
  type FileStorageErrorInfo,
} from './fileStorageMachine';

interface FileStorageContextType {
  service: AutosaveFileService | null;
  isSupported: boolean | undefined; // undefined = not initialized yet, boolean = definitive answer
  isConnected: boolean;
  hasStoredHandle: boolean;
  lifecycle: FileStorageLifecycleState;
  permissionStatus: FileStoragePermissionState;
  lastError: FileStorageErrorInfo | null;
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
  const [state, dispatch] = useReducer(reduceFileStorageState, initialMachineState);

  // Initialize the service - only once per component mount
  useEffect(() => {
    console.log('[FileStorageContext] Creating new AutosaveFileService instance');
    const fileService = new AutosaveFileService({
      fileName: 'case-tracker-data.json',
      enabled: true, // Always start enabled, we'll control it separately
      saveInterval: 120000, // 2 minutes
      debounceDelay: 5000,   // 5 seconds
      maxRetries: 3,
      statusCallback: (statusUpdate) => {
        dispatch({ type: 'STATUS_CHANGED', status: statusUpdate });
      },
      errorCallback: ({ message, type, error, context }) => {
        const operation = (context?.operation as FileStorageOperation) ?? 'unknown';
        const notification = reportFileStorageError({
          operation,
          error,
          messageOverride: message,
          severity: type === 'warning' ? 'warning' : type === 'info' ? 'info' : 'error',
          toast: false,
          context,
          source: 'AutosaveFileService',
        });

        if (notification) {
          dispatch({
            type: 'ERROR_REPORTED',
            error: {
              message: notification.message,
              type: notification.type,
              timestamp: notification.timestamp,
            },
          });
        }
      }
    });

    dispatch({ type: 'SERVICE_INITIALIZED', supported: fileService.isSupported() });
    setService(fileService);
    setFileService(fileService);

    return () => {
      console.log('[FileStorageContext] Destroying AutosaveFileService instance');
      fileService.destroy();
      setFileService(null);
      dispatch({ type: 'SERVICE_RESET' });
    };
  }, [dispatch]); // No dependencies - create only once per component mount

  // Handle enabled setting separately to avoid service recreation
  useEffect(() => {
    if (service && enabled !== undefined) {
      service.updateConfig({ enabled });
      if (enabled && !service.getStatus().isRunning) {
        service.startAutosave();
      } else if (!enabled && service.getStatus().isRunning) {
        service.stopAutosave();
      }
    }
  }, [service, enabled]);

  // Handle data provider setup separately to avoid recreating service
  useEffect(() => {
    if (service && getDataFunction) {
      service.initializeWithReactState(getDataFunction);
    }
  }, [service, getDataFunction]);

  // Handle data load callback setup separately
  useEffect(() => {
    if (service && onDataLoaded) {
      service.setDataLoadCallback(onDataLoaded);
    }
  }, [service, onDataLoaded]);

  const connectToFolder = useCallback(async (): Promise<boolean> => {
    if (!service) return false;
    dispatch({ type: 'CONNECT_REQUESTED' });
    try {
      const success = await service.connect();
      if (success) {
        dispatch({ type: 'CONNECT_CONFIRMED' });
      } else {
        dispatch({ type: 'CONNECT_COMPLETED' });
      }
      return success;
    } catch (error) {
      console.error('[FileStorageContext] connectToFolder error:', error);
      dispatch({
        type: 'ERROR_REPORTED',
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: 'error',
          timestamp: Date.now(),
        },
      });
      dispatch({ type: 'CONNECT_COMPLETED' });
      return false;
    }
  }, [dispatch, service]);

  const connectToExisting = useCallback(async (): Promise<boolean> => {
    if (!service) {
      console.error('[FileStorageContext] No service available for connectToExisting');
      return false;
    }
    dispatch({ type: 'CONNECT_REQUESTED' });
    try {
      const success = await service.connectToExisting();
      if (success) {
        dispatch({ type: 'CONNECT_CONFIRMED' });
      } else {
        dispatch({ type: 'CONNECT_COMPLETED' });
      }
      return success;
    } catch (error) {
      console.error('[FileStorageContext] connectToExisting error:', error);
      dispatch({
        type: 'ERROR_REPORTED',
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: 'error',
          timestamp: Date.now(),
        },
      });
      dispatch({ type: 'CONNECT_COMPLETED' });
      return false;
    }
  }, [dispatch, service]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!service) return;
    await service.disconnect();
    dispatch({ type: 'DISCONNECTED' });
  }, [dispatch, service]);

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

  const contextValue: FileStorageContextType = {
    service,
    isSupported: state.isSupported,
    isConnected: state.isConnected,
    hasStoredHandle: state.hasStoredHandle,
    lifecycle: state.lifecycle,
    permissionStatus: state.permissionStatus,
    lastError: state.lastError,
    status: state.statusSnapshot,
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

export interface FileStorageLifecycleSelectors {
  lifecycle: FileStorageLifecycleState;
  permissionStatus: FileStoragePermissionState;
  isReady: boolean;
  isBlocked: boolean;
  isErrored: boolean;
  isRecovering: boolean;
  isAwaitingUserChoice: boolean;
  hasStoredHandle: boolean;
  isConnected: boolean;
  lastError: FileStorageErrorInfo | null;
}

export function useFileStorageLifecycleSelectors(): FileStorageLifecycleSelectors {
  const { lifecycle, permissionStatus, hasStoredHandle, lastError, isConnected } = useFileStorage();

  return useMemo(() => {
    const isReady = readyLifecycleStates.has(lifecycle);
    const isBlocked = blockingLifecycleStates.has(lifecycle);
    const isErrored = lifecycle === 'error';
    const isRecovering = lifecycle === 'recovering';
    const isAwaitingUserChoice =
      !isReady &&
      !isBlocked &&
      (lifecycle === 'idle' || lifecycle === 'requestingPermission' || permissionStatus === 'prompt');

    return {
      lifecycle,
      permissionStatus,
      isReady,
      isBlocked,
      isErrored,
      isRecovering,
      isAwaitingUserChoice,
      hasStoredHandle,
      isConnected,
      lastError,
    };
  }, [
    lifecycle,
    permissionStatus,
    hasStoredHandle,
    lastError,
    isConnected,
  ]);
}

export type {
  FileStorageLifecycleState,
  FileStoragePermissionState,
  FileStorageStatus,
  FileStorageErrorInfo,
} from './fileStorageMachine';
