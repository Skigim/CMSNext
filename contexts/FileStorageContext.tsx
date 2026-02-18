import { createContext, useContext, useEffect, useCallback, useReducer, ReactNode, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import AutosaveFileService from '@/utils/AutosaveFileService';
import { FileStorageService } from '@/utils/services/FileStorageService';
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

/**
 * File Storage context type - provides access to file system integration and autosave functionality.
 * 
 * Manages File System Access API integration, autosave functionality, and file permissions.
 * Wraps AutosaveFileService with React state management and permission handling.
 * 
 * ## Architecture
 * 
 * ```
 * FileStorageContext (React state + permission mgmt)
 *     ↓
 * FileStorageProvider (lifecycle management)
 *     ↓
 * AutosaveFileService (File System API integration, autosave)
 * ```
 * 
 * ## Lifecycle States
 * 
 * - **INITIAL**: Not yet connected
 * - **CONNECTING**: User selecting folder
 * - **CONNECTED**: Folder connected, ready for operations
 * - **ERROR**: Connection or permission error occurred
 * - **READY**: Fully initialized and ready for data operations
 * 
 * ## Permission States
 * 
 * - **INITIAL**: Permission status not yet determined
 * - **GRANTED**: User has granted write access
 * - **DENIED**: User denied permission request
 * 
 * @interface FileStorageContextType
 */
interface FileStorageContextType {
  /** Instance of AutosaveFileService, or null if not yet initialized */
  service: AutosaveFileService | null;
  /** Instance of FileStorageService, or null if not yet initialized */
  fileStorageService: FileStorageService | null;
  /** Whether File System Access API is supported (undefined while detecting) */
  isSupported: boolean | undefined;
  /** Whether a folder is currently connected for file operations */
  isConnected: boolean;
  /** Whether a handle to the folder is stored (persists across sessions) */
  hasStoredHandle: boolean;
  /** Current lifecycle state of file storage system */
  lifecycle: FileStorageLifecycleState;
  /** Current permission state for file operations */
  permissionStatus: FileStoragePermissionState;
  /** Last error encountered, if any */
  lastError: FileStorageErrorInfo | null;
  /** Current autosave status with statistics */
  status: FileStorageStatus | null;
  /** Connect to a new folder using directory picker */
  connectToFolder: () => Promise<boolean>;
  /** Restore connection to previously selected folder */
  connectToExisting: () => Promise<boolean>;
  /** Disconnect from the current folder */
  disconnect: () => Promise<void>;
  /** Trigger immediate save (bypasses autosave debounce) */
  saveNow: () => Promise<void>;
  /** Request write permission for the current folder */
  ensurePermission: () => Promise<boolean>;
  /** Update autosave settings (enabled, interval, debounce) */
  updateSettings: (settings: { enabled: boolean; saveInterval: number; debounceDelay: number }) => void;
  /** List all .json files in the connected folder */
  listDataFiles: () => Promise<string[]>;
  /** Read JSON from a specific file in the connected folder */
  readNamedFile: (fileName: string) => Promise<unknown>;
  /** Load existing data from the default case-tracker-data.json file */
  loadExistingData: () => Promise<unknown>;
  /** Load data from a specific file in the connected folder */
  loadDataFromFile: (fileName: string) => Promise<unknown>;
  /** Register callback for when data is loaded from file - returns cleanup function */
  registerDataLoadHandler: (handler: (data: unknown) => void) => () => void;
}

const FileStorageContext = createContext<FileStorageContextType | null>(null);

const logger = createLogger('FileStorageContext');

/**
 * Props for FileStorageProvider component.
 * @interface FileStorageProviderProps
 */
interface FileStorageProviderProps {
  /** React child components */
  children: ReactNode;
  /** Whether autosave is enabled on startup (default: true) */
  enabled?: boolean;
  /** Optional function to get current application data for autosave */
  getDataFunction?: () => any;
}

function mapSeverityFromType(type?: string): 'error' | 'warning' | 'info' {
  if (type === 'warning') {
    return 'warning';
  }
  if (type === 'info') {
    return 'info';
  }
  return 'error';
}

/**
 * FileStorageProvider - Manages file system access and autosave functionality.
 * 
 * Provides access to the File System Access API with React state management.
 * Handles:
 * - Folder connection and permission management
 * - Autosave with configurable interval and debounce
 * - File reading and writing operations
 * - Error handling and status tracking
 * - Lifecycle state management (INITIAL → CONNECTING → CONNECTED → READY)
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <FileStorageProvider enabled={true}>
 *       <YourApp />
 *     </FileStorageProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage Pattern
 * 
 * ```typescript
 * function MyComponent() {
 *   const { isConnected, connectToFolder, saveNow } = useFileStorage();
 *   
 *   if (!isConnected) {
 *     return <button onClick={connectToFolder}>Connect Folder</button>;
 *   }
 *   
 *   return <button onClick={saveNow}>Save Now</button>;
 * }
 * ```
 * 
 * ## Browser Compatibility
 * 
 * Check `isSupported` before using. If `false`, File System Access API is unavailable:
 * 
 * ```typescript
 * const { isSupported } = useFileStorage();
 * 
 * if (!isSupported) {
 *   return <CompatibilityPrompt />;
 * }
 * ```
 * 
 * ## Autosave Defaults
 * 
 * - Save interval: 2 minutes
 * - Debounce delay: 5 seconds (waits 5s after last change before saving)
 * - Max retries: 3 attempts per save
 * 
 * ## Error Handling
 * 
 * Errors are captured in `lastError` with timestamp and type:
 * - 'error': Critical failures
 * - 'warning': Non-blocking issues (e.g., retry in progress)
 * - 'info': Status updates
 * 
 * @component
 * @param {FileStorageProviderProps} props - Provider configuration
 * @returns {ReactNode} Provider wrapping children
 */
export function FileStorageProvider({ 
  children, 
  enabled = true,
  getDataFunction
}: Readonly<FileStorageProviderProps>) {
  const [state, dispatch] = useReducer(reduceFileStorageState, initialMachineState);
  const dataLoadHandlersRef = useRef(new Set<(data: unknown) => void>());

  const service = useMemo(() => new AutosaveFileService({
    fileName: 'case-tracker-data.json',
    enabled: true,
    saveInterval: 120000,
    debounceDelay: 5000,
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
        severity: mapSeverityFromType(type),
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
  }), [dispatch]);

  const fileStorageService = useMemo(
    () => new FileStorageService({ fileService: service }),
    [service],
  );

  // Initialize the service - only once per component mount
  useEffect(() => {
    logger.lifecycle('Creating AutosaveFileService instance');

    dispatch({ type: 'SERVICE_INITIALIZED', supported: service.isSupported() });
    setFileService(service);

    return () => {
      logger.lifecycle('Destroying AutosaveFileService instance');
      service.destroy();
      setFileService(null);
      dispatch({ type: 'SERVICE_RESET' });
    };
  }, [dispatch, service]); // No dependencies - create only once per component mount

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
      const errors: string[] = [];
      
      dataLoadHandlersRef.current.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Data load handler threw an error', {
            error: errorMessage,
          });
          errors.push(errorMessage);
        }
      });
      
      // Surface aggregated errors to user
      if (errors.length > 0) {
        toast.warning('Some data failed to load', {
          description: `${errors.length} module(s) encountered errors. Check console for details.`,
          duration: 6000,
        });
      }
    };

    service.setDataLoadCallback(callback);

    return () => {
      service.setDataLoadCallback();
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

  const saveNow = useCallback(async (): Promise<void> => {
    if (!service) return;
    await service.save();
  }, [service]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (!service) return false;
    return await service.ensurePermission();
  }, [service]);

  const updateSettings = useCallback((settings: { enabled: boolean; saveInterval: number; debounceDelay: number }) => {
    if (!service) return;
    
    service.updateConfig(settings);
    
    if (settings.enabled && !service.getStatus().isRunning) {
      service.startAutosave();
    } else if (!settings.enabled && service.getStatus().isRunning) {
      service.stopAutosave();
    }
  }, [service]);

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

  const readNamedFile = useCallback(async (fileName: string): Promise<unknown> => {
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
  }, [service]);

  const loadExistingData = useCallback(async (): Promise<unknown> => {
    if (!service) return null;
    return await service.loadExistingData();
  }, [service]);

  const loadDataFromFile = useCallback(async (fileName: string): Promise<unknown> => {
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

  const contextValue: FileStorageContextType = useMemo(() => ({
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
  }), [
    connectToExisting,
    connectToFolder,
    disconnect,
    ensurePermission,
    fileStorageService,
    listDataFiles,
    loadDataFromFile,
    loadExistingData,
    readNamedFile,
    registerDataLoadHandler,
    saveNow,
    service,
    state.hasStoredHandle,
    state.isConnected,
    state.isSupported,
    state.lastError,
    state.lifecycle,
    state.permissionStatus,
    state.statusSnapshot,
    updateSettings,
  ]);

  return (
    <FileStorageContext.Provider value={contextValue}>
      {children}
    </FileStorageContext.Provider>
  );
}

/**
 * Hook to access file storage context.
 * 
 * Provides access to file system operations, autosave control, and connection status.
 * Throws if used outside FileStorageProvider.
 * 
 * ## Example
 * 
 * ```typescript
 * function MyComponent() {
 *   const { isConnected, connectToFolder, status } = useFileStorage();
 *   
 *   if (!isConnected) {
 *     return <button onClick={connectToFolder}>Connect Folder</button>;
 *   }
 *   
 *   return <p>Saves: {status?.saveCount || 0}</p>;
 * }
 * ```
 * 
 * @hook
 * @returns {FileStorageContextType} File storage context with all operations and state
 * @throws {Error} If used outside FileStorageProvider
 */
export function useFileStorage() {
  const context = useContext(FileStorageContext);
  if (!context) {
    throw new Error('useFileStorage must be used within a FileStorageProvider');
  }
  return context;
}

/**
 * Hook that returns a counter incrementing when file data is loaded.
 * 
 * Useful for triggering dependent data fetches when the file is reloaded.
 * 
 * ## Example
 * 
 * ```typescript
 * function MyComponent() {
 *   const changeCount = useFileStorageDataChange();
 *   
 *   useEffect(() => {
 *     // Re-fetch data when file is loaded
 *     loadData();
 *   }, [changeCount]);
 * }
 * ```
 * 
 * @hook
 * @returns {number} Counter that increments on file data load
 */
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

/**
 * Hook to register a callback when file storage data is loaded.
 * 
 * The callback is called whenever data is loaded from the file system.
 * Useful for custom sync logic or data validation.
 * 
 * ## Example
 * 
 * ```typescript
 * useFileStorageDataLoadHandler((data) => {
 *   console.log('File data loaded:', data);
 *   validateData(data);
 * });
 * ```
 * 
 * @hook
 * @param {Function} handler - Callback receiving loaded data
 */
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

/**
 * Lifecycle and permission state selectors.
 * Derived boolean flags for easier state checks.
 * @interface FileStorageLifecycleSelectors
 */
export interface FileStorageLifecycleSelectors {
  /** Current lifecycle state */
  lifecycle: FileStorageLifecycleState;
  /** Current permission state */
  permissionStatus: FileStoragePermissionState;
  /** Whether system is ready for operations */
  isReady: boolean;
  /** Whether system is blocked (can't proceed without user action) */
  isBlocked: boolean;
  /** Whether system is in error state */
  isErrored: boolean;
  /** Whether system is recovering from error */
  isRecovering: boolean;
  /** Whether awaiting user choice (folder selection, permission prompt) */
  isAwaitingUserChoice: boolean;
  /** Whether folder handle is persisted */
  hasStoredHandle: boolean;
  /** Whether currently connected to a folder */
  isConnected: boolean;
  /** Last error that occurred */
  lastError: FileStorageErrorInfo | null;
}

/**
 * Hook for state selectors with derived boolean flags.
 * 
 * Provides convenient boolean flags for checking system state:
 * - isReady, isBlocked, isErrored
 * - isAwaitingUserChoice
 * - isRecovering
 * 
 * ## Example
 * 
 * ```typescript
 * const { isReady, isAwaitingUserChoice, lastError } = useFileStorageLifecycleSelectors();
 * 
 * if (isAwaitingUserChoice) {
 *   return <SelectFolderPrompt />;
 * }
 * 
 * if (lastError) {
 *   return <ErrorDisplay error={lastError} />;
 * }
 * 
 * if (isReady) {
 *   return <AppContent />;
 * }
 * ```
 * 
 * @hook
 * @returns {FileStorageLifecycleSelectors} State selectors with boolean flags
 */
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
