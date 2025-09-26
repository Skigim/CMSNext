import { createContext, useContext, useState, useEffect, useCallback, useReducer, ReactNode } from 'react';
import AutosaveFileService from '@/utils/AutosaveFileService';
import { setFileService } from '@/utils/fileServiceProvider';

interface FileStorageStatus {
  status: string;
  message: string;
  timestamp: number;
  permissionStatus: string;
  lastSaveTime: number | null;
  consecutiveFailures: number;
}

type FileStorageLifecycleState =
  | 'uninitialized'
  | 'unsupported'
  | 'idle'
  | 'requestingPermission'
  | 'ready'
  | 'saving'
  | 'blocked'
  | 'recovering'
  | 'error';

type FileStoragePermissionState = 'unknown' | 'prompt' | 'granted' | 'denied';

interface FileStorageErrorInfo {
  message: string;
  type?: string;
  timestamp: number;
}

interface FileStorageMachineState {
  lifecycle: FileStorageLifecycleState;
  permissionStatus: FileStoragePermissionState;
  isSupported: boolean | undefined;
  hasStoredHandle: boolean;
  isConnected: boolean;
  explicitlyConnected: boolean;
  statusSnapshot: FileStorageStatus | null;
  lastError: FileStorageErrorInfo | null;
  lastSaveTime: number | null;
  consecutiveFailures: number;
}

type FileStorageAction =
  | { type: 'SERVICE_INITIALIZED'; supported: boolean }
  | { type: 'SERVICE_RESET' }
  | { type: 'STATUS_CHANGED'; status: FileStorageStatus }
  | { type: 'CONNECT_REQUESTED' }
  | { type: 'CONNECT_COMPLETED' }
  | { type: 'CONNECT_CONFIRMED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR_REPORTED'; error: FileStorageErrorInfo };

const initialMachineState: FileStorageMachineState = {
  lifecycle: 'uninitialized',
  permissionStatus: 'unknown',
  isSupported: undefined,
  hasStoredHandle: false,
  isConnected: false,
  explicitlyConnected: false,
  statusSnapshot: null,
  lastError: null,
  lastSaveTime: null,
  consecutiveFailures: 0,
};

function normalizePermissionStatus(permission: string | undefined): FileStoragePermissionState {
  if (permission === 'granted' || permission === 'denied' || permission === 'prompt') {
    return permission;
  }
  return 'unknown';
}

function computeHasStoredHandle(status: FileStorageStatus, permissionStatus: FileStoragePermissionState): boolean {
  if (status.status === 'disconnected') {
    return false;
  }

  return permissionStatus === 'granted' || permissionStatus === 'prompt';
}

function deriveLifecycle(
  baseState: FileStorageMachineState,
  status: FileStorageStatus,
  permissionStatus: FileStoragePermissionState,
): FileStorageLifecycleState {
  if (baseState.isSupported === false) {
    return 'unsupported';
  }

  switch (status.status) {
    case 'initialized':
    case 'stopped':
      return baseState.explicitlyConnected && permissionStatus === 'granted' ? 'ready' : 'idle';
    case 'connected':
      return 'ready';
    case 'running':
      return baseState.explicitlyConnected && permissionStatus === 'granted' ? 'ready' : baseState.lifecycle === 'requestingPermission' ? 'requestingPermission' : 'idle';
    case 'waiting':
      if (permissionStatus === 'denied') {
        return 'blocked';
      }
      return baseState.explicitlyConnected && permissionStatus === 'granted' ? 'ready' : 'idle';
    case 'retrying':
      return 'recovering';
    case 'disconnected':
      return 'idle';
    case 'error':
      return 'error';
    default:
      return baseState.lifecycle;
  }
}

function reduceFileStorageState(state: FileStorageMachineState, action: FileStorageAction): FileStorageMachineState {
  switch (action.type) {
    case 'SERVICE_INITIALIZED':
      if (!action.supported) {
        return { ...state, lifecycle: 'unsupported', isSupported: false };
      }
      return {
        ...state,
        lifecycle: state.lifecycle === 'uninitialized' ? 'idle' : state.lifecycle,
        isSupported: true,
      };
    case 'SERVICE_RESET':
      return {
        ...initialMachineState,
        isSupported: state.isSupported,
      };
    case 'CONNECT_REQUESTED':
      return { ...state, lifecycle: 'requestingPermission' };
    case 'CONNECT_CONFIRMED':
      return {
        ...state,
        explicitlyConnected: true,
        isConnected: state.permissionStatus === 'granted' ? true : state.isConnected,
      };
    case 'CONNECT_COMPLETED':
      if (state.explicitlyConnected) {
        return state;
      }
      return {
        ...state,
        lifecycle: state.lifecycle === 'requestingPermission' ? 'idle' : state.lifecycle,
      };
    case 'PERMISSION_DENIED':
      return {
        ...state,
        lifecycle: 'blocked',
        permissionStatus: 'denied',
        explicitlyConnected: false,
        isConnected: false,
        hasStoredHandle: false,
      };
    case 'DISCONNECTED':
      return {
        ...state,
        lifecycle: 'idle',
        explicitlyConnected: false,
        isConnected: false,
        hasStoredHandle: false,
      };
    case 'ERROR_REPORTED':
      return {
        ...state,
        lastError: action.error,
        lifecycle: action.error.type === 'warning' ? state.lifecycle : 'error',
      };
    case 'STATUS_CHANGED': {
      const permissionStatus = normalizePermissionStatus(action.status.permissionStatus);
      const hasStoredHandle = computeHasStoredHandle(action.status, permissionStatus);

      let explicitlyConnected = state.explicitlyConnected;
      let isConnected = state.isConnected;

      if (permissionStatus === 'denied' || action.status.status === 'disconnected') {
        explicitlyConnected = false;
        isConnected = false;
      } else if (explicitlyConnected) {
        isConnected =
          permissionStatus === 'granted' &&
          action.status.status !== 'disconnected' &&
          action.status.status !== 'error';
      }

      const baseState: FileStorageMachineState = {
        ...state,
        explicitlyConnected,
        hasStoredHandle,
      };

      const lifecycle = deriveLifecycle(baseState, action.status, permissionStatus);

      const nextState: FileStorageMachineState = {
        ...baseState,
        lifecycle,
        permissionStatus,
        isConnected,
        statusSnapshot: action.status,
        lastSaveTime: action.status.lastSaveTime ?? null,
        consecutiveFailures: action.status.consecutiveFailures ?? 0,
      };

      if (action.status.status !== 'error' && state.lastError) {
        nextState.lastError = null;
      }

      return nextState;
    }
    default:
      return state;
  }
}

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
      errorCallback: (message, type) => {
        console.error(`File storage ${type || 'error'}:`, message);
        if (type !== 'info') {
          dispatch({ type: 'ERROR_REPORTED', error: { message, type, timestamp: Date.now() } });
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