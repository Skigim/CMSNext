import { createContext, useContext, useState, useEffect, useCallback, useReducer, ReactNode, useMemo, useRef } from 'react';
import AutosaveFileService from '@/utils/AutosaveFileService';
import { FileStorageService } from '@/utils/services/FileStorageService';
import { normalizeCaseNotes } from '@/utils/normalization';
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
import { createLogger } from '@/utils/logger';

interface FileStorageContextType {
  service: AutosaveFileService | null;
  fileStorageService: FileStorageService | null;
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
  registerDataLoadHandler: (handler: (data: unknown) => void) => () => void;
}

const FileStorageContext = createContext<FileStorageContextType | null>(null);

const logger = createLogger('FileStorageContext');

interface FileStorageProviderProps {
  children: ReactNode;
  enabled?: boolean;
  getDataFunction?: () => any;
}

export function FileStorageProvider({ 
  children, 
  enabled = true,
  getDataFunction
}: FileStorageProviderProps) {
  const [service, setService] = useState<AutosaveFileService | null>(null);
  const [fileStorageService, setFileStorageService] = useState<FileStorageService | null>(null);
  const [state, dispatch] = useReducer(reduceFileStorageState, initialMachineState);
  const dataLoadHandlersRef = useRef(new Set<(data: unknown) => void>());

  // Initialize the service - only once per component mount
  useEffect(() => {
    logger.lifecycle('Creating AutosaveFileService instance');
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

    const persistNormalizationFixes = import.meta.env.VITE_PERSIST_NORMALIZATION_FIXES !== 'false';
    const storageService = new FileStorageService({
      fileService,
      persistNormalizationFixes,
      normalizeCaseNotes,
    });

    dispatch({ type: 'SERVICE_INITIALIZED', supported: fileService.isSupported() });
    setService(fileService);
    setFileStorageService(storageService);
    setFileService(fileService);

    return () => {
      logger.lifecycle('Destroying AutosaveFileService instance');
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
    if (!service) {
      return;
    }

    const callback = (data: unknown) => {
      dataLoadHandlersRef.current.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error('Data load handler threw an error', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    };

    service.setDataLoadCallback(callback);

    return () => {
      service.setDataLoadCallback(undefined);
    };
  }, [service]);

  const registerDataLoadHandler = useCallback((handler: (data: unknown) => void) => {
    dataLoadHandlersRef.current.add(handler);
    return () => {
      dataLoadHandlersRef.current.delete(handler);
    };
  }, []);

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
      logger.error('connectToFolder failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      logger.warn('connectToExisting called without service');
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
      logger.error('connectToExisting failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
    logger.debug('listDataFiles called', { serviceAvailable: !!service });
    if (!service) return [];
    try {
      const result = await service.listDataFiles();
      logger.debug('listDataFiles resolved', { fileCount: result.length });
      return result;
    } catch (error) {
      logger.error('listDataFiles failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }, [service]);

  const readNamedFile = async (fileName: string): Promise<any> => {
    logger.debug('readNamedFile called', { serviceAvailable: !!service, fileName });
    if (!service) return null;
    try {
      const result = await service.readNamedFile(fileName);
      logger.debug('readNamedFile resolved', {
        fileName,
        hasData: !!result,
      });
      return result;
    } catch (error) {
      logger.error('readNamedFile failed', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const loadExistingData = async (): Promise<any> => {
    if (!service) return null;
    return await service.loadExistingData();
  };

  const loadDataFromFile = useCallback(async (fileName: string): Promise<any> => {
    logger.debug('loadDataFromFile called', { serviceAvailable: !!service, fileName });
    if (!service) return null;
    try {
      const result = await service.loadDataFromFile(fileName);
      logger.debug('loadDataFromFile resolved', {
        fileName,
        hasData: !!result,
      });
      return result;
    } catch (error) {
      logger.error('loadDataFromFile failed', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [service]);

  const contextValue: FileStorageContextType = {
    service,
    fileStorageService,
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
    registerDataLoadHandler,
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

// Helper hook that returns a counter that increments when file storage data changes
// Used to trigger re-fetching of data in dependent hooks (e.g., useCaseActivityLog)
export function useFileStorageDataChange(): number {
  const { registerDataLoadHandler } = useFileStorage();
  const [changeCounter, setChangeCounter] = useState(0);
  
  useEffect(() => {
    // Register a handler that increments the counter whenever data is loaded
    const unsubscribe = registerDataLoadHandler(() => {
      setChangeCounter(prev => prev + 1);
    });

    return unsubscribe;
  }, [registerDataLoadHandler]);

  return changeCounter;
}

export function useFileStorageDataLoadHandler(handler: (data: unknown) => void) {
  const { registerDataLoadHandler } = useFileStorage();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const unsubscribe = registerDataLoadHandler(data => {
      handlerRef.current(data);
    });

    return unsubscribe;
  }, [registerDataLoadHandler]);
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
